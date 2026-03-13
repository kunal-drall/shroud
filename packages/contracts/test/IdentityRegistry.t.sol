// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/IdentityRegistry.sol";
import "../src/PoseidonDeployer.sol";

contract IdentityRegistryTest is Test {
    IdentityRegistry registry;

    function setUp() public {
        address p2 = PoseidonDeployer.deployPoseidon2();
        registry = new IdentityRegistry(p2);
    }

    function test_register() public {
        bytes32 commitment = bytes32(uint256(1));
        bytes32 rootBefore = registry.merkleRoot();

        uint256 idx = registry.register(commitment);

        bytes32 rootAfter = registry.merkleRoot();
        assertEq(idx, 0);
        assertEq(registry.leafCount(), 1);
        assertNotEq(rootAfter, rootBefore);
        assertTrue(registry.commitmentExists(commitment));
    }

    function test_rejectDuplicate() public {
        bytes32 commitment = bytes32(uint256(42));
        registry.register(commitment);

        vm.expectRevert("Commitment already registered");
        registry.register(commitment);
    }

    function test_multipleRegistrations() public {
        bytes32 prevRoot = registry.merkleRoot();
        for (uint256 i = 1; i <= 5; i++) {
            bytes32 c = bytes32(i);
            uint256 idx = registry.register(c);
            assertEq(idx, i - 1);
            bytes32 newRoot = registry.merkleRoot();
            assertNotEq(newRoot, prevRoot, "Root must change on each insert");
            prevRoot = newRoot;
        }
        assertEq(registry.leafCount(), 5);
    }

    function test_treeCapacity() public {
        // Fill all 64 slots
        for (uint256 i = 1; i <= 64; i++) {
            registry.register(bytes32(i));
        }
        assertEq(registry.leafCount(), 64);

        // 65th registration must revert
        vm.expectRevert("Identity tree is full");
        registry.register(bytes32(uint256(65)));
    }

    function test_commitmentOutOfField() public {
        // FIELD_SIZE itself is out of field
        uint256 fieldSize = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        vm.expectRevert("Commitment out of field");
        registry.register(bytes32(fieldSize));
    }

    function test_rootUpdatesIncrementally() public {
        registry.register(bytes32(uint256(1)));
        bytes32 root1 = registry.merkleRoot();

        registry.register(bytes32(uint256(2)));
        bytes32 root2 = registry.merkleRoot();

        registry.register(bytes32(uint256(3)));
        bytes32 root3 = registry.merkleRoot();

        assertNotEq(root1, root2);
        assertNotEq(root2, root3);
        assertNotEq(root1, root3);
    }

    function test_getMerkleRoot() public {
        bytes32 r1 = registry.getMerkleRoot();
        assertEq(r1, registry.merkleRoot());

        registry.register(bytes32(uint256(7)));
        bytes32 r2 = registry.getMerkleRoot();
        assertEq(r2, registry.merkleRoot());
        assertNotEq(r1, r2);
    }
}
