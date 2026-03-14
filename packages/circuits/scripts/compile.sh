#!/bin/bash
# Shroud Protocol — Circuit Compile + Trusted Setup
set -e

CIRCUIT=membership
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCUIT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD="$CIRCUIT_DIR/build"
CONTRACTS_SRC="$CIRCUIT_DIR/../contracts/src"

echo "=== Shroud Circuit Compiler ==="
echo "Circuit dir: $CIRCUIT_DIR"
echo "Build dir:   $BUILD"

mkdir -p "$BUILD"
mkdir -p "$CONTRACTS_SRC"

# ── Step 1: Compile circuit ─────────────────────────────────────────────────
echo ""
echo "► Step 1: Compiling $CIRCUIT.circom..."
cd "$CIRCUIT_DIR"
# Must run from repo root (where node_modules/circomlib lives)
# The circuit uses include "node_modules/circomlib/..." so -l points to repo root
REPO_ROOT="$(dirname "$(dirname "$(dirname "$CIRCUIT_DIR")")")"
cd "$REPO_ROOT"
circom "packages/circuits/$CIRCUIT.circom" \
  --r1cs \
  --wasm \
  --sym \
  -o "$BUILD" \
  -l .

echo "  Constraints:"
snarkjs r1cs info "$BUILD/$CIRCUIT.r1cs"

# ── Step 2: Generate or reuse Powers of Tau ─────────────────────────────────
# pot12 supports up to 2^12 = 4096 constraints (circuit uses 1,911).
# We generate locally via a deterministic beacon — no S3 download needed.
PTAU="$BUILD/pot12.ptau"
if [ ! -f "$PTAU" ]; then
  echo ""
  echo "► Step 2: Generating Powers of Tau (pot12, local ceremony)..."
  snarkjs powersoftau new bn128 12 "$BUILD/pot12_new.ptau" -v
  snarkjs powersoftau beacon \
    "$BUILD/pot12_new.ptau" "$BUILD/pot12_beacon.ptau" \
    0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="shroud"
  snarkjs pt2 "$BUILD/pot12_beacon.ptau" "$BUILD/pot12.ptau"
else
  echo ""
  echo "► Step 2: Powers of Tau already present ($PTAU), skipping."
fi

# ── Step 3: Groth16 setup ────────────────────────────────────────────────────
echo ""
echo "► Step 3: Groth16 trusted setup..."
snarkjs groth16 setup \
  "$BUILD/$CIRCUIT.r1cs" \
  "$PTAU" \
  "$BUILD/${CIRCUIT}_0.zkey"

# ── Step 4: Contribute randomness ───────────────────────────────────────────
echo ""
echo "► Step 4: Contributing randomness (hackathon ceremony)..."
echo "shroud-hackathon-contribution" | \
  snarkjs zkey contribute \
    "$BUILD/${CIRCUIT}_0.zkey" \
    "$BUILD/${CIRCUIT}.zkey" \
    --name="shroud-hackathon" \
    -v

# ── Step 5: Export verification key ─────────────────────────────────────────
echo ""
echo "► Step 5: Exporting verification key..."
snarkjs zkey export verificationkey \
  "$BUILD/${CIRCUIT}.zkey" \
  "$BUILD/verification_key.json"

# ── Step 6: Generate Solidity verifier ──────────────────────────────────────
echo ""
echo "► Step 6: Generating Solidity verifier..."
snarkjs zkey export solidityverifier \
  "$BUILD/${CIRCUIT}.zkey" \
  "$CONTRACTS_SRC/MembershipVerifier.sol"

echo ""
echo "✓ Done! Artifacts:"
echo "  $BUILD/$CIRCUIT.r1cs"
echo "  $BUILD/${CIRCUIT}_js/membership.wasm"
echo "  $BUILD/${CIRCUIT}.zkey"
echo "  $BUILD/verification_key.json"
echo "  $CONTRACTS_SRC/MembershipVerifier.sol"
