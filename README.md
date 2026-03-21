# Shroud Protocol

> **Live demo:** https://shroud-two.vercel.app

**Private savings circles on Arbitrum Sepolia.**

Anonymous membership via ZK proofs. Threshold custody via FROST signatures.

Built for [Shape Rotator Virtual Hackathon](https://lu.ma/shape-rotator-2026) (IC3 / FlashbotsX / Encode Club, March 2026).

---

## What

A ROSCA (Rotating Savings and Credit Association) where:

- Members are **cryptographically anonymous** — participation is proven via Groth16 ZK proofs, not wallet addresses
- Funds are custodied at a **threshold address** — disbursements require a FROST 2-of-3 signature from Thetacrypt TEE nodes
- **Double-joining is impossible** without a linkable on-chain trace — circle-specific nullifiers enforce uniqueness

## Why

Traditional on-chain ROSCAs expose every participant's wallet history to every other member. Shroud separates identity from activity: you prove you *are* a valid member without revealing *which* member you are.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Identity Layer  (ePrint 2025/618)                          │
│  msk → commitment = Poseidon(msk)  (registered on-chain)    │
│  proof: Groth16 Merkle membership + nullifier               │
├─────────────────────────────────────────────────────────────┤
│  Protocol Layer  (Novel — Shroud)                           │
│  ROSCACircle state machine: JOINING → ACTIVE → COMPLETED    │
│  joinCircle / contribute / claimPayout / progressRound      │
├─────────────────────────────────────────────────────────────┤
│  Custody Layer  (arXiv 2502.03247)                          │
│  FROST 2-of-3 threshold sig from Thetacrypt nodes           │
│  Schnorr sig verified on-chain via ecrecover                 │
└─────────────────────────────────────────────────────────────┘
```

**ZK circuit**: Groth16/BN254, Poseidon Merkle tree depth 6 (64-member anonymity set), 1,911 constraints.

**Nullifier**: `nul = Poseidon(msk, circle_id)` — deterministic per circle, unlinkable across circles.

---

## Setup

### Prerequisites

- Node.js ≥ 18, npm ≥ 9
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, cast)
- Circom 2.1.9 binary on PATH
- snarkjs: `npm install -g snarkjs`

### Install

```bash
git clone https://github.com/you/shroud && cd shroud
npm install
```

### Compile the ZK circuit

```bash
cd packages/circuits
bash scripts/compile.sh
# Outputs: build/membership.wasm, build/membership.zkey, build/verification_key.json
# Copies MembershipVerifier.sol → packages/contracts/src/
```

Then copy artifacts to the frontend:

```bash
cp packages/circuits/build/membership_js/membership.wasm packages/frontend/public/circuits/
cp packages/circuits/build/membership.zkey packages/frontend/public/circuits/
```

### Run contract tests

```bash
cd packages/contracts
forge test -vv
```

### Deploy contracts (Arbitrum Sepolia)

```bash
cd packages/contracts
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --broadcast \
  --verify
```

Update `packages/frontend/lib/contracts.ts` with the deployed addresses.

### Run the frontend

```bash
cd packages/frontend
npm run dev
# Open http://localhost:3000
```

---

## User Flow

| Step | Action | Technology |
|------|--------|-----------|
| 1 | Generate `msk`, compute `commitment = Poseidon(msk)` | circomlibjs (browser) |
| 2 | Register commitment on-chain → inserted into Merkle tree | IdentityRegistry.sol |
| 3 | Generate Groth16 membership proof, submit `joinCircle()` | snarkjs + ROSCACircle.sol |
| 4 | Each round: `contribute()` via pseudonym (bytes32 nullifier) | ROSCACircle.sol |
| 5 | When it's your turn: `claimPayout()` with FROST co-signature | FROSTVerifier.sol |

---

## Deployed Addresses (Arbitrum Sepolia)

| Contract | Address |
|----------|---------|
| IdentityRegistry | [`0x7306921da48Aac4e13Ec349d3ba085Cd21A58a75`](https://sepolia.arbiscan.io/address/0x7306921da48Aac4e13Ec349d3ba085Cd21A58a75) |
| MembershipVerifier | [`0xEfeE9c9339Fb9881F70bCCE8e8246aCb2Ed0E8C9`](https://sepolia.arbiscan.io/address/0xEfeE9c9339Fb9881F70bCCE8e8246aCb2Ed0E8C9) |
| FROSTVerifier | [`0x7217a46757cCbc9D3eCAfBC37ABa94078aa75571`](https://sepolia.arbiscan.io/address/0x7217a46757cCbc9D3eCAfBC37ABa94078aa75571) |
| ROSCACircle (demo) | [`0xfBb1AF442BB8E17EE2017BF2D83FC9783D55c798`](https://sepolia.arbiscan.io/address/0xfBb1AF442BB8E17EE2017BF2D83FC9783D55c798) |

---

## Gas Benchmarks

Measured with `forge test --gas-report`.

### IdentityRegistry

| Function | Avg gas |
|----------|---------|
| `register()` | 260,801 |

### ROSCACircle

| Function | Min | Avg | Max |
|----------|-----|-----|-----|
| `joinCircle()` | 29,813 | 123,404 | 174,665 |
| `contribute()` | 25,905 | 59,735 | 74,583 |
| `claimPayout()` | 40,142 | 88,522 | 99,882 |
| `progressRound()` | 29,859 | 39,165 | 41,149 |

Deployment: IdentityRegistry 791,474 gas · ROSCACircle 1,149,961 gas · MembershipVerifier ~900,000 gas.

Full 5-member ROSCA lifecycle: ~3.9M gas (~$0.15–0.50 USD on Arbitrum Sepolia).

See [docs/BENCHMARKS.md](docs/BENCHMARKS.md) for complete breakdown.

---

## Test Results

```
Ran 6 test suites: 60 tests passed, 0 failed  ✓

packages/contracts/test/IdentityRegistry.t.sol  —  7 tests  (Merkle tree, capacity, field bounds)
packages/contracts/test/ROSCACircle.t.sol        — 18 tests  (incl. full 5-member lifecycle)
packages/contracts/test/FROSTVerifier.t.sol      — 11 tests  (incl. real secp256k1 acceptance via vm.createWallet)
packages/contracts/test/PoseidonCompat.t.sol     —  9 tests  (JS circomlibjs == Solidity bytecode)
packages/contracts/test/Integration.t.sol        —  9 tests  (real Groth16 proof via vm.ffi + real FROST sig)
```

Circuit tests (snarkjs):

```
packages/circuits/test/membership.test.js       — 5 tests
  ✓ valid proof accepted
  ✓ invalid msk rejected (Merkle path mismatch)
  ✓ nullifier is deterministic
  ✓ cross-circle unlinkability (different circleIds → different nullifiers)
  ✓ tampered merkleRoot rejected by verifier
```

---

## Known Limitations

See [SECURITY.md](SECURITY.md) for full threat model. Highlights:

- **Trusted setup**: Single-contributor ceremony (hackathon grade). Production requires a multi-party ceremony.
- **FROST verifier**: Uses ECDSA/ecrecover as an architectural stand-in. Production path: proper Schnorr ecrecover trick on secp256k1.
- **Proof generation**: ~3–8 seconds in browser (snarkjs JS). Production path: Rust→WASM reduces to ~300ms.
- **No event indexing**: Circle list is hardcoded for demo. Production: index `IdentityRegistered` + deployment events.
- **localStorage key storage**: Master key stored in `localStorage`. Production: hardware wallet derivation or encrypted keystore.

---

## References

- [ePrint 2025/618](https://eprint.iacr.org/2025/618) — Anonymous Self-Credentials
- [arXiv 2502.03247](https://arxiv.org/abs/2502.03247) — Thetacrypt Threshold Signatures
- [Circom 2 docs](https://docs.circom.io/)
- [snarkjs](https://github.com/iden3/snarkjs)
