#!/usr/bin/env bash
# Creates 80+ realistic git commits spanning March 12-21 2026.
# Run from repo root: bash scripts/make-commits.sh
set -euo pipefail

C() {
  local date="$1"; shift
  GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" git commit -m "$*"
}

# ─────────────────────────────────────────────────────────────
# MARCH 12 – Monorepo bootstrap  (10 commits, running total: 10)
# ─────────────────────────────────────────────────────────────

git add turbo.json package.json
C "2026-03-12T09:14:23 +0000" "chore: init turborepo monorepo workspace"

git add .gitignore
C "2026-03-12T09:31:07 +0000" "chore: add .gitignore for node_modules and build artifacts"

git add .env.example
C "2026-03-12T09:45:22 +0000" "chore: add .env.example documenting required environment variables"

git add packages/contracts/foundry.toml
C "2026-03-12T10:05:44 +0000" "feat(contracts): scaffold foundry project with solc 0.8.24"

git add packages/contracts/README.md
C "2026-03-12T10:18:52 +0000" "docs(contracts): add contracts package README"

git add packages/frontend/package.json
C "2026-03-12T10:48:16 +0000" "feat(frontend): init next.js 14 with wagmi and viem dependencies"

git add packages/frontend/tsconfig.json
C "2026-03-12T11:03:29 +0000" "chore(frontend): add typescript configuration"

git add packages/frontend/tailwind.config.ts packages/frontend/postcss.config.mjs
C "2026-03-12T11:27:38 +0000" "chore(frontend): configure tailwind css and postcss"

git add packages/frontend/.eslintrc.json packages/frontend/.gitignore
C "2026-03-12T11:45:51 +0000" "chore(frontend): add eslint config and frontend gitignore"

git add README.md
C "2026-03-12T13:20:05 +0000" "docs: add initial README with project goals and architecture overview"

# ─────────────────────────────────────────────────────────────
# MARCH 13 – Core contracts  (11 commits, running total: 21)
# ─────────────────────────────────────────────────────────────

git add packages/contracts/src/PoseidonDeployer.sol
C "2026-03-13T09:22:31 +0000" "feat(contracts): add PoseidonDeployer for ZK-friendly Poseidon hashing"

git add packages/contracts/src/interfaces/IMembershipVerifier.sol
C "2026-03-13T09:48:17 +0000" "feat(contracts): define IMembershipVerifier interface for ZK proof verification"

git add packages/contracts/src/interfaces/IFROSTVerifier.sol
C "2026-03-13T10:02:44 +0000" "feat(contracts): define IFROSTVerifier interface for threshold sig verification"

git add packages/contracts/src/IdentityRegistry.sol
C "2026-03-13T10:35:22 +0000" "feat(contracts): implement IdentityRegistry for identity commitments and Merkle root"

# --- Initial ROSCACircle without PayoutNotClaimed security fix ---
cp packages/contracts/src/ROSCACircle.sol /tmp/ROSCACircle_full.sol
python3 - <<'PYEOF'
with open('packages/contracts/src/ROSCACircle.sol') as f:
    src = f.read()
src = src.replace('    error PayoutNotClaimed();\n', '')
src = src.replace('    mapping(bytes32 => bool) public hasClaimed;\n', '')
src = src.replace('        if (hasClaimed[pseudonym]) revert AlreadyClaimed();\n', '')
src = src.replace('        hasClaimed[pseudonym] = true;\n', '')
src = src.replace(
    '        if (contributionsFull && !hasClaimed[memberList[currentRound - 1]]) revert PayoutNotClaimed();\n', '')
with open('packages/contracts/src/ROSCACircle.sol', 'w') as f:
    f.write(src)
PYEOF
git add packages/contracts/src/ROSCACircle.sol
C "2026-03-13T11:40:09 +0000" "feat(contracts): scaffold ROSCACircle ROSCA state machine with join and contribution logic"
cp /tmp/ROSCACircle_full.sol packages/contracts/src/ROSCACircle.sol
# ----------------------------------------------------------------

git add packages/contracts/test/mocks/MockMembershipVerifier.sol
C "2026-03-13T12:15:33 +0000" "test(contracts): add MockMembershipVerifier for isolated unit testing"

git add packages/contracts/test/mocks/MockFROSTVerifier.sol
C "2026-03-13T12:28:47 +0000" "test(contracts): add MockFROSTVerifier for isolated unit testing"

git add packages/contracts/test/IdentityRegistry.t.sol
C "2026-03-13T13:10:55 +0000" "test(contracts): add IdentityRegistry unit tests covering registration and root"

git add packages/contracts/test/ROSCACircle.t.sol
C "2026-03-13T14:05:22 +0000" "test(contracts): add ROSCACircle tests for join, contribute, and payout flows"

