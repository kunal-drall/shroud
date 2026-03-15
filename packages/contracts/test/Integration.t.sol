// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/IdentityRegistry.sol";
import "../src/ROSCACircle.sol";
import "../src/MembershipVerifier.sol";
import "../src/FROSTVerifier.sol";
import "../src/PoseidonDeployer.sol";

/// @title Integration
/// @notice End-to-end test using the REAL Groth16 MembershipVerifier and FROSTVerifier.
///         A valid ZK proof is generated via vm.ffi calling gen-proof.js (snarkjs).
///         This verifies the full stack: circuit → Solidity verifier → ROSCACircle.
///
/// @dev Requires ffi = true in foundry.toml (already set).
///      Run: forge test --match-contract IntegrationTest -vv
contract IntegrationTest is Test {
    Groth16Verifier  memberVerifier;
    FROSTVerifier    frostVerifier;
    IdentityRegistry registry;

    uint256 constant MEMBER_COUNT   = 1;   // single-member circle for simplicity
    uint256 constant CONTRIBUTION   = 0.1 ether;
    uint256 constant ROUND_DURATION = 7 days;
    uint256 constant CIRCLE_ID      = 1;

    // Foundry Anvil default key #0 — used as the FROST threshold signing key in tests
    uint256 constant FROST_PRIV_KEY =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 constant N =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    struct ProofData {
        uint256[2]      pA;
        uint256[2][2]   pB;
        uint256[2]      pC;
        uint256[3]      pubSignals; // snarkjs order: [nullifier, merkleRoot, circleId]
        bytes32         merkleRoot;
        bytes32         nullifier;
        uint256         circleId;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _generateProof() internal returns (ProofData memory d) {
        string[] memory cmd = new string[](2);
        cmd[0] = "node";
        cmd[1] = "scripts/gen-proof.js";
        bytes memory raw = vm.ffi(cmd);
        string memory json = string(raw);

        d.pA[0] = vm.parseJsonUint(json, ".pA[0]");
        d.pA[1] = vm.parseJsonUint(json, ".pA[1]");
        d.pB[0][0] = vm.parseJsonUint(json, ".pB[0][0]");
        d.pB[0][1] = vm.parseJsonUint(json, ".pB[0][1]");
        d.pB[1][0] = vm.parseJsonUint(json, ".pB[1][0]");
        d.pB[1][1] = vm.parseJsonUint(json, ".pB[1][1]");
        d.pC[0] = vm.parseJsonUint(json, ".pC[0]");
        d.pC[1] = vm.parseJsonUint(json, ".pC[1]");
        d.pubSignals[0] = vm.parseJsonUint(json, ".pubSignals[0]");
        d.pubSignals[1] = vm.parseJsonUint(json, ".pubSignals[1]");
        d.pubSignals[2] = vm.parseJsonUint(json, ".pubSignals[2]");
        d.merkleRoot = vm.parseJsonBytes32(json, ".merkleRoot");
        d.nullifier  = vm.parseJsonBytes32(json, ".nullifier");
        d.circleId   = vm.parseJsonUint(json, ".circleId");
    }

    function _signPayout(
        address circleAddr,
        uint256 round,
        address recipient,
        uint256 amount
    ) internal view returns (uint256 sigR, uint256 sigS) {
        bytes32 msgHash = keccak256(
            abi.encodePacked(circleAddr, round, recipient, amount)
        );
        (, bytes32 r, bytes32 s) = vm.sign(FROST_PRIV_KEY, msgHash);
        sigR = uint256(r);
        sigS = uint256(s);
        if (sigS > N / 2) sigS = N - sigS; // canonical low-s
    }

    function setUp() public {
        address p2     = PoseidonDeployer.deployPoseidon2();
        memberVerifier = new Groth16Verifier();
        frostVerifier  = new FROSTVerifier();
        registry       = new IdentityRegistry(p2);
    }

    // ── Unit: real verifier accepts valid proof ────────────────────────────────

    function test_realProof_verifiedOnChain() public {
        ProofData memory d = _generateProof();
        bool ok = memberVerifier.verifyProof(d.pA, d.pB, d.pC, d.pubSignals);
        assertTrue(ok, "Real MembershipVerifier must accept valid Groth16 proof");
    }

    function test_realProof_pubSignalsOrdered() public {
        ProofData memory d = _generateProof();
        // snarkjs order: [0]=nullifier, [1]=merkleRoot, [2]=circleId
        assertEq(bytes32(d.pubSignals[0]), d.nullifier,  "pubSignals[0] must be nullifier");
        assertEq(bytes32(d.pubSignals[1]), d.merkleRoot, "pubSignals[1] must be merkleRoot");
        assertEq(d.pubSignals[2],          d.circleId,   "pubSignals[2] must be circleId");
    }

    function test_tamperedProof_rejected() public {
        ProofData memory d = _generateProof();
        d.pA[0] = d.pA[0] ^ 1; // flip one bit
        bool ok = memberVerifier.verifyProof(d.pA, d.pB, d.pC, d.pubSignals);
        assertFalse(ok, "Tampered proof must be rejected");
    }

    function test_tamperedPubSignals_rejected() public {
        ProofData memory d = _generateProof();
        d.pubSignals[2] = d.pubSignals[2] + 1; // wrong circleId
        bool ok = memberVerifier.verifyProof(d.pA, d.pB, d.pC, d.pubSignals);
        assertFalse(ok, "Tampered pubSignals must be rejected");
    }

    // ── Full lifecycle: ZK proof → join → contribute → claim → complete ────────

    function test_fullROSCAWithRealVerifiers() public {
        ProofData memory d = _generateProof();
        Vm.Wallet memory frostWallet = vm.createWallet(FROST_PRIV_KEY);

        ROSCACircle circle = new ROSCACircle(
            address(memberVerifier),
            address(frostVerifier),
            MEMBER_COUNT,
            CONTRIBUTION,
            ROUND_DURATION,
            d.merkleRoot,
            d.circleId,
            frostWallet.publicKeyX,
            frostWallet.publicKeyY
        );

        // Join with real proof
        bytes32 pseudonym = d.nullifier;
        circle.joinCircle(d.pA, d.pB, d.pC, d.pubSignals, pseudonym);
        assertEq(uint256(circle.state()), uint256(ROSCACircle.State.ACTIVE));

        // Contribute
        circle.contribute{value: CONTRIBUTION}(pseudonym);

        // Claim with real FROST sig
        address payable recipient = payable(address(0xBEEF));
        uint256 payout = CONTRIBUTION * MEMBER_COUNT;
        (uint256 sigR, uint256 sigS) = _signPayout(address(circle), 1, recipient, payout);

        uint256 before = recipient.balance;
        circle.claimPayout(sigR, sigS, recipient);
        assertEq(recipient.balance - before, payout);

        // Complete
        circle.progressRound();
        assertEq(uint256(circle.state()), uint256(ROSCACircle.State.COMPLETED));
    }

    // ── Security: nullifier replay rejected ───────────────────────────────────

    function test_nullifierReplay_rejected() public {
        ProofData memory d = _generateProof();
        Vm.Wallet memory frostWallet = vm.createWallet(FROST_PRIV_KEY);

        // 2-member circle so second join is possible
        ROSCACircle circle = new ROSCACircle(
            address(memberVerifier),
            address(frostVerifier),
            2,
            CONTRIBUTION,
            ROUND_DURATION,
            d.merkleRoot,
            d.circleId,
            frostWallet.publicKeyX,
            frostWallet.publicKeyY
        );

        circle.joinCircle(d.pA, d.pB, d.pC, d.pubSignals, d.nullifier);

        // Same proof, different pseudonym → NullifierUsed
        bytes32 altPseudonym = bytes32(uint256(d.nullifier) ^ 1);
        vm.expectRevert(ROSCACircle.NullifierUsed.selector);
        circle.joinCircle(d.pA, d.pB, d.pC, d.pubSignals, altPseudonym);
    }

    // ── Security: wrong merkleRoot rejected ───────────────────────────────────

    function test_wrongMerkleRoot_rejected() public {
        ProofData memory d = _generateProof();
        Vm.Wallet memory frostWallet = vm.createWallet(FROST_PRIV_KEY);

        // Circle deployed with a DIFFERENT merkleRoot than the proof
        bytes32 wrongRoot = bytes32(uint256(d.merkleRoot) ^ 0xff);
        ROSCACircle circle = new ROSCACircle(
            address(memberVerifier),
            address(frostVerifier),
            1,
            CONTRIBUTION,
            ROUND_DURATION,
            wrongRoot, // mismatch
            d.circleId,
            frostWallet.publicKeyX,
            frostWallet.publicKeyY
        );

        vm.expectRevert(ROSCACircle.RootMismatch.selector);
        circle.joinCircle(d.pA, d.pB, d.pC, d.pubSignals, d.nullifier);
    }

    // ── Security: claimPayout requires full contributions ─────────────────────

    function test_claimBeforeAllContributions_rejected() public {
        ProofData memory d = _generateProof();
        Vm.Wallet memory frostWallet = vm.createWallet(FROST_PRIV_KEY);

        // 2-member circle, only 1 joins (stays JOINING)
        // Use a fresh 1-member circle but don't contribute before claiming
        ROSCACircle circle = new ROSCACircle(
            address(memberVerifier),
            address(frostVerifier),
            1,
            CONTRIBUTION,
            ROUND_DURATION,
            d.merkleRoot,
            d.circleId,
            frostWallet.publicKeyX,
            frostWallet.publicKeyY
        );

        circle.joinCircle(d.pA, d.pB, d.pC, d.pubSignals, d.nullifier);
        assertEq(uint256(circle.state()), uint256(ROSCACircle.State.ACTIVE));

        // No contribution yet — claimPayout must revert
        address payable recipient = payable(address(0xBEEF));
        uint256 payout = CONTRIBUTION * 1;
        (uint256 sigR, uint256 sigS) = _signPayout(address(circle), 1, recipient, payout);

        vm.expectRevert(ROSCACircle.RoundNotComplete.selector);
        circle.claimPayout(sigR, sigS, recipient);
    }

    // ── Security: FROST sig on wrong amount rejected ──────────────────────────

    function test_wrongPayoutAmount_rejected() public {
        ProofData memory d = _generateProof();
        Vm.Wallet memory frostWallet = vm.createWallet(FROST_PRIV_KEY);

        ROSCACircle circle = new ROSCACircle(
            address(memberVerifier),
            address(frostVerifier),
            1,
            CONTRIBUTION,
            ROUND_DURATION,
            d.merkleRoot,
            d.circleId,
            frostWallet.publicKeyX,
            frostWallet.publicKeyY
        );

        circle.joinCircle(d.pA, d.pB, d.pC, d.pubSignals, d.nullifier);
        circle.contribute{value: CONTRIBUTION}(d.nullifier);

        address payable recipient = payable(address(0xBEEF));
        // Sign for wrong amount (half of expected)
        uint256 wrongAmount = CONTRIBUTION / 2;
        (uint256 sigR, uint256 sigS) = _signPayout(address(circle), 1, recipient, wrongAmount);

        vm.expectRevert(ROSCACircle.InvalidProof.selector);
        circle.claimPayout(sigR, sigS, recipient);
    }
}
