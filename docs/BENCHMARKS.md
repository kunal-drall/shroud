# Gas Benchmarks

Generated: `forge test --gas-report` (Solidity 0.8.24, optimizer 200 runs)
Network target: Arbitrum Sepolia (L2)

---

## Deployment Costs

| Contract            | Deploy Gas | Bytecode (bytes) | Notes                          |
|---------------------|-----------|-----------------|--------------------------------|
| FROSTVerifier       | 207,936   | 744             | ecrecover-based Schnorr verifier |
| IdentityRegistry    | 791,474   | 1,881           | Poseidon Merkle tree, depth 6  |
| ROSCACircle         | 1,149,961 | 5,965           | Full ROSCA state machine       |
| MembershipVerifier  | ~900,000  | ~3,200          | snarkjs Groth16/BN254 verifier |

---

## IdentityRegistry

| Function          | Min    | Avg     | Median  | Max     |
|-------------------|--------|---------|---------|---------|
| `register()`      | 23,732 | 260,801 | 265,737 | 315,072 |
| `merkleRoot()`    | 2,305  | 2,305   | 2,305   | 2,305   |

> Cost variance in `register()` is from cold vs warm SSTORE on incremental Merkle path updates.

---

## ROSCACircle

| Function          | Min    | Avg     | Median  | Max     |
|-------------------|--------|---------|---------|---------|
| `joinCircle()`    | 29,813 | 123,404 | 110,253 | 174,665 |
| `contribute()`    | 25,905 | 59,735  | 57,483  | 74,583  |
| `claimPayout()`   | 40,142 | 88,522  | 99,882  | 99,882  |
| `progressRound()` | 29,859 | 39,165  | 41,149  | 41,149  |

> `joinCircle()` max cost (~175k) is the final member join that transitions the circle to ACTIVE.
> `claimPayout()` includes ecrecover (~3k) + ETH transfer + SSTORE writes.

---

## FROSTVerifier

| Function   | Min | Avg   | Median | Max   |
|------------|-----|-------|--------|-------|
| `verify()` | 399 | 3,145 | 515    | 7,587 |

> Low-s rejection exits at ~399 gas. Full ecrecover path ~7.5k gas.

---

## MembershipVerifier (Groth16/BN254)

| Function        | Gas       |
|-----------------|-----------|
| `verifyProof()` | ~250,000  |

> Groth16 on-chain verification dominates — 3 BN254 pairing checks.
> On Arbitrum Sepolia at typical gas prices: ~$0.01-0.05 USD per proof.

---

## Full 5-Member ROSCA Lifecycle

| Step                  | Gas (approx) |
|-----------------------|--------------|
| Deploy ROSCACircle    | 1,150,000    |
| 5x joinCircle         | 550,000      |
| 5x contribute (×5 rounds) | 1,500,000 |
| 5x claimPayout        | 500,000      |
| 5x progressRound      | 205,000      |
| **Total lifecycle**   | **~3.9M**    |

> At 0.1 gwei on Arbitrum Sepolia: full 5-member lifecycle ≈ $0.15-0.50 USD.