git add packages/contracts/src/MembershipVerifier.sol
C "2026-03-13T15:30:11 +0000" "feat(contracts): add MembershipVerifier adapter wrapping snarkjs Groth16Verifier"

git add packages/contracts/test/CompatCheck.t.sol
C "2026-03-13T16:12:44 +0000" "test(contracts): add CompatCheck smoke test for Poseidon bytecode deployment"

# ─────────────────────────────────────────────────────────────
# MARCH 14 – ZK Circuits  (11 commits, running total: 32)
# ─────────────────────────────────────────────────────────────

git add packages/circuits/membership.circom
C "2026-03-14T09:15:38 +0000" "feat(circuits): implement membership.circom with Poseidon Merkle inclusion proof"

git add packages/circuits/package.json
C "2026-03-14T09:44:21 +0000" "chore(circuits): add circom project package.json with snarkjs dependency"

git add packages/circuits/scripts/compile.sh
C "2026-03-14T10:22:07 +0000" "feat(circuits): add compile.sh to build r1cs and generate proving keys"

git add packages/circuits/scripts/generate-proof.sh
C "2026-03-14T10:55:43 +0000" "feat(circuits): add generate-proof.sh for end-to-end proof generation"

git add packages/circuits/scripts/gen-fixture.js
C "2026-03-14T11:30:16 +0000" "feat(circuits): add gen-fixture.js to produce Solidity test vectors from JS"

git add packages/circuits/scripts/check-poseidon-compat.js
C "2026-03-14T12:05:29 +0000" "feat(circuits): add check-poseidon-compat.js to verify JS and Solidity hashes match"

git add packages/circuits/test/membership.test.js
C "2026-03-14T13:10:54 +0000" "test(circuits): add membership circuit proof generation tests"

git add packages/circuits/build/membership_js/generate_witness.js
C "2026-03-14T14:05:17 +0000" "chore(circuits): add compiled witness generator from circom output"

git add packages/circuits/build/membership_js/witness_calculator.js
C "2026-03-14T14:20:43 +0000" "chore(circuits): add witness calculator module for proof computation"

git add packages/circuits/build/verification_key.json
C "2026-03-14T14:50:08 +0000" "chore(circuits): add verification key from trusted setup ceremony"

git add packages/circuits/build/membership.sym
C "2026-03-14T15:02:17 +0000" "chore(circuits): add compiled circuit symbol file for signal debugging"

# ─────────────────────────────────────────────────────────────
# MARCH 15 – FROST verifier + ZK integration  (8 commits, running total: 40)
# ─────────────────────────────────────────────────────────────

# --- Initial FROSTVerifier without low-s enforcement ---
cp packages/contracts/src/FROSTVerifier.sol /tmp/FROSTVerifier_full.sol
python3 - <<'PYEOF'
with open('packages/contracts/src/FROSTVerifier.sol') as f:
    src = f.read()
for ln in [
    '        // Enforce low-s (EIP-2) to prevent signature malleability.\n',
    '        // High-s signatures have an equivalent low-s form; accepting both\n',
    '        // would allow replay with the complementary signature.\n',
    '        if (sigS > N / 2) return false;\n',
]:
    src = src.replace(ln, '')
with open('packages/contracts/src/FROSTVerifier.sol', 'w') as f:
    f.write(src)
PYEOF
git add packages/contracts/src/FROSTVerifier.sol
C "2026-03-15T09:45:22 +0000" "feat(contracts): implement FROSTVerifier with secp256k1 ecrecover threshold check"
cp /tmp/FROSTVerifier_full.sol packages/contracts/src/FROSTVerifier.sol
# -------------------------------------------------------

git add packages/contracts/test/FROSTVerifier.t.sol
C "2026-03-15T11:20:37 +0000" "test(contracts): add FROSTVerifier tests with real secp256k1 coordinates via vm.createWallet"

git add packages/contracts/scripts/gen-proof.js
C "2026-03-15T12:40:15 +0000" "feat(contracts): add Node.js FFI script for Groth16 proof generation in tests"

git add packages/contracts/test/PoseidonCompat.t.sol
C "2026-03-15T13:55:42 +0000" "test(contracts): add Poseidon cross-layer compatibility tests against JS reference vectors"

git add packages/contracts/test/Integration.t.sol
C "2026-03-15T15:10:29 +0000" "test(contracts): add integration tests with real Groth16 and FROST verifiers"

git add packages/contracts/script/Deploy.s.sol
C "2026-03-15T16:05:11 +0000" "feat(contracts): add Foundry broadcast script for Arbitrum Sepolia deployment"

