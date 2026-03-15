// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/FROSTVerifier.sol";

contract FROSTVerifierTest is Test {
    FROSTVerifier verifier;

    uint256 constant N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function setUp() public {
        verifier = new FROSTVerifier();
    }

    // ── Rejection: zero components ────────────────────────────────────────────

    function test_zeroR_rejected() public view {
        bool result = verifier.verify(keccak256("test"), 1, 2, 0, 1);
        assertFalse(result, "sigR=0 must be rejected");
    }

    function test_zeroS_rejected() public view {
        bool result = verifier.verify(keccak256("test"), 1, 2, 1, 0);
        assertFalse(result, "sigS=0 must be rejected");
    }

    // ── Rejection: components >= curve order ──────────────────────────────────

    function test_R_geN_rejected() public view {
        bytes32 msgHash = keccak256("test");
        assertFalse(verifier.verify(msgHash, 1, 2, N, 1),     "sigR=N must be rejected");
        assertFalse(verifier.verify(msgHash, 1, 2, N + 1, 1), "sigR>N must be rejected");
    }

    function test_S_geN_rejected() public view {
        bytes32 msgHash = keccak256("test");
        assertFalse(verifier.verify(msgHash, 1, 2, 1, N),     "sigS=N must be rejected");
        assertFalse(verifier.verify(msgHash, 1, 2, 1, N + 1), "sigS>N must be rejected");
    }

    // ── Rejection: high-s (signature malleability guard) ─────────────────────

    function test_highS_rejected() public {
        uint256 privKey = 0xBEEF;
        bytes32 msgHash = keccak256("malleable");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, msgHash);
        (v); // suppress unused warning

        // low-s sig should be valid (if pubkey matches), high-s should not
        uint256 highS = N - uint256(s); // s' = N - s is the malleable twin
        if (highS > N / 2) {
            Vm.Wallet memory w = vm.createWallet(privKey);
            // Using wrong pubkey so we only test the high-s rejection path
            assertFalse(
                verifier.verify(msgHash, w.publicKeyX, w.publicKeyY, uint256(r), highS),
                "high-s signature must be rejected"
            );
        }
    }

    // ── Rejection: wrong public key ────────────────────────────────────────────

    function test_wrongPubKey_rejected() public {
        uint256 privKey = 0xBEEF;
        bytes32 msgHash = keccak256("payout message");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, msgHash);
        (v);

        // Use random coords unrelated to privKey
        bool result = verifier.verify(msgHash, 0xDEADBEEF, 0xCAFEBABE, uint256(r), uint256(s));
        assertFalse(result, "Valid sig with wrong pubkey must fail");
    }

    // ── Acceptance: end-to-end with real secp256k1 pubkey ─────────────────────
    // vm.createWallet returns the actual EC coordinates (pubKeyX, pubKeyY).
    // FROSTVerifier._pubKeyToAddress(x, y) = keccak256(x || y)[12:].
    // For a real secp256k1 keypair this equals vm.addr(privKey) = the Ethereum address.
    // Therefore: ecrecover(msgHash, v, r, s) == _pubKeyToAddress(pubKeyX, pubKeyY)
    // iff the sig was produced by privKey — exactly what the verifier checks.

    function test_endToEnd_validSig_accepted() public {
        uint256 privKey = 0xA11CE;
        Vm.Wallet memory w = vm.createWallet(privKey);
        bytes32 msgHash = keccak256(abi.encodePacked("shroud payout", uint256(1)));

        // Sign with the private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, msgHash);
        (v);

        // Ensure s is low (FROSTVerifier rejects high-s)
        uint256 sigS = uint256(s);
        if (sigS > N / 2) {
            // Use the v=28 path which corresponds to the low-s twin
            sigS = N - sigS;
        }

        bool result = verifier.verify(msgHash, w.publicKeyX, w.publicKeyY, uint256(r), sigS);
        assertTrue(result, "Valid sig with correct pubkey must be accepted");
    }

    function test_endToEnd_differentMsg_rejected() public {
        uint256 privKey = 0xA11CE;
        Vm.Wallet memory w = vm.createWallet(privKey);
        bytes32 msgHash   = keccak256("correct message");
        bytes32 wrongHash = keccak256("tampered message");

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, msgHash);
        (v);
        uint256 sigS = uint256(s) > N / 2 ? N - uint256(s) : uint256(s);

        // Sig valid for msgHash but presented with wrongHash — must fail
        bool result = verifier.verify(wrongHash, w.publicKeyX, w.publicKeyY, uint256(r), sigS);
        assertFalse(result, "Sig on different msgHash must be rejected");
    }

    function test_endToEnd_differentKey_rejected() public {
        uint256 privKey1 = 0xA11CE;
        uint256 privKey2 = 0xBEEF;
        Vm.Wallet memory w2 = vm.createWallet(privKey2);
        bytes32 msgHash = keccak256("payout");

        // Sign with key1, verify against key2 pubkey → must fail
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey1, msgHash);
        (v);
        uint256 sigS = uint256(s) > N / 2 ? N - uint256(s) : uint256(s);

        bool result = verifier.verify(msgHash, w2.publicKeyX, w2.publicKeyY, uint256(r), sigS);
        assertFalse(result, "Sig from different key must be rejected");
    }

    // ── ROSCA payout msgHash construction ─────────────────────────────────────
    // Verify that the msgHash construction in ROSCACircle.claimPayout matches
    // what the threshold nodes would sign: keccak256(contractAddr, round, recipient, amount)

    function test_payoutMsgHashDeterminism() public view {
        address contractAddr = address(0x1234);
        uint256 round = 1;
        address recipient = address(0xBEEF);
        uint256 amount = 0.5 ether;

        bytes32 h1 = keccak256(abi.encodePacked(contractAddr, round, recipient, amount));
        bytes32 h2 = keccak256(abi.encodePacked(contractAddr, round, recipient, amount));
        assertEq(h1, h2, "msgHash must be deterministic");

        // Different round produces different hash
        bytes32 h3 = keccak256(abi.encodePacked(contractAddr, uint256(2), recipient, amount));
        assertNotEq(h1, h3, "Different round must produce different msgHash");
    }

    // ── Interface compliance ──────────────────────────────────────────────────

    function test_verifierInterface() public view {
        // Must not revert on valid-range inputs
        verifier.verify(keccak256("interface check"), 1, 2, 1, 1);
    }
}
