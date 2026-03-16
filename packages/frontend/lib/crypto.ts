'use client';

/**
 * Shroud Crypto Library — JS implementation using circomlibjs
 *
 * Uses the EXACT same Poseidon implementation as circomlib circuits.
 * These functions produce values compatible with:
 *   - The Circom membership.circom circuit
 *   - The Solidity IdentityRegistry (which uses circomlibjs bytecode via PoseidonDeployer)
 *
 * Production path: Rust → WASM for performance.
 * Hackathon path: circomlibjs directly in the browser.
 */

// BN254 scalar field order
const FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

const TREE_DEPTH = 6;

// Poseidon function cache (lazy-initialized)
let _poseidonFn: ((inputs: bigint[]) => bigint) | null = null;

async function getPoseidon(): Promise<(inputs: bigint[]) => bigint> {
  if (_poseidonFn) return _poseidonFn;

  const { buildPoseidon } = await import('circomlibjs');
  const poseidon = await buildPoseidon();
  _poseidonFn = (inputs: bigint[]): bigint => {
    const result = poseidon(inputs);
    return poseidon.F.toObject(result);
  };
  return _poseidonFn;
}

/** Generate a random master secret key + its on-chain commitment */
export async function generateMasterKey(): Promise<{ msk: bigint; commitment: bigint }> {
  const poseidon = await getPoseidon();

  // Generate 31 random bytes (fits safely in BN254 field)
  const bytes = crypto.getRandomValues(new Uint8Array(31));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const msk = BigInt('0x' + hex) % FIELD_SIZE;

  const commitment = poseidon([msk]);
  return { msk, commitment };
}

/** Compute the deterministic nullifier for (msk, circleId) */
export async function deriveNullifier(msk: bigint, circleId: bigint): Promise<bigint> {
  const poseidon = await getPoseidon();
  return poseidon([msk, circleId]);
}

/** Compute the commitment Poseidon(msk) */
export async function computeCommitment(msk: bigint): Promise<bigint> {
  const poseidon = await getPoseidon();
  return poseidon([msk]);
}

// ── Merkle tree ──────────────────────────────────────────────────────────────

/** Build a Poseidon Merkle tree of depth 6 from a list of leaf commitments */
export async function buildMerkleTree(leaves: bigint[]): Promise<{
  root: bigint;
  levels: bigint[][];
}> {
  const poseidon = await getPoseidon();

  // Pad to 64 leaves with zeros
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length < 2 ** TREE_DEPTH) {
    paddedLeaves.push(0n);
  }

  let level: bigint[] = paddedLeaves;
  const levels: bigint[][] = [level];

  while (level.length > 1) {
    const nextLevel: bigint[] = [];
    for (let i = 0; i < level.length; i += 2) {
      nextLevel.push(poseidon([level[i], level[i + 1]]));
    }
    level = nextLevel;
    levels.push(level);
  }

  return { root: levels[TREE_DEPTH][0], levels };
}

/** Get Merkle proof (sibling path) for a leaf at `leafIndex` */
export async function getMerkleProof(
  leafIndex: number,
  leaves: bigint[]
): Promise<{ pathElements: bigint[]; pathIndices: number[]; root: bigint }> {
  const { root, levels } = await buildMerkleTree(leaves);

  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];

  let idx = leafIndex;
  for (let i = 0; i < TREE_DEPTH; i++) {
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    pathElements.push(levels[i][siblingIdx] ?? 0n);
    pathIndices.push(isRight ? 1 : 0);
    idx = Math.floor(idx / 2);
  }

  return { pathElements, pathIndices, root };
}

// ── Local key storage ────────────────────────────────────────────────────────

const MSK_KEY = 'shroud:msk';
const LEAF_INDEX_KEY = 'shroud:leafIndex';

export function saveMskLocally(msk: bigint, leafIndex?: number): void {
  localStorage.setItem(MSK_KEY, msk.toString());
  if (leafIndex !== undefined) {
    localStorage.setItem(LEAF_INDEX_KEY, leafIndex.toString());
  }
}

export function loadMskLocally(): { msk: bigint; leafIndex: number } | null {
  const mskStr = localStorage.getItem(MSK_KEY);
  if (!mskStr) return null;
  const leafIndexStr = localStorage.getItem(LEAF_INDEX_KEY);
  return {
    msk: BigInt(mskStr),
    leafIndex: leafIndexStr ? parseInt(leafIndexStr) : 0,
  };
}

export function clearLocalMsk(): void {
  localStorage.removeItem(MSK_KEY);
  localStorage.removeItem(LEAF_INDEX_KEY);
}

/** Save pseudonym for a specific circle */
export function savePseudonym(circleId: string, pseudonym: string): void {
  localStorage.setItem(`shroud:pseudonym:${circleId}`, pseudonym);
}

export function loadPseudonym(circleId: string): string | null {
  return localStorage.getItem(`shroud:pseudonym:${circleId}`);
}

/** Format a bigint as 0x-prefixed hex, padded to 32 bytes */
export function toBytes32(n: bigint): `0x${string}` {
  return `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;
}

/** Truncate a hex string for display: 0x1234...abcd */
export function truncateHex(hex: string, chars = 8): string {
  if (!hex || hex.length <= chars * 2 + 2) return hex;
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`;
}