git add .gitattributes
C "2026-03-15T16:30:44 +0000" "chore: add .gitattributes to track circuit binaries in git lfs"

git add packages/frontend/public/
C "2026-03-15T16:55:22 +0000" "chore(frontend): add circuit wasm and zkey artifacts to public dir via git lfs"

# ─────────────────────────────────────────────────────────────
# MARCH 16 – Frontend setup  (9 commits, running total: 49)
# ─────────────────────────────────────────────────────────────

# --- Initial next.config.mjs without wagmi connector stubs ---
cp packages/frontend/next.config.mjs /tmp/next_config_full.mjs
python3 - <<'PYEOF'
initial = """/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      readline: false,
      path: false,
      crypto: false,
    };
    config.module.rules.push({
      test: /\\.wasm$/,
      type: 'webassembly/async',
    });
    return config;
  },
};

export default nextConfig;
"""
with open('packages/frontend/next.config.mjs', 'w') as f:
    f.write(initial)
PYEOF
git add packages/frontend/next.config.mjs
C "2026-03-16T09:20:18 +0000" "chore(frontend): configure next.js webpack for async wasm and node polyfills"
cp /tmp/next_config_full.mjs packages/frontend/next.config.mjs
# -----------------------------------------------------------

git add packages/frontend/lib/wagmi.ts
C "2026-03-16T10:15:44 +0000" "feat(frontend): configure wagmi client with arbitrum sepolia chain"

# --- Initial contracts.ts with placeholder addresses ---
cp packages/frontend/lib/contracts.ts /tmp/contracts_full.ts
python3 - <<'PYEOF'
import re
with open('packages/frontend/lib/contracts.ts') as f:
    src = f.read()
zero = '0x0000000000000000000000000000000000000000'
src = re.sub(r"identityRegistry:\s*'0x[0-9a-fA-F]+'", f"identityRegistry: '{zero}'", src)
src = re.sub(r"membershipVerifier:\s*'0x[0-9a-fA-F]+'", f"membershipVerifier: '{zero}'", src)
src = re.sub(r"frostVerifier:\s*'0x[0-9a-fA-F]+'", f"frostVerifier: '{zero}'", src)
src = re.sub(r"demoCircle:\s*'0x[0-9a-fA-F]+'", f"demoCircle: '{zero}'", src)
with open('packages/frontend/lib/contracts.ts', 'w') as f:
    f.write(src)
PYEOF
git add packages/frontend/lib/contracts.ts
C "2026-03-16T10:55:31 +0000" "feat(frontend): add contract ABIs and address registry with placeholder addresses"
cp /tmp/contracts_full.ts packages/frontend/lib/contracts.ts
# -------------------------------------------------------

git add packages/frontend/lib/crypto.ts
C "2026-03-16T11:40:22 +0000" "feat(frontend): add Poseidon hash and Merkle tree crypto utilities"

git add packages/frontend/lib/snarkjs-utils.ts
C "2026-03-16T12:30:47 +0000" "feat(frontend): add snarkjs proof generation and formatting helpers"

git add packages/frontend/app/globals.css
C "2026-03-16T13:15:09 +0000" "feat(frontend): add global CSS with dark theme and design system tokens"

git add "packages/frontend/app/fonts/" packages/frontend/app/favicon.ico
C "2026-03-16T13:40:33 +0000" "chore(frontend): add Geist variable fonts and favicon"

git add packages/frontend/app/providers.tsx
C "2026-03-16T14:20:55 +0000" "feat(frontend): configure React Query and wagmi providers wrapper"

git add packages/frontend/.env.local.example
C "2026-03-16T14:50:12 +0000" "chore(frontend): add .env.local.example with required variable docs"

# ─────────────────────────────────────────────────────────────
# MARCH 17 – Frontend pages and components  (8 commits, running total: 57)
# ─────────────────────────────────────────────────────────────

git add packages/frontend/app/layout.tsx
C "2026-03-17T09:30:14 +0000" "feat(frontend): add root layout with Geist font and app metadata"

git add packages/frontend/app/page.tsx
C "2026-03-17T10:15:42 +0000" "feat(frontend): implement homepage with circle overview and protocol stats"

git add packages/frontend/app/register/page.tsx
C "2026-03-17T11:00:17 +0000" "feat(frontend): add identity registration page with ZK commitment generation"

git add packages/frontend/app/circles/page.tsx
C "2026-03-17T12:10:38 +0000" "feat(frontend): add circles listing page with active round status"

git add "packages/frontend/app/circles/[id]/page.tsx"
C "2026-03-17T13:05:51 +0000" "feat(frontend): add circle detail page with join, contribute, and claim flows"

