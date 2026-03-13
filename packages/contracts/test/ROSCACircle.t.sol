// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ROSCACircle.sol";
import "./mocks/MockMembershipVerifier.sol";
import "./mocks/MockFROSTVerifier.sol";

contract ROSCACircleTest is Test {
    MockMembershipVerifier mockVerifier;
    MockFROSTVerifier mockFrost;

    uint256 constant MEMBER_COUNT = 5;
    uint256 constant CONTRIBUTION = 0.1 ether;
    uint256 constant ROUND_DURATION = 7 days;
    bytes32 constant MERKLE_ROOT = bytes32(uint256(999));
    uint256 constant CIRCLE_ID = 1;
    uint256 constant PK_X = 1;
    uint256 constant PK_Y = 2;

    function _newCircle(bool verifierOk, bool frostOk) internal returns (ROSCACircle) {
        mockVerifier = new MockMembershipVerifier(verifierOk);
        mockFrost = new MockFROSTVerifier(frostOk);
        return new ROSCACircle(
            address(mockVerifier),
            address(mockFrost),
            MEMBER_COUNT,
            CONTRIBUTION,
            ROUND_DURATION,
            MERKLE_ROOT,
            CIRCLE_ID,
            PK_X,
            PK_Y
        );
    }

    function _joinMember(ROSCACircle circle, bytes32 pseudonym) internal {
        uint256[2] memory pA; uint256[2][2] memory pB; uint256[2] memory pC;
        // pubSignals snarkjs order: [nullifier, merkleRoot, circleId]
        uint256[3] memory pubSignals = [uint256(pseudonym), uint256(MERKLE_ROOT), CIRCLE_ID];
        circle.joinCircle(pA, pB, pC, pubSignals, pseudonym);
    }

    // ── Join tests ───────────────────────────────────────────────────────────

    function test_joinWithValidProof() public {
        ROSCACircle circle = _newCircle(true, true);
        assertEq(uint256(circle.state()), uint256(ROSCACircle.State.JOINING));

        _joinMember(circle, bytes32(uint256(1)));

        assertEq(circle.joinedCount(), 1);
        assertTrue(circle.isMember(bytes32(uint256(1))));
    }

    function test_rejectInvalidProof() public {
        ROSCACircle circle = _newCircle(false, true); // verifier returns false
        uint256[2] memory pA; uint256[2][2] memory pB; uint256[2] memory pC;
        // snarkjs order: [nullifier, merkleRoot, circleId]
        uint256[3] memory sigs = [uint256(10), uint256(MERKLE_ROOT), CIRCLE_ID];

        vm.expectRevert(ROSCACircle.InvalidProof.selector);
        circle.joinCircle(pA, pB, pC, sigs, bytes32(uint256(10)));
    }

    function test_rejectDuplicateNullifier() public {
        ROSCACircle circle = _newCircle(true, true);
        bytes32 pseudonymA = bytes32(uint256(1));
        bytes32 pseudonymB = bytes32(uint256(2));

        // Same nullifier (== pseudonym in our test pubSignals), different pseudonym
        uint256[2] memory pA; uint256[2][2] memory pB; uint256[2] memory pC;
        uint256 nullifier = uint256(99);
        // snarkjs order: [nullifier, merkleRoot, circleId]
        uint256[3] memory sigs = [nullifier, uint256(MERKLE_ROOT), CIRCLE_ID];

        circle.joinCircle(pA, pB, pC, sigs, pseudonymA);

        vm.expectRevert(ROSCACircle.NullifierUsed.selector);
        circle.joinCircle(pA, pB, pC, sigs, pseudonymB);
    }

    function test_rejectWrongRoot() public {
        ROSCACircle circle = _newCircle(true, true);
        uint256[2] memory pA; uint256[2][2] memory pB; uint256[2] memory pC;
        // snarkjs order: [nullifier, merkleRoot, circleId] — wrong merkleRoot at [1]
        uint256[3] memory sigs = [uint256(1), uint256(0xDEAD), CIRCLE_ID];

        vm.expectRevert(ROSCACircle.RootMismatch.selector);
        circle.joinCircle(pA, pB, pC, sigs, bytes32(uint256(1)));
    }

    function test_rejectWrongCircleId() public {
        ROSCACircle circle = _newCircle(true, true);
        uint256[2] memory pA; uint256[2][2] memory pB; uint256[2] memory pC;
        // snarkjs order: [nullifier, merkleRoot, circleId] — wrong circleId at [2]
        uint256[3] memory sigs = [uint256(1), uint256(MERKLE_ROOT), uint256(999)];

        vm.expectRevert(ROSCACircle.CircleMismatch.selector);
        circle.joinCircle(pA, pB, pC, sigs, bytes32(uint256(1)));
    }

    function test_rejectPseudonymTaken() public {
        ROSCACircle circle = _newCircle(true, true);
        bytes32 pseudonym = bytes32(uint256(1));
        _joinMember(circle, pseudonym);

        uint256[2] memory pA; uint256[2][2] memory pB; uint256[2] memory pC;
        // Different nullifier but same pseudonym — snarkjs order: [nullifier, merkleRoot, circleId]
        uint256[3] memory sigs = [uint256(999), uint256(MERKLE_ROOT), CIRCLE_ID];
        vm.expectRevert(ROSCACircle.PseudonymTaken.selector);
        circle.joinCircle(pA, pB, pC, sigs, pseudonym);
    }

    function test_transitionToActiveWhenFull() public {
        ROSCACircle circle = _newCircle(true, true);
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) {
            _joinMember(circle, bytes32(i));
        }
        assertEq(uint256(circle.state()), uint256(ROSCACircle.State.ACTIVE));
        assertEq(circle.currentRound(), 1);
    }

    // ── Contribute tests ─────────────────────────────────────────────────────

    function test_contribute() public {
        ROSCACircle circle = _newCircle(true, true);
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) _joinMember(circle, bytes32(i));

        bytes32 p = bytes32(uint256(1));
        circle.contribute{value: CONTRIBUTION}(p);

        assertTrue(circle.contributed(1, p));
        assertEq(circle.roundContribCount(1), 1);
    }

    function test_rejectWrongAmount() public {
        ROSCACircle circle = _newCircle(true, true);
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) _joinMember(circle, bytes32(i));

        vm.expectRevert(ROSCACircle.WrongAmount.selector);
        circle.contribute{value: 0.05 ether}(bytes32(uint256(1)));
    }

    function test_rejectDoubleContribution() public {
        ROSCACircle circle = _newCircle(true, true);
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) _joinMember(circle, bytes32(i));

        bytes32 p = bytes32(uint256(1));
        circle.contribute{value: CONTRIBUTION}(p);

        vm.expectRevert(ROSCACircle.AlreadyContributed.selector);
        circle.contribute{value: CONTRIBUTION}(p);
    }

    function test_rejectContributeWhenNotMember() public {
        ROSCACircle circle = _newCircle(true, true);
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) _joinMember(circle, bytes32(i));

        vm.expectRevert(ROSCACircle.NotMember.selector);
        circle.contribute{value: CONTRIBUTION}(bytes32(uint256(999)));
    }

    // ── Claim tests ──────────────────────────────────────────────────────────

    function test_claimPayout() public {
        ROSCACircle circle = _newCircle(true, true);
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) _joinMember(circle, bytes32(i));
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) {
            circle.contribute{value: CONTRIBUTION}(bytes32(i));
        }

        address payable recipient = payable(address(0xBEEF));
        uint256 balanceBefore = recipient.balance;

        circle.claimPayout(1, 1, recipient);

        assertEq(recipient.balance - balanceBefore, CONTRIBUTION * MEMBER_COUNT);
    }

    function test_rejectInvalidFROSTSig() public {
        mockVerifier = new MockMembershipVerifier(true);
        mockFrost = new MockFROSTVerifier(false); // FROST returns false
        ROSCACircle circle = new ROSCACircle(
            address(mockVerifier), address(mockFrost),
            MEMBER_COUNT, CONTRIBUTION, ROUND_DURATION,
            MERKLE_ROOT, CIRCLE_ID, PK_X, PK_Y
        );
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) _joinMember(circle, bytes32(i));
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) {
            circle.contribute{value: CONTRIBUTION}(bytes32(i));
        }

        vm.expectRevert(ROSCACircle.InvalidProof.selector);
        circle.claimPayout(1, 1, payable(address(0xBEEF)));
    }

    function test_rejectDoubleClaim() public {
        ROSCACircle circle = _newCircle(true, true);
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) _joinMember(circle, bytes32(i));
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) {
            circle.contribute{value: CONTRIBUTION}(bytes32(i));
        }

        address payable recipient = payable(address(0xBEEF));
        circle.claimPayout(1, 1, recipient);

        vm.expectRevert(ROSCACircle.AlreadyClaimed.selector);
        circle.claimPayout(1, 1, recipient);
    }

    // ── Round progression tests ──────────────────────────────────────────────

    function test_progressRound() public {
        ROSCACircle circle = _newCircle(true, true);
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) _joinMember(circle, bytes32(i));
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) {
            circle.contribute{value: CONTRIBUTION}(bytes32(i));
        }

        // Claim then progress
        circle.claimPayout(1, 1, payable(address(0xBEEF)));
        circle.progressRound();

        assertEq(circle.currentRound(), 2);
        assertEq(uint256(circle.state()), uint256(ROSCACircle.State.ACTIVE));
    }

    function test_progressRoundByDeadline() public {
        ROSCACircle circle = _newCircle(true, true);
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) _joinMember(circle, bytes32(i));
        // Only 1 member contributes, then deadline passes

        circle.contribute{value: CONTRIBUTION}(bytes32(uint256(1)));
        vm.warp(block.timestamp + ROUND_DURATION + 1);

        circle.progressRound(); // should succeed even without full contributions
        assertEq(circle.currentRound(), 2);
    }

    function test_rejectProgressBeforeComplete() public {
        ROSCACircle circle = _newCircle(true, true);
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) _joinMember(circle, bytes32(i));
        // No contributions, deadline not passed

        vm.expectRevert(ROSCACircle.RoundNotComplete.selector);
        circle.progressRound();
    }

    // ── Full lifecycle test ──────────────────────────────────────────────────

    function test_fullLifecycle() public {
        ROSCACircle circle = _newCircle(true, true);

        // Join all 5 members
        for (uint256 i = 1; i <= MEMBER_COUNT; i++) {
            _joinMember(circle, bytes32(i));
        }
        assertEq(uint256(circle.state()), uint256(ROSCACircle.State.ACTIVE));

        // Complete all 5 rounds
        for (uint256 round = 1; round <= MEMBER_COUNT; round++) {
            assertEq(circle.currentRound(), round);

            // All members contribute
            for (uint256 i = 1; i <= MEMBER_COUNT; i++) {
                circle.contribute{value: CONTRIBUTION}(bytes32(i));
            }

            // Claim payout
            address payable recipient = payable(address(uint160(0x1000 + round)));
            circle.claimPayout(1, 1, recipient);
            assertEq(recipient.balance, CONTRIBUTION * MEMBER_COUNT);

            // Progress to next round (or complete)
            circle.progressRound();
        }

        assertEq(uint256(circle.state()), uint256(ROSCACircle.State.COMPLETED));
    }
}
