// Deployed contract addresses — update after running Deploy.s.sol
// forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast --verify

// Deployed on Arbitrum Sepolia (chainId 421614) — block ~10491459
export const DEPLOYED_ADDRESSES = {
  identityRegistry: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  membershipVerifier: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  frostVerifier: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  demoCircle: '0x0000000000000000000000000000000000000000' as `0x${string}`,
} as const;

export const IDENTITY_REGISTRY_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "_poseidon2", "type": "address" }],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "bytes32", "name": "commitment", "type": "bytes32" },
      { "indexed": false, "internalType": "uint256", "name": "leafIndex",  "type": "uint256" },
      { "indexed": false, "internalType": "bytes32", "name": "newRoot",    "type": "bytes32" }
    ],
    "name": "IdentityRegistered",
    "type": "event"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "_commitment", "type": "bytes32" }],
    "name": "register",
    "outputs": [{ "internalType": "uint256", "name": "leafIndex", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getMerkleRoot",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "merkleRoot",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "leafCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "name": "commitmentExists",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
] as const;

export const ROSCA_CIRCLE_ABI = [
  {
    "inputs": [
      { "internalType": "address",  "name": "_verifier",         "type": "address"  },
      { "internalType": "address",  "name": "_frostVerifier",    "type": "address"  },
      { "internalType": "uint256",  "name": "_memberCount",      "type": "uint256"  },
      { "internalType": "uint256",  "name": "_contributionAmount","type": "uint256"  },
      { "internalType": "uint256",  "name": "_roundDuration",    "type": "uint256"  },
      { "internalType": "bytes32",  "name": "_merkleRoot",       "type": "bytes32"  },
      { "internalType": "uint256",  "name": "_circleId",         "type": "uint256"  },
      { "internalType": "uint256",  "name": "_thresholdPubKeyX", "type": "uint256"  },
      { "internalType": "uint256",  "name": "_thresholdPubKeyY", "type": "uint256"  }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      { "internalType": "uint256[2]",    "name": "_pA",         "type": "uint256[2]"   },
      { "internalType": "uint256[2][2]", "name": "_pB",         "type": "uint256[2][2]"},
      { "internalType": "uint256[2]",    "name": "_pC",         "type": "uint256[2]"   },
      { "internalType": "uint256[3]",    "name": "_pubSignals",  "type": "uint256[3]"  },
      { "internalType": "bytes32",       "name": "_pseudonym",   "type": "bytes32"     }
    ],
    "name": "joinCircle",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "_pseudonym", "type": "bytes32" }],
    "name": "contribute",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256",          "name": "_sigR",      "type": "uint256"  },
      { "internalType": "uint256",          "name": "_sigS",      "type": "uint256"  },
      { "internalType": "address payable",  "name": "_recipient", "type": "address"  }
    ],
    "name": "claimPayout",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "progressRound",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCircleInfo",
    "outputs": [
      { "internalType": "uint8",   "name": "_state",        "type": "uint8"   },
      { "internalType": "uint256", "name": "_joined",       "type": "uint256" },
      { "internalType": "uint256", "name": "_memberCount",  "type": "uint256" },
      { "internalType": "uint256", "name": "_currentRound", "type": "uint256" },
      { "internalType": "uint256", "name": "_totalRounds",  "type": "uint256" },
      { "internalType": "uint256", "name": "_balance",      "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "state",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentRound",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "joinedCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "memberCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "contributionAmount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "merkleRoot",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "circleId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "roundDeadline",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "name": "isMember",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "bytes32", "name": "pseudonym",   "type": "bytes32" },
      { "indexed": false, "internalType": "uint256", "name": "joinedCount", "type": "uint256" }
    ],
    "name": "MemberJoined",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "uint256", "name": "round",     "type": "uint256" },
      { "indexed": true,  "internalType": "address", "name": "recipient", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount",    "type": "uint256" }
    ],
    "name": "PayoutDisbursed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "newRound", "type": "uint256" }
    ],
    "name": "RoundAdvanced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [],
    "name": "CircleCompleted",
    "type": "event"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  },
] as const;

// Circle state enum (matches Solidity)
export enum CircleState {
  JOINING   = 0,
  ACTIVE    = 1,
  COMPLETED = 2,
}

export const STATE_LABELS: Record<number, string> = {
  [CircleState.JOINING]:   'JOINING',
  [CircleState.ACTIVE]:    'ACTIVE',
  [CircleState.COMPLETED]: 'COMPLETED',
};
