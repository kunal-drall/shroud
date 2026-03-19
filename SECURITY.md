# Shroud Protocol — Security Model

## Threat Model

### Actors

| Actor | Capabilities | Goal |
|---|---|---|
| **Sybil Attacker** | Creates multiple identities | Join circle multiple times, drain pool |
| **Curious Observer** | Reads all on-chain data | Link member identities across circles |
| **Malicious Member** | Valid circle member | Default without consequence, steal funds |
| **Compromised Node** | Controls <t threshold nodes | Forge payout signatures, steal funds |
| **Network Adversary** | Observes all network traffic | Correlate transaction timing with identity |

### Trust Assumptions

1. **BN254 Discrete Log Hardness** — Groth16 proofs are computationally sound
2. **secp256k1 Discrete Log Hardness** — FROST signatures are unforgeable
3. **Poseidon Collision Resistance** — Nullifiers are deterministic and unique
4. **Intel TDX Hardware Isolation** — TEE memory is inaccessible to host OS
5. **Honest Majority in Threshold Group** — At least t of n nodes are honest

## Threat Mitigations

### Sybil Attacks → ASC Nullifiers

**Threat**: Attacker registers multiple identities to join a circle multiple times and collect multiple payouts.

**Mitigation**: Deterministic nullifiers `nul = Poseidon(msk, circle_id)`. The same master key always produces the same nullifier for a given circle. The contract rejects duplicate nullifiers. To create a second identity, the attacker would need to register a second commitment in the IdR, which is gated by the Sybil resistance mechanism (deposit, proof-of-personhood, or social vouching).

**Residual Risk**: If the IdR Sybil resistance anchor is weak (e.g., small deposit), attackers can create multiple master keys cheaply.

### Fund Theft → FROST Threshold Custody

**Threat**: Attacker attempts to transfer pooled funds without authorization.

**Mitigation**: Funds are held at a threshold-controlled address. Disbursement requires a valid FROST signature from t-of-n threshold nodes. The FROSTVerifier contract rejects invalid signatures. Compromising fewer than t nodes is insufficient to forge a signature.

**Residual Risk**: If t or more threshold nodes are compromised simultaneously, funds can be stolen. TEE attestation raises the bar (requires hardware-level attacks), but does not eliminate risk.

### Identity Correlation → Multi-Verifier Unlinkability

**Threat**: Observer links the same user's participation across multiple circles.

**Mitigation**: Different `circle_id` values produce cryptographically unlinkable nullifiers from the same master key. The ZK proof reveals nothing about which Merkle leaf was used. An observer seeing nullifier `nul_A` in Circle A and `nul_B` in Circle B cannot determine if they belong to the same user.

**Residual Risk**: Transaction timing analysis and gas payment patterns could enable statistical correlation. Mitigation: users should use different addresses for different circles and contribute at varied times.

### Threshold Node Compromise → TEE + Redundancy

**Threat**: Attacker compromises a threshold node to extract its key share.

**Mitigation**: Key shares are held inside dstack CVMs (Intel TDX). Memory is hardware-encrypted; even the host operator cannot read share contents. Attestation quotes prove the node is running verified, unmodified code. Even if one node is compromised, the attacker still needs t-1 additional shares.

**Residual Risk**: Intel TDX side-channel attacks (academic, not practical at scale). Proactive secret sharing (periodic share refresh) eliminates long-term compromise risk.

### Smart Contract Vulnerabilities → Defense in Depth

**Threat**: Bug in Solidity contracts enables unauthorized fund extraction.

**Mitigation**:
- Foundry test suite with fuzzing and invariant testing
- Dual authorization: both ZK proof AND threshold signature required for any fund movement
- Minimal contract surface area (each contract has a single responsibility)
- OpenZeppelin base contracts for standard patterns (reentrancy guards, access control)
- Production: formal verification of core invariants and external audit

**Residual Risk**: Zero-day Solidity compiler bugs or EVM-level issues.

### ZK Proof Forgery → Groth16 Soundness

**Threat**: Attacker generates a valid proof without knowing a valid master secret key.

**Mitigation**: Groth16 is computationally sound under the KoE assumption on BN254. The circuit enforces that the prover knows `msk` such that `Poseidon(msk)` is in the Merkle tree and the nullifier is correctly derived.

**Residual Risk**: Compromise of the Powers of Tau trusted setup ceremony. Mitigation: use publicly verifiable multi-party ceremony (Hermez, Zcash).

## Composed Security

No single assumption failure compromises the full system:

| Failure | Anonymity | Fund Safety | Sybil Resistance |
|---|---|---|---|
| ZK break (BN254) | ❌ Lost | ✅ Intact | ❌ Lost |
| FROST break (secp256k1) | ✅ Intact | ❌ Lost | ✅ Intact |
| TEE break (TDX) | ✅ Intact | ⚠️ Degraded | ✅ Intact |
| All three | ❌ Lost | ❌ Lost | ❌ Lost |

## Known Limitations (Hackathon Scope)

1. **Trusted dealer for DKG**: Hackathon prototype uses simulated key generation. Production requires distributed DKG.
2. **IdR Sybil anchor not implemented**: Registration is currently permissionless. Production needs deposit or proof-of-personhood.
3. **Contribution privacy (P0)**: Amounts are visible on-chain; only identity is hidden. Full contribution privacy requires round-specific nullifiers (P1).
4. **No formal verification**: Contracts are tested but not formally verified. Required before mainnet.
5. **Network-level deanonymization**: Transaction timing and gas patterns not addressed. Requires relay network or batched submissions.

## Responsible Disclosure

If you discover a security vulnerability, please report it to: kunal@29projects.xyz
