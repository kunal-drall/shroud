/**
 * Generate a hardcoded proof fixture for the Foundry integration test.
 * Outputs Solidity-ready calldata: pA, pB, pC, pubSignals, merkleRoot, commitment.
 *
 * Usage: node packages/circuits/scripts/gen-fixture.js
 */

const snarkjs = require("snarkjs");
const path = require("path");

const BUILD = path.join(__dirname, "../build");
const WASM  = path.join(BUILD, "membership_js/membership.wasm");
const ZKEY  = path.join(BUILD, "membership.zkey");
const VKEY  = path.join(BUILD, "verification_key.json");

const FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const DEPTH = 6;

async function main() {
  const { buildPoseidon } = require("circomlibjs");
  const p = await buildPoseidon();
  const poseidon = (...inputs) => p.F.toObject(p(inputs));

  // Fixed test inputs — deterministic across runs
  const MSK     = 42n;
  const CIRCLE_ID = 999n;
  const commitment = poseidon(MSK);

  // Build depth-6 Merkle tree with commitment at index 0
  const leaves = [commitment];
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length < 2 ** DEPTH) paddedLeaves.push(0n);

  let level = [...paddedLeaves];
  const levels = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(poseidon(level[i], level[i + 1]));
    }
    level = next;
    levels.push(level);
  }
  const root = levels[DEPTH][0];

  // Merkle proof for index 0
  const pathElements = [];
  const pathIndices = [];
  let idx = 0;
  for (let i = 0; i < DEPTH; i++) {
    const sibling = idx % 2 === 0 ? levels[i][idx + 1] : levels[i][idx - 1];
    pathElements.push(sibling ?? 0n);
    pathIndices.push(idx % 2);
    idx = Math.floor(idx / 2);
  }

  const input = {
    msk: MSK.toString(),
    pathElements: pathElements.map(String),
    pathIndices,
    merkleRoot: root.toString(),
    circleId: CIRCLE_ID.toString(),
  };

  process.stderr.write("Generating proof...\n");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);

  // Verify before outputting
  const vkey = require(VKEY);
  const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  if (!ok) throw new Error("Generated proof failed verification!");

  const nullifier = BigInt(publicSignals[2]);

  // Output as a JSON fixture
  const fixture = {
    msk: MSK.toString(),
    commitment: commitment.toString(),
    circleId: CIRCLE_ID.toString(),
    merkleRoot: root.toString(),
    nullifier: nullifier.toString(),
    // Proof components (as hex strings for Solidity)
    pA: proof.pi_a.slice(0, 2).map(x => "0x" + BigInt(x).toString(16)),
    pB: [
      [proof.pi_b[0][1], proof.pi_b[0][0]].map(x => "0x" + BigInt(x).toString(16)),
      [proof.pi_b[1][1], proof.pi_b[1][0]].map(x => "0x" + BigInt(x).toString(16)),
    ],
    pC: proof.pi_c.slice(0, 2).map(x => "0x" + BigInt(x).toString(16)),
    pubSignals: publicSignals.map(x => "0x" + BigInt(x).toString(16)),
  };

  process.stdout.write(JSON.stringify(fixture, null, 2) + "\n");
  process.stderr.write(`✓ Proof generated and verified\n`);
  process.stderr.write(`  merkleRoot: 0x${root.toString(16).padStart(64, "0")}\n`);
  process.stderr.write(`  nullifier:  0x${nullifier.toString(16).padStart(64, "0")}\n`);
  process.stderr.write(`  commitment: 0x${commitment.toString(16).padStart(64, "0")}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
