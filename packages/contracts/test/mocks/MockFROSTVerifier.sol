// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../src/interfaces/IFROSTVerifier.sol";

contract MockFROSTVerifier is IFROSTVerifier {
    bool public shouldReturn;
    constructor(bool _shouldReturn) { shouldReturn = _shouldReturn; }

    function verify(bytes32, uint256, uint256, uint256, uint256) external view returns (bool) {
        return shouldReturn;
    }
}
