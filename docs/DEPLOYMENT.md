# Deployment Guide

## Prerequisites

- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Node.js >= 18
- A funded wallet on Arbitrum Sepolia ([faucet](https://faucet.triangleplatform.com/arbitrum/sepolia))
- `.env` file with `RPC_URL` and `PRIVATE_KEY` (see `.env.example`)

## Deploy Contracts

```bash
cd packages/contracts

# Install dependencies
forge install

# Run tests
forge test

# Deploy to Arbitrum Sepolia
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

The broadcast receipts will be written to `broadcast/Deploy.s.sol/421614/`.

## Update Frontend Addresses

Copy the addresses printed after deployment into `packages/frontend/lib/contracts.ts`:

```ts
export const DEPLOYED_ADDRESSES = {
  identityRegistry:   '0x...',
  membershipVerifier: '0x...',
  frostVerifier:      '0x...',
  demoCircle:         '0x...',
} as const;
```

## Verify Contracts (Sourcify)

Sourcify requires no API key. Run the verification script:

```bash
cd packages/contracts
python3 scripts/verify-sourcify.py  # see broadcast/ for addresses
```

Or navigate to https://sourcify.dev/#/verifier and upload:
- `out/<ContractName>.sol/<ContractName>.json`

## Deploy Frontend

```bash
cd packages/frontend
npm install
npm run build   # verify build succeeds locally first
npx vercel --prod
```

## Live Deployment

| Contract           | Address                                      |
|--------------------|----------------------------------------------|
| IdentityRegistry   | `0x7306921da48Aac4e13Ec349d3ba085Cd21A58a75` |
| MembershipVerifier | `0xEfeE9c9339Fb9881F70bCCE8e8246aCb2Ed0E8C9` |
| FROSTVerifier      | `0x7217a46757cCbc9D3eCAfBC37ABa94078aa75571` |
| ROSCACircle (demo) | `0xfBb1AF442BB8E17EE2017BF2D83FC9783D55c798` |

Frontend: https://shroud-two.vercel.app
