// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PoseidonDeployer.sol";

/// @title IdentityRegistry
/// @notice Incremental Poseidon Merkle tree for identity commitments.
///         Depth 6 → capacity 64 members. Poseidon hash matches circomlib exactly.
contract IdentityRegistry {
    uint256 public constant TREE_DEPTH = 6;
    uint256 public constant MAX_LEAVES = 1 << TREE_DEPTH; // 64

    /// @dev BN254 scalar field prime
    uint256 constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IPoseidon2 public immutable poseidon2;

    bytes32 public merkleRoot;
    uint256 public leafCount;

    /// @dev filledSubtrees[i] = the hash of the filled subtree at level i
    bytes32[TREE_DEPTH] public filledSubtrees;

    /// @dev zeros[i] = hash of an empty subtree of height i
    bytes32[TREE_DEPTH] public zeros;

    mapping(bytes32 => bool) public commitmentExists;

    event IdentityRegistered(
        bytes32 indexed commitment,
        uint256 leafIndex,
        bytes32 newRoot
    );

    constructor(address _poseidon2) {
        poseidon2 = IPoseidon2(_poseidon2);

        // Precompute zeros: zeros[0] = 0, zeros[i] = Poseidon(zeros[i-1], zeros[i-1])
        // This must match the zero values used in the client-side Merkle tree
        bytes32 zero = bytes32(0);
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            zeros[i] = zero;
            filledSubtrees[i] = zero;
            zero = _hash(zero, zero);
        }
        merkleRoot = zero;
    }

    /// @notice Register an identity commitment in the Merkle tree.
    /// @param _commitment Poseidon(msk) — computed client-side
    function register(bytes32 _commitment) external returns (uint256 leafIndex) {
        require(!commitmentExists[_commitment], "Commitment already registered");
        require(leafCount < MAX_LEAVES, "Identity tree is full");
        require(uint256(_commitment) < FIELD_SIZE, "Commitment out of field");

        leafIndex = leafCount;
        leafCount++;
        commitmentExists[_commitment] = true;

        // Incremental Merkle tree insertion
        bytes32 currentHash = _commitment;
        uint256 currentIndex = leafIndex;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                // Left child: pair with zero on the right
                filledSubtrees[i] = currentHash;
                currentHash = _hash(currentHash, zeros[i]);
            } else {
                // Right child: pair with filled subtree on the left
                currentHash = _hash(filledSubtrees[i], currentHash);
            }
            currentIndex /= 2;
        }

        merkleRoot = currentHash;
        emit IdentityRegistered(_commitment, leafIndex, merkleRoot);
    }

    /// @dev Poseidon(left, right) — uses deployed circomlibjs bytecode for exact compatibility
    function _hash(bytes32 left, bytes32 right) internal view returns (bytes32) {
        uint256[2] memory input = [uint256(left), uint256(right)];
        return bytes32(poseidon2.poseidon(input));
    }

    function getMerkleRoot() external view returns (bytes32) {
        return merkleRoot;
    }
}
