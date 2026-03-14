#!/bin/bash
# Generate a test proof from input.json
set -e

CIRCUIT=membership
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCUIT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD="$CIRCUIT_DIR/build"

if [ ! -f "$BUILD/${CIRCUIT}.zkey" ]; then
  echo "Error: zkey not found. Run compile.sh first."
  exit 1
fi

INPUT="${1:-$CIRCUIT_DIR/test/input.json}"

echo "Generating proof from: $INPUT"

snarkjs groth16 fullprove \
  "$INPUT" \
  "$BUILD/${CIRCUIT}_js/${CIRCUIT}.wasm" \
  "$BUILD/${CIRCUIT}.zkey" \
  "$BUILD/proof.json" \
  "$BUILD/public.json"

echo "Verifying proof..."
snarkjs groth16 verify \
  "$BUILD/verification_key.json" \
  "$BUILD/public.json" \
  "$BUILD/proof.json"

echo ""
echo "Solidity calldata:"
snarkjs generatecall "$BUILD/public.json" "$BUILD/proof.json"
