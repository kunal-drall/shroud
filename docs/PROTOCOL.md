# Shroud Protocol Specification

## Overview

Shroud is a privacy-preserving ROSCA (Rotating Savings and Credit Association) built on Ethereum.
Members contribute equal amounts each round; one member receives the pot per round.
Privacy is achieved via ZK proofs (membership) and threshold signatures (payout authorization).

## Roles

| Role        | Description |
|-------------|-------------|
| Member      | Registered identity with a ZK commitment in the Merkle tree |
| Coordinator | Off-chain component that manages the FROST key-signing ceremony |
| Contract    | On-chain state machine enforcing rules deterministically |

## Protocol Flow

### 1. Identity Registration

```
User  ──────────────────────────────────────────────▶  IdentityRegistry
        register(commitment, pubKeyX, pubKeyY)
        where commitment = Poseidon(secret, salt)
```

The Merkle root is updated after each registration. A new `ROSCACircle` is deployed
with the final root once all expected members have registered.

### 2. Joining a Circle

```
User  ──────────────────────────────────────────────▶  ROSCACircle
        joinCircle(zkProof, merkleRoot, nullifier, circleId, deposit)
```

The ZK proof proves `membership(secret, salt, merkleRoot)` without revealing which
leaf the member holds. The `nullifier = Poseidon(secret, circleId)` prevents replay.

Once `memberCount` members have joined the circle transitions to `ACTIVE`.

### 3. Contributing

Each round, all members call `contribute{value: contributionAmount}()`. When all
members have contributed, the round pot is available for the designated recipient.

### 4. Claiming the Payout

The payout recipient for round `r` is `memberList[r-1]` (deterministic rotation).
They must present a FROST threshold signature to prove coordinator consensus:

```
claimPayout(pseudonym, proof, sigR, sigS)
```

The signature covers `keccak256(circleAddress, recipient, amount, round)`.

### 5. Round Progression

After the payout is claimed, any member calls `progressRound()` to advance state.
If the round deadline passes without full contributions, the round is skipped.

## Security Properties

| Property          | Mechanism                               |
|-------------------|-----------------------------------------|
| Member privacy    | Groth16 ZK proof; nullifier prevents double-join |
| Payout integrity  | FROST threshold signature (≥ t-of-n coordinators) |
| Replay prevention | Nullifier registry; per-round contribution counter |
| Sig malleability  | Low-s enforcement (EIP-2)               |
| Reentrancy        | OpenZeppelin `ReentrancyGuard`          |

## Cryptographic Primitives

- **Hash**: Poseidon (BN254-friendly, circomlibjs compatible)
- **ZK proof system**: Groth16 over BN254
- **Threshold signatures**: FROST (simplified to ECDSA/ecrecover for hackathon)
- **Curve**: secp256k1

## Limitations (Hackathon Scope)

- FROST is simulated with a single ECDSA key; real deployment requires multi-party signing
- Circuit depth is fixed at 6 (max 64 members)
- No on-chain randomness for payout order; order is deterministic by join sequence
