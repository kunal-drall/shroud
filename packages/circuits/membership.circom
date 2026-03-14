pragma circom 2.1.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/mux1.circom";
include "node_modules/circomlib/circuits/comparators.circom";

// Incremental Merkle tree membership checker using Poseidon
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    signal hashes[levels + 1];
    hashes[0] <== leaf;

    component hashers[levels];
    component mux[levels][2];

    for (var i = 0; i < levels; i++) {
        // pathIndices[i] must be 0 or 1
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        // Select left and right inputs based on path
        mux[i][0] = Mux1();
        mux[i][0].c[0] <== hashes[i];
        mux[i][0].c[1] <== pathElements[i];
        mux[i][0].s <== pathIndices[i];

        mux[i][1] = Mux1();
        mux[i][1].c[0] <== pathElements[i];
        mux[i][1].c[1] <== hashes[i];
        mux[i][1].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i][0].out;
        hashers[i].inputs[1] <== mux[i][1].out;
        hashes[i + 1] <== hashers[i].out;
    }

    root === hashes[levels];
}

template Membership(levels) {
    // Private inputs
    signal input msk;                    // Master secret key
    signal input pathElements[levels];   // Merkle proof siblings
    signal input pathIndices[levels];    // 0=left, 1=right at each level

    // Public inputs
    signal input merkleRoot;             // Current Identity Registry root
    signal input circleId;               // Unique circle identifier

    // Public output
    signal output nullifier;             // Deterministic, circle-specific

    // 1. Compute identity commitment = Poseidon(msk)
    component commitHasher = Poseidon(1);
    commitHasher.inputs[0] <== msk;

    // 2. Verify Merkle tree membership
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== commitHasher.out;
    tree.root <== merkleRoot;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // 3. Derive deterministic nullifier = Poseidon(msk, circleId)
    component nullHasher = Poseidon(2);
    nullHasher.inputs[0] <== msk;
    nullHasher.inputs[1] <== circleId;
    nullifier <== nullHasher.out;
}

// Main component: depth 6 = 64-member anonymity set
component main {public [merkleRoot, circleId]} = Membership(6);