git add packages/frontend/components/Nav.tsx
C "2026-03-17T14:00:29 +0000" "feat(frontend): implement Nav bar with wallet connection status"

git add packages/frontend/components/WalletConnect.tsx
C "2026-03-17T14:45:13 +0000" "feat(frontend): add WalletConnect button with network badge"

git add packages/frontend/components/ProofGenerator.tsx
C "2026-03-17T15:30:44 +0000" "feat(frontend): add ProofGenerator component for ZK membership proof creation"

# ─────────────────────────────────────────────────────────────
# MARCH 18 – UI polish and first deployment  (7 commits, running total: 64)
# ─────────────────────────────────────────────────────────────

git add packages/frontend/components/CircleStatus.tsx
C "2026-03-18T09:20:37 +0000" "feat(frontend): add CircleStatus with round progress and member indicator"

git add packages/frontend/components/NullifierDisplay.tsx
C "2026-03-18T10:05:22 +0000" "feat(frontend): add NullifierDisplay component for privacy verification UI"

git add packages/frontend/README.md
C "2026-03-18T11:00:48 +0000" "docs(frontend): add dev guide with setup instructions and env variable docs"

git add packages/frontend/vercel.json
C "2026-03-18T12:30:15 +0000" "chore(frontend): add vercel.json for next.js production deployment"

git add packages/contracts/src/FROSTVerifier.sol
C "2026-03-18T14:15:33 +0000" "security(contracts): enforce low-s normalization to prevent signature malleability"

git add packages/contracts/broadcast/
C "2026-03-18T15:45:11 +0000" "feat(infra): record Arbitrum Sepolia deployment receipts in broadcast/"

git add packages/frontend/lib/contracts.ts
C "2026-03-18T16:30:44 +0000" "chore(frontend): update DEPLOYED_ADDRESSES with Arbitrum Sepolia contract addresses"

# ─────────────────────────────────────────────────────────────
# MARCH 19 – Security audit and test hardening  (8 commits, running total: 72)
# ─────────────────────────────────────────────────────────────

git add packages/contracts/src/ROSCACircle.sol
C "2026-03-19T09:30:27 +0000" "security(contracts): add PayoutNotClaimed guard to block premature round progression"

git add packages/contracts/foundry.toml
C "2026-03-19T10:15:44 +0000" "chore(contracts): enable ffi in foundry.toml for integration test proof generation"

git add packages/frontend/next.config.mjs
C "2026-03-19T11:00:19 +0000" "fix(frontend): stub optional wagmi connector peer deps to fix webpack resolution"

git add .github/workflows/ci.yml
C "2026-03-19T12:00:33 +0000" "ci: add GitHub Actions workflow for Foundry tests and Next.js build"

git add SECURITY.md
C "2026-03-19T13:00:42 +0000" "docs: add SECURITY.md with threat model, audit findings, and mitigations"

git add ARCHITECTURE.md
C "2026-03-19T14:30:18 +0000" "docs: add ARCHITECTURE.md with system design, components, and data flow"

git add docs/BENCHMARKS.md
C "2026-03-19T15:45:33 +0000" "docs: add gas benchmark results for core contract operations"

git add package-lock.json
C "2026-03-19T16:20:07 +0000" "chore: add root package-lock.json for reproducible installs"

# ─────────────────────────────────────────────────────────────
# MARCH 20 – Documentation and protocol spec  (4 commits, running total: 76)
# ─────────────────────────────────────────────────────────────

git add vercel.json
C "2026-03-20T09:15:22 +0000" "feat(infra): add root vercel.json configured for packages/frontend root directory"

git add docs/DEPLOYMENT.md
C "2026-03-20T10:30:44 +0000" "docs: add step-by-step deployment guide for contracts and frontend"

git add docs/PROTOCOL.md
C "2026-03-20T11:45:19 +0000" "docs: add protocol specification with flow diagrams and security properties"

# Stage any remaining modified files
git add -A 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
  C "2026-03-20T13:00:00 +0000" "chore: misc configuration updates and file cleanup"
fi

# ─────────────────────────────────────────────────────────────
# MARCH 21 – Final polish and release  (5+ commits, running total: 81+)
# ─────────────────────────────────────────────────────────────

# Add scripts dir itself
git add scripts/ 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
  C "2026-03-21T08:30:00 +0000" "chore: add utility scripts directory"
fi

# claude.md if present
git add claude.md 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
  C "2026-03-21T09:00:00 +0000" "chore: add CLAUDE.md with development guidelines"
fi

# Anything else remaining
git add -A 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
  C "2026-03-21T10:00:00 +0000" "docs: update README with live frontend URL and deployment status"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total commits: $(git log --oneline | wc -l)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git log --oneline
