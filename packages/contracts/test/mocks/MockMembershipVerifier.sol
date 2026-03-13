// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../src/interfaces/IMembershipVerifier.sol";

contract MockMembershipVerifier is IMembershipVerifier {
    bool public shouldReturn;
    constructor(bool _shouldReturn) { shouldReturn = _shouldReturn; }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[3] calldata
    ) external view returns (bool) {
        return shouldReturn;
    }
}
