# Shroud Protocol — Architecture

> Privacy-preserving community finance infrastructure combining Anonymous Self-Credentials and Thetacrypt threshold cryptography.

## Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│  Wallet Connection · Proof Generation (WASM) · Circle Dashboard │
└──────────────────────────────┬──────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐  ┌──────────────────┐  ┌───────────────────────┐
│ IDENTITY LAYER│  │  PROTOCOL LAYER  │  │    CUSTODY LAYER      │
│    (ASC)      │  │   (ROSCA Logic)  │  │    (Thetacrypt)       │
│               │  │                  │  │                       │
│ IdR Registry  │  │ ROSCACircle.sol  │  │ FROST Threshold Sigs  │
│ ZK Membership │  │ State Machine    │  │ TEE-Attested Nodes    │
│ Nullifiers    │  │ Round Management │  │ Key Share Management  │
│               │  │ Default Handling │  │                       │
│ ePrint 2025/  │  │ Novel (this      │  │ arXiv 2502.03247     │
│ 618           │  │ project)         │  │                       │
└───────┬───────┘  └────────┬─────────┘  └───────────┬───────────┘
        │                   │                        │
        └───────────────────┼────────────────────────┘
                            ▼
              ┌──────────────────────────┐
              │    ARBITRUM (On-Chain)    │
              │                          │
              │ MembershipVerifier.sol   │
              │ NullifierRegistry.sol    │
              │ ROSCACircle.sol          │
              │ FROSTVerifier.sol        │
              └──────────────────────────┘
```

## Identity Layer (ASC)

Implements Anonymous Self-Credentials from ePrint 2025/618:

- **Identity Registry (IdR)**: On-chain Merkle tree of user commitments (`pk = Poseidon(msk)`)
- **Membership Proof**: Groth16 SNARK proving Merkle inclusion without revealing which leaf
- **Nullifiers**: `nul = Poseidon(msk, circle_id)` — deterministic, per-circle, prevents double-joining
- **Unlinkability**: Different circles produce unlinkable nullifiers from the same master key

## Custody Layer (Thetacrypt)

Implements threshold-controlled fund custody from arXiv 2502.03247:

- **FROST Signatures**: t-of-n Schnorr threshold signing on secp256k1 for EVM compatibility
- **Payout Authorization**: Threshold group co-signs disbursements after validating ROSCA state
- **TEE Attestation**: Threshold nodes run inside dstack CVMs (Intel TDX) for hardware-enforced isolation
- **Key Derivation**: dstack's `getKey()` provides deterministic, attested key shares

## Protocol Layer (Novel)

The ROSCA state machine connecting identity and custody:

```
CREATED → JOINING → ACTIVE → ROUND_COLLECTING → ROUND_DISBURSING → ... → COMPLETED
```

### State Transitions

| Transition | Trigger | Verification |
|---|---|---|
| Join | User submits ZK proof + nullifier | Groth16 verify + nullifier uniqueness |
| Contribute | Member sends funds | Pseudonym-based tracking |
| Claim Payout | Eligible member requests | FROST threshold signature |
| Default | Deadline missed | Grace period → penalty → exclusion |

## Security Composition

| Assumption | Protects | Break Impact |
|---|---|---|
| ZK Soundness (BN254) | Membership anonymity | Cannot forge membership, funds still safe |
| FROST Security (secp256k1) | Fund custody | Cannot steal funds, anonymity still holds |
| TEE Integrity (Intel TDX) | Threshold node honesty | Share exposed but still need t shares |

No single assumption failure compromises the full system.

## Smart Contracts

| Contract | Function | Gas Target |
|---|---|---|
| `IdentityRegistry.sol` | Merkle tree of identity commitments | <100K/register |
| `MembershipVerifier.sol` | Groth16 SNARK verification | <230K/verify |
| `ROSCACircle.sol` | ROSCA state machine | Variable |
| `FROSTVerifier.sol` | Schnorr threshold sig verification | <6K/verify |

## ZK Circuit

```
membership.circom
├── Input (private): msk, merklePath, pathIndices
├── Input (public):  merkleRoot, circleId
├── Output (public): nullifier
├── Constraints: ~2,500 (at depth 6, N=64)
└── Proof time: <5s desktop, <10s mobile (WASM)
```

## Repository Structure

```
shroud-protocol/
├── packages/
│   ├── circuits/          # Circom: membership proof + nullifier
│   ├── contracts/         # Foundry: ROSCACircle, verifiers
│   ├── crypto-lib/        # Rust→WASM: key gen, nullifiers, proofs
│   └── frontend/          # Next.js + wagmi + WASM integration
├── docs/
│   ├── ARCHITECTURE.md    # This file
│   └── SECURITY.md        # Threat model and mitigations
└── README.md
```

## References

- Alupotha et al. "Anonymous Self-Credentials and their Application to SSO." ePrint 2025/618
- Barbaraci et al. "Thetacrypt: A Distributed Service for Threshold Cryptography." arXiv 2502.03247
- Komlo, Goldberg. "FROST: Flexible Round-Optimized Schnorr Threshold Signatures." SAC 2020
- dstack. "A Zero Trust Framework for Confidential Containers." arXiv 2509.11555
