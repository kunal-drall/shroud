# Shroud Circuits

ZK circuits for the Shroud Protocol, written in [Circom](https://docs.circom.io/).

## Circuit: `membership`

Proves that a prover knows a secret that maps to a leaf in a Merkle tree
without revealing **which** leaf or the secret itself.

### Inputs

| Signal         | Type    | Description                                        |
|----------------|---------|----------------------------------------------------|
| `secret`       | private | User's secret (random 253-bit value)               |
| `salt`         | private | Random salt to separate commitment from nullifier  |
| `pathElements` | private | Merkle sibling hashes (depth = 6)                  |
| `pathIndices`  | private | Left/right bits for each level (0 or 1)            |
| `merkleRoot`   | public  | Expected Merkle root (matches IdentityRegistry)    |
| `nullifier`    | public  | `Poseidon(secret, circleId)` — prevents double-join|
| `circleId`     | public  | Address of the ROSCACircle contract (as uint256)   |

### Constraints

1. `commitment = Poseidon(secret, salt)`
2. `commitment` is a valid leaf in the Merkle tree with root `merkleRoot`
3. `nullifier = Poseidon(secret, circleId)`

### Build

```bash
cd packages/circuits
bash scripts/compile.sh
```

This will produce `build/membership.r1cs`, `build/membership.zkey`, and
`build/membership_js/membership.wasm`.

### Test

```bash
npm test
```
