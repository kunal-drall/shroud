// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PoseidonDeployer.sol";
import "../src/IdentityRegistry.sol";
import "../src/FROSTVerifier.sol";
import "../src/ROSCACircle.sol";
import "../src/MembershipVerifier.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        // 1. Deploy Poseidon libraries (circomlibjs-compatible bytecode)
        address poseidon1 = PoseidonDeployer.deployPoseidon1();
        address poseidon2 = PoseidonDeployer.deployPoseidon2();
        console.log("PoseidonT2 (1-input):", poseidon1);
        console.log("PoseidonT3 (2-input):", poseidon2);

        // 2. Deploy MembershipVerifier (auto-generated from snarkjs trusted setup)
        Groth16Verifier membershipVerifier = new Groth16Verifier();
        console.log("MembershipVerifier:", address(membershipVerifier));

        // 3. Deploy FROSTVerifier
        FROSTVerifier frostVerifier = new FROSTVerifier();
        console.log("FROSTVerifier:", address(frostVerifier));

        // 4. Deploy IdentityRegistry
        IdentityRegistry registry = new IdentityRegistry(poseidon2);
        console.log("IdentityRegistry:", address(registry));

        // 5. Register a demo identity commitment for the example circle
        // In production this is done by each user client-side
        // Demo: commitment = Poseidon(42) as a placeholder
        // (actual value computed off-chain by the user)

        // 6. Deploy example ROSCACircle
        // Threshold pubkey: for demo, use Ethereum address derived from test key
        // In production this is the FROST aggregated threshold public key from Thetacrypt
        uint256 demoPubKeyX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798; // secp256k1 generator X
        uint256 demoPubKeyY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8; // secp256k1 generator Y

        bytes32 demoRoot = registry.getMerkleRoot(); // start with empty tree root

        ROSCACircle demoCircle = new ROSCACircle(
            address(membershipVerifier),
            address(frostVerifier),
            5,              // 5 members
            0.01 ether,     // 0.01 ETH contribution per round
            7 days,         // 7-day round duration
            demoRoot,       // Merkle root at deploy time
            uint256(keccak256("shroud-demo-circle-1")), // circleId
            demoPubKeyX,
            demoPubKeyY
        );
        console.log("ROSCACircle (demo):", address(demoCircle));

        vm.stopBroadcast();

        // Print summary
        console.log("\n=== Shroud Protocol Deployment Summary ===");
        console.log("Network: Arbitrum Sepolia (chainId 421614)");
        console.log("PoseidonT2:          ", poseidon1);
        console.log("PoseidonT3:          ", poseidon2);
        console.log("MembershipVerifier:  ", address(membershipVerifier));
        console.log("FROSTVerifier:       ", address(frostVerifier));
        console.log("IdentityRegistry:    ", address(registry));
        console.log("ROSCACircle (demo):  ", address(demoCircle));
    }
}
