#!/usr/bin/env node
/**
 * gen-proof.js — Generate a Groth16 Membership proof for Foundry FFI integration tests.
 *
 * Outputs a single ABI-encoded hex string:
 *   abi.encode(
 *     uint256[2] pA,
 *     uint256[2][2] pB,
 *     uint256[2] pC,
 *     uint256[3] pubSignals,   // [nullifier, merkleRoot, circleId]
 *     bytes32    merkleRoot,   // as bytes32 for Solidity
 *     bytes32    nullifier     // as bytes32
 *   )
 *
 * Usage:
 *   node scripts/gen-proof.js
 *
 * Circuit artifacts expected at:
 *   ../../frontend/public/circuits/membership.wasm
 *   ../../frontend/public/circuits/membership.zkey  (or ../../../packages/circuits/build/membership.zkey)
 */

const path = require('path');
const { buildPoseidon } = require('circomlibjs');
const snarkjs = require('snarkjs');

async function main() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  // ── Fixed test inputs ────────────────────────────────────────────────────
  // Use deterministic values so the integration test is reproducible.
  const CIRCLE_ID = 1n;
  const MSK       = 0xdeadbeefcafen;   // arbitrary private key for test

  // 1. Commitment = Poseidon(msk)
  const commitment = F.toObject(poseidon([MSK]));

  // 2. Build a minimal tree: single leaf at index 0
  //    zeros[i] = 0 (circuit convention for empty nodes)
  const DEPTH = 6;
  const ZERO  = 0n;

  // Tree levels: level[0] = leaves, level[6] = root
  const leaves = new Array(64).fill(ZERO);
  leaves[0] = commitment;

  let levels = [leaves];
  let curr = leaves;
  for (let i = 0; i < DEPTH; i++) {
    const next = [];
    for (let j = 0; j < curr.length; j += 2) {
      next.push(F.toObject(poseidon([curr[j], curr[j+1]])));
    }
    levels.push(next);
    curr = next;
  }
  const merkleRoot = levels[DEPTH][0];

  // 3. Merkle proof for leaf 0
  const pathElements = [];
  const pathIndices  = [];
  let idx = 0;
  for (let i = 0; i < DEPTH; i++) {
    const isRight = idx % 2 === 1;
    const sibIdx  = isRight ? idx - 1 : idx + 1;
    pathElements.push(levels[i][sibIdx] ?? ZERO);
    pathIndices.push(isRight ? 1 : 0);
    idx = Math.floor(idx / 2);
  }

  // 4. Expected nullifier = Poseidon(msk, circleId)
  const nullifier = F.toObject(poseidon([MSK, CIRCLE_ID]));

  // 5. Generate proof
  const wasmPath = path.resolve(__dirname, '../../frontend/public/circuits/membership.wasm');
  const zkeyPath = path.resolve(__dirname, '../../frontend/public/circuits/membership.zkey');

  const input = {
    msk:          MSK.toString(),
    pathElements: pathElements.map(e => e.toString()),
    pathIndices,
    merkleRoot:   merkleRoot.toString(),
    circleId:     CIRCLE_ID.toString(),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

  // 6. Export Solidity calldata
  const calldataStr = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [pA, pB, pC, pubSig] = JSON.parse(`[${calldataStr}]`);

  // 7. Output JSON for Solidity to parse via vm.parseJson / abi.decode
  const output = {
    pA:          pA.map(x => BigInt(x).toString()),
    pB:          pB.map(row => row.map(x => BigInt(x).toString())),
    pC:          pC.map(x => BigInt(x).toString()),
    pubSignals:  pubSig.map(x => BigInt(x).toString()),
    merkleRoot:  '0x' + merkleRoot.toString(16).padStart(64, '0'),
    nullifier:   '0x' + nullifier.toString(16).padStart(64, '0'),
    circleId:    CIRCLE_ID.toString(),
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch(err => {
  process.stderr.write(err.message + '\n');
  process.exit(1);
});
