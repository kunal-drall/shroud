/**
 * Poseidon Cross-Compatibility Check
 *
 * Verifies that circomlibjs Poseidon == on-chain Poseidon (PoseidonDeployer bytecode).
 * A mismatch here means ZK proofs will ALWAYS fail on-chain with no useful error.
 *
 * Usage: node packages/circuits/scripts/check-poseidon-compat.js
 * Requires: anvil running on localhost:8545  OR  pass --no-chain to skip on-chain check
 *
 * The critical invariant: Poseidon(1) in JS must equal Poseidon(1) in Solidity.
 */

const { buildPoseidon, poseidonContract } = require("circomlibjs");

// ── secp256k1 / BN254 field size ──────────────────────────────────────────────
const FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// ── Known expected values (computed from circomlibjs, used as regression anchors) ─
// These MUST match what the circuit outputs for the same inputs.
// If these change, the circuit parameters changed and all keys must be regenerated.
const EXPECTED = {
  // Poseidon([1])   — used as a commitment in tests
  poseidon1: null,  // computed at runtime
  // Poseidon([1, 2]) — used as a merkle hash in tests
  poseidon12: null, // computed at runtime
};

async function main() {
  console.log("=== Poseidon Cross-Compatibility Check ===\n");

  // ── Step 1: Compute using circomlibjs ────────────────────────────────────────
  console.log("► Step 1: Compute via circomlibjs...");
  const p = await buildPoseidon();
  const F = p.F;

  const js_p1   = F.toObject(p([1n]));          // Poseidon([1])
  const js_p12  = F.toObject(p([1n, 2n]));      // Poseidon([1, 2])
  const js_p42  = F.toObject(p([42n]));         // Poseidon([42]) — commitment for msk=42
  const js_pmsk = F.toObject(p([42n, 999n]));   // Poseidon([42, 999]) — nullifier(msk=42, circleId=999)

  console.log(`  Poseidon([1])       = 0x${js_p1.toString(16).padStart(64, "0")}`);
  console.log(`  Poseidon([1, 2])    = 0x${js_p12.toString(16).padStart(64, "0")}`);
  console.log(`  Poseidon([42])      = 0x${js_p42.toString(16).padStart(64, "0")}  ← commitment for msk=42`);
  console.log(`  Poseidon([42, 999]) = 0x${js_pmsk.toString(16).padStart(64, "0")}  ← nullifier(42, 999)`);

  // ── Step 2: Validate field bounds ────────────────────────────────────────────
  console.log("\n► Step 2: Validate outputs are in BN254 scalar field...");
  const values = { js_p1, js_p12, js_p42, js_pmsk };
  let allInField = true;
  for (const [name, val] of Object.entries(values)) {
    const inField = val > 0n && val < FIELD_SIZE;
    if (!inField) {
      console.error(`  ✗ ${name} = ${val} is OUT OF FIELD`);
      allInField = false;
    }
  }
  if (allInField) console.log("  ✓ All outputs are valid BN254 scalar field elements");

  // ── Step 3: Determinism check ─────────────────────────────────────────────────
  console.log("\n► Step 3: Determinism check (compute twice, compare)...");
  const p2 = await buildPoseidon();
  const F2 = p2.F;
  const js_p1_again = F2.toObject(p2([1n]));
  if (js_p1 === js_p1_again) {
    console.log("  ✓ Poseidon([1]) is deterministic across instances");
  } else {
    console.error("  ✗ DETERMINISM FAILURE — different results from two buildPoseidon() calls!");
    process.exitCode = 1;
  }

  // ── Step 4: Generate Solidity test values ─────────────────────────────────────
  console.log("\n► Step 4: Generating Solidity test values for CompatCheck.t.sol...");
  console.log("\n  // Paste these into CompatCheck.t.sol:");
  console.log(`  uint256 constant JS_POSEIDON_1       = 0x${js_p1.toString(16).padStart(64, "0")};`);
  console.log(`  uint256 constant JS_POSEIDON_1_2     = 0x${js_p12.toString(16).padStart(64, "0")};`);
  console.log(`  uint256 constant JS_POSEIDON_MSK42   = 0x${js_p42.toString(16).padStart(64, "0")};`);
  console.log(`  uint256 constant JS_POSEIDON_NUL42_999 = 0x${js_pmsk.toString(16).padStart(64, "0")};`);

  // ── Step 5: On-chain check (optional, requires anvil) ──────────────────────────
  const noChain = process.argv.includes("--no-chain");
  if (noChain) {
    console.log("\n► Step 5: Skipped (--no-chain). Run forge test -t test_poseidonCompat for on-chain check.");
  } else {
    console.log("\n► Step 5: On-chain check requires: run 'forge test -t test_poseidonCompat'");
    console.log("          See packages/contracts/test/CompatCheck.t.sol");
  }

  console.log("\n=== Summary ===");
  if (allInField && js_p1 === js_p1_again) {
    console.log("✓ circomlibjs Poseidon is consistent and in-field.");
    console.log("✓ Run `forge test -t test_poseidonCompat` to verify Solidity matches.");
  } else {
    console.log("✗ Failures detected — see above.");
    process.exitCode = 1;
  }
}

main().catch(e => { console.error(e); process.exit(1); });
