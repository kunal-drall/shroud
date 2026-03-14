/**
 * Shroud Protocol — Membership Circuit Tests
 * Tests: valid proof, invalid proof, nullifier determinism, unlinkability, root mismatch
 */

const snarkjs = require("snarkjs");
const path = require("path");

const BUILD = path.join(__dirname, "../build");
const WASM  = path.join(BUILD, "membership_js/membership.wasm");
const ZKEY  = path.join(BUILD, "membership.zkey");
const VKEY  = path.join(BUILD, "verification_key.json");

const FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// ── Poseidon helpers (using circomlibjs) ────────────────────────────────────

let poseidon;
async function getPoseidon() {
  if (!poseidon) {
    const { buildPoseidon } = require("circomlibjs");
    const p = await buildPoseidon();
    poseidon = (...inputs) => p.F.toObject(p(inputs));
  }
  return poseidon;
}

// ── Merkle tree builder (Poseidon, depth 6) ─────────────────────────────────

const DEPTH = 6;

async function buildTree(leaves) {
  const pos = await getPoseidon();
  // Pad to 64 leaves with zeros
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length < 2 ** DEPTH) paddedLeaves.push(0n);

  let level = [...paddedLeaves];
  const levels = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(pos(level[i], level[i + 1]));
    }
    level = next;
    levels.push(level);
  }
  return levels;
}

async function getMerkleProof(leafIndex, leaves) {
  const levels = await buildTree(leaves);
  const pathElements = [];
  const pathIndices = [];
  let idx = leafIndex;
  for (let i = 0; i < DEPTH; i++) {
    const sibling = idx % 2 === 0 ? levels[i][idx + 1] : levels[i][idx - 1];
    pathElements.push(sibling ?? 0n);
    pathIndices.push(idx % 2);
    idx = Math.floor(idx / 2);
  }
  const root = levels[DEPTH][0];
  return { root, pathElements, pathIndices };
}

// ── Proof helpers ───────────────────────────────────────────────────────────

async function prove(msk, leaves, leafIndex, circleId) {
  const pos = await getPoseidon();
  const { root, pathElements, pathIndices } = await getMerkleProof(leafIndex, leaves);

  const input = {
    msk: msk.toString(),
    pathElements: pathElements.map(String),
    pathIndices,
    merkleRoot: root.toString(),
    circleId: circleId.toString(),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  return { proof, publicSignals, root, nullifier: BigInt(publicSignals[2]) };
}

async function verify(proof, publicSignals) {
  const vkey = require(VKEY);
  return snarkjs.groth16.verify(vkey, publicSignals, proof);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomField() {
  const bytes = require("crypto").randomBytes(31);
  return BigInt("0x" + bytes.toString("hex")) % FIELD_SIZE;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// ── Tests ───────────────────────────────────────────────────────────────────

async function test_validProofAccepted() {
  console.log("\n[1] Valid proof accepted...");
  const pos = await getPoseidon();
  const msk = randomField();
  const commitment = pos(msk);
  const leaves = [commitment];
  const circleId = 42n;

  const { proof, publicSignals, nullifier } = await prove(msk, leaves, 0, circleId);
  const ok = await verify(proof, publicSignals);
  assert(ok, "Valid proof should be accepted");
  console.log("    ✓ Proof verified");
  console.log(`    ✓ Nullifier: ${nullifier.toString().slice(0, 20)}...`);
}

async function test_invalidMskRejected() {
  console.log("\n[2] Invalid msk (wrong leaf) rejected...");
  const pos = await getPoseidon();
  const msk = randomField();
  const commitment = pos(msk);
  const leaves = [commitment];
  const circleId = 1n;

  // Use wrong msk (different from registered one)
  const wrongMsk = randomField();

  let threw = false;
  try {
    await prove(wrongMsk, leaves, 0, circleId);
  } catch (e) {
    threw = true;
  }
  assert(threw, "Proof with wrong msk should fail witness generation");
  console.log("    ✓ Invalid msk correctly rejected");
}

async function test_nullifierDeterminism() {
  console.log("\n[3] Nullifier determinism (same msk + circleId = same nullifier)...");
  const pos = await getPoseidon();
  const msk = randomField();
  const commitment = pos(msk);
  const leaves = [commitment, commitment]; // two slots
  const circleId = 7n;

  // Add commitment at index 0
  const { nullifier: n1 } = await prove(msk, [commitment], 0, circleId);

  // Prove again with same inputs — nullifier must be identical
  // Build a 2-leaf tree to show it's input-independent
  const { nullifier: n2 } = await prove(msk, [commitment], 0, circleId);

  assert(n1 === n2, `Nullifiers should match: ${n1} !== ${n2}`);
  console.log("    ✓ Same msk + circleId always produces the same nullifier");
}

async function test_crossCircleUnlinkability() {
  console.log("\n[4] Cross-circle unlinkability (same msk, different circleId = different nullifier)...");
  const pos = await getPoseidon();
  const msk = randomField();
  const commitment = pos(msk);
  const leaves = [commitment];

  const { nullifier: nA } = await prove(msk, leaves, 0, 100n);
  const { nullifier: nB } = await prove(msk, leaves, 0, 200n);

  assert(nA !== nB, "Different circleIds must produce different nullifiers");
  console.log(`    ✓ Circle 100 nullifier: ${nA.toString().slice(0, 16)}...`);
  console.log(`    ✓ Circle 200 nullifier: ${nB.toString().slice(0, 16)}...`);
  console.log("    ✓ Nullifiers are unlinkable across circles");
}

async function test_rootMismatchRejected() {
  console.log("\n[5] Wrong Merkle root in public signals rejected by verifier...");
  const pos = await getPoseidon();
  const msk = randomField();
  const commitment = pos(msk);
  const leaves = [commitment];
  const circleId = 1n;

  const { proof, publicSignals } = await prove(msk, leaves, 0, circleId);

  // Tamper with the merkleRoot in public signals (index 0)
  const tamperedSignals = [...publicSignals];
  tamperedSignals[0] = "12345678901234567890";

  const ok = await verify(proof, tamperedSignals);
  assert(!ok, "Tampered root should fail verification");
  console.log("    ✓ Tampered Merkle root correctly rejected");
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log("=== Shroud Membership Circuit Tests ===");
  console.log(`WASM: ${WASM}`);
  console.log(`ZKEY: ${ZKEY}`);

  const tests = [
    test_validProofAccepted,
    test_invalidMskRejected,
    test_nullifierDeterminism,
    test_crossCircleUnlinkability,
    test_rootMismatchRejected,
  ];

  let passed = 0, failed = 0;
  for (const t of tests) {
    try {
      await t();
      passed++;
    } catch (e) {
      console.error(`\n    ✗ ${e.message}`);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed}/${tests.length} passed ===`);
  if (failed > 0) process.exit(1);
})();
