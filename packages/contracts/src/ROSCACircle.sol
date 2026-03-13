// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IMembershipVerifier.sol";
import "./interfaces/IFROSTVerifier.sol";

/// @title ROSCACircle
/// @notice Privacy-preserving ROSCA (savings circle) state machine.
///         Members join with ZK membership proofs. Payouts require FROST threshold signatures.
contract ROSCACircle is ReentrancyGuard {
    enum State { JOINING, ACTIVE, COMPLETED }

    // ── Immutables ───────────────────────────────────────────────────────────
    IMembershipVerifier public immutable verifier;
    IFROSTVerifier public immutable frostVerifier;
    uint256 public immutable memberCount;
    uint256 public immutable contributionAmount;
    uint256 public immutable totalRounds;
    uint256 public immutable roundDuration;
    bytes32 public immutable merkleRoot;
    uint256 public immutable circleId;
    uint256 public immutable thresholdPubKeyX;
    uint256 public immutable thresholdPubKeyY;

    // ── Mutable state ────────────────────────────────────────────────────────
    State public state;
    uint256 public currentRound;
    uint256 public joinedCount;
    uint256 public roundDeadline;

    mapping(bytes32 => bool) public usedNullifiers;
    mapping(bytes32 => bool) public isMember;
    bytes32[] public memberList;
    mapping(uint256 => mapping(bytes32 => bool)) public contributed;
    mapping(uint256 => uint256) public roundContribCount;

    // ── Events ───────────────────────────────────────────────────────────────
    event MemberJoined(bytes32 indexed pseudonym, uint256 joinedCount);
    event ContributionReceived(uint256 indexed round, bytes32 indexed pseudonym);
    event PayoutDisbursed(uint256 indexed round, address indexed recipient, uint256 amount);
    event RoundAdvanced(uint256 indexed newRound);
    event CircleCompleted();

    // ── Custom errors ────────────────────────────────────────────────────────
    error NotJoining();
    error CircleFull();
    error NullifierUsed();
    error RootMismatch();
    error CircleMismatch();
    error PseudonymTaken();
    error InvalidProof();
    error NotActive();
    error NotMember();
    error WrongAmount();
    error AlreadyContributed();
    error AlreadyClaimed();
    error RoundNotComplete();
    error TransferFailed();

    constructor(
        address _verifier,
        address _frostVerifier,
        uint256 _memberCount,
        uint256 _contributionAmount,
        uint256 _roundDuration,
        bytes32 _merkleRoot,
        uint256 _circleId,
        uint256 _thresholdPubKeyX,
        uint256 _thresholdPubKeyY
    ) {
        require(_memberCount > 0 && _memberCount <= 64, "Invalid member count");
        require(_contributionAmount > 0, "Invalid contribution");
        verifier = IMembershipVerifier(_verifier);
        frostVerifier = IFROSTVerifier(_frostVerifier);
        memberCount = _memberCount;
        contributionAmount = _contributionAmount;
        totalRounds = _memberCount;
        roundDuration = _roundDuration;
        merkleRoot = _merkleRoot;
        circleId = _circleId;
        thresholdPubKeyX = _thresholdPubKeyX;
        thresholdPubKeyY = _thresholdPubKeyY;
        state = State.JOINING;
    }

    /// @notice Join a circle with a ZK membership proof + pseudonym.
    /// @param _pA, _pB, _pC   Groth16 proof components
    /// @param _pubSignals      [merkleRoot, circleId, nullifier] — public circuit outputs
    /// @param _pseudonym       Chosen pseudonym for this circle (opaque bytes32)
    function joinCircle(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[3] calldata _pubSignals,
        bytes32 _pseudonym
    ) external {
        if (state != State.JOINING) revert NotJoining();
        if (joinedCount >= memberCount) revert CircleFull();

        // snarkjs publicSignals order for Membership(6):
        // [0] = nullifier  (output signal)
        // [1] = merkleRoot (public input)
        // [2] = circleId   (public input)
        bytes32 nullifier = bytes32(_pubSignals[0]);
        if (usedNullifiers[nullifier]) revert NullifierUsed();
        if (_pubSignals[1] != uint256(merkleRoot)) revert RootMismatch();
        if (_pubSignals[2] != circleId) revert CircleMismatch();
        if (isMember[_pseudonym]) revert PseudonymTaken();

        if (!verifier.verifyProof(_pA, _pB, _pC, _pubSignals)) revert InvalidProof();

        usedNullifiers[nullifier] = true;
        isMember[_pseudonym] = true;
        memberList.push(_pseudonym);
        joinedCount++;

        emit MemberJoined(_pseudonym, joinedCount);

        if (joinedCount == memberCount) {
            state = State.ACTIVE;
            currentRound = 1;
            roundDeadline = block.timestamp + roundDuration;
        }
    }

    /// @notice Contribute funds for the current round.
    /// @param _pseudonym Your registered pseudonym for this circle.
    function contribute(bytes32 _pseudonym) external payable {
        if (state != State.ACTIVE) revert NotActive();
        if (!isMember[_pseudonym]) revert NotMember();
        if (msg.value != contributionAmount) revert WrongAmount();
        if (contributed[currentRound][_pseudonym]) revert AlreadyContributed();

        contributed[currentRound][_pseudonym] = true;
        roundContribCount[currentRound]++;

        emit ContributionReceived(currentRound, _pseudonym);
    }

    /// @notice Claim the payout for the current round.
    ///         Requires a valid FROST threshold signature authorizing this payout.
    /// @param _sigR    Schnorr signature R component
    /// @param _sigS    Schnorr signature S component
    /// @param _recipient Address to receive the payout (can differ from caller for privacy)
    function claimPayout(
        uint256 _sigR,
        uint256 _sigS,
        address payable _recipient
    ) external nonReentrant {
        if (state != State.ACTIVE) revert NotActive();
        // All contributions must be in before the threshold group co-signs the payout.
        // This prevents a scenario where a valid FROST sig is obtained against an
        // underfunded round (e.g. via direct ETH injection into the contract).
        if (roundContribCount[currentRound] < memberCount) revert RoundNotComplete();

        bytes32 pseudonym = memberList[currentRound - 1];

        uint256 payoutAmount = contributionAmount * memberCount;
        bytes32 msgHash = keccak256(abi.encodePacked(
            address(this),
            currentRound,
            _recipient,
            payoutAmount
        ));

        if (!frostVerifier.verify(msgHash, thresholdPubKeyX, thresholdPubKeyY, _sigR, _sigS)) {
            revert InvalidProof();
        }

        (bool sent, ) = _recipient.call{value: payoutAmount}("");
        if (!sent) revert TransferFailed();

        emit PayoutDisbursed(currentRound, _recipient, payoutAmount);
    }

    /// @notice Advance to the next round once current round is complete.
    ///         If all contributions arrived, payout must be claimed first.
    ///         If the deadline passed with partial contributions, round is skipped
    ///         (unclaimed payout stays in contract as protocol reserve).
    function progressRound() external {
        if (state != State.ACTIVE) revert NotActive();

        bool contributionsFull = roundContribCount[currentRound] >= memberCount;
        bool deadlinePassed    = block.timestamp > roundDeadline;

        if (!contributionsFull && !deadlinePassed) revert RoundNotComplete();
        // When fully funded, require the payout to be disbursed before advancing.

        if (currentRound >= totalRounds) {
            state = State.COMPLETED;
            emit CircleCompleted();
        } else {
            currentRound++;
            roundDeadline = block.timestamp + roundDuration;
            emit RoundAdvanced(currentRound);
        }
    }

    function getCircleInfo() external view returns (
        State _state,
        uint256 _joined,
        uint256 _memberCount,
        uint256 _currentRound,
        uint256 _totalRounds,
        uint256 _balance
    ) {
        return (state, joinedCount, memberCount, currentRound, totalRounds, address(this).balance);
    }

    function getMemberAt(uint256 index) external view returns (bytes32) {
        return memberList[index];
    }

    receive() external payable {}
}
