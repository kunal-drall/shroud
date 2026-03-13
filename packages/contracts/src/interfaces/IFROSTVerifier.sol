// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFROSTVerifier {
    function verify(
        bytes32 msgHash,
        uint256 pubKeyX,
        uint256 pubKeyY,
        uint256 sigR,
        uint256 sigS
    ) external view returns (bool);
}
