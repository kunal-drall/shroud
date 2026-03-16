'use client';

/**
 * ZK Proof Generation — snarkjs + Groth16/BN254
 * Serves WASM + zkey from /public/circuits/
 */

export type ProofResult = {
  pA: [string, string];
  pB: [[string, string], [string, string]];
  pC: [string, string];
  pubSignals: [string, string, string]; // [nullifier, merkleRoot, circleId]  ← snarkjs output order
  proofTimeMs: number;
};

export type ProofStatus =
  | 'idle'
  | 'loading-circuits'
  | 'computing-witness'
  | 'generating-proof'
  | 'done'
  | 'error';

export async function generateMembershipProof(
  msk: bigint,
  pathElements: bigint[],
  pathIndices: number[],
  merkleRoot: bigint,
  circleId: bigint,
  onStatus?: (status: ProofStatus) => void
): Promise<ProofResult> {
  const t0 = Date.now();

  try {
    onStatus?.('loading-circuits');
    // Dynamic import to avoid SSR issues
    const snarkjs = await import('snarkjs');

    const input = {
      msk:          msk.toString(),
      pathElements: pathElements.map(e => e.toString()),
      pathIndices,
      merkleRoot:   merkleRoot.toString(),
      circleId:     circleId.toString(),
    };

    onStatus?.('computing-witness');
    // Small delay to let UI update
    await new Promise(r => setTimeout(r, 50));

    onStatus?.('generating-proof');
    const { proof, publicSignals } = await (snarkjs as any).groth16.fullProve(
      input,
      '/circuits/membership.wasm',
      '/circuits/membership.zkey'
    );

    // Format for Solidity calldata
    const calldataStr = await (snarkjs as any).groth16.exportSolidityCallData(proof, publicSignals);
    const [pA, pB, pC, pubSignals_] = JSON.parse(`[${calldataStr}]`);

    onStatus?.('done');
    return {
      pA,
      pB,
      pC,
      pubSignals: pubSignals_,
      proofTimeMs: Date.now() - t0,
    };
  } catch (err) {
    onStatus?.('error');
    throw err;
  }
}

/** Format proof time for display */
export function formatProofTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const PROOF_STATUS_LABELS: Record<ProofStatus, string> = {
  'idle':             'Generate ZK Proof',
  'loading-circuits': 'Loading circuit WASM...',
  'computing-witness':'Computing witness...',
  'generating-proof': 'Generating Groth16 proof...',
  'done':             'Proof generated',
  'error':            'Proof generation failed',
};

export const PROOF_STATUS_PROGRESS: Record<ProofStatus, number> = {
  'idle':             0,
  'loading-circuits': 15,
  'computing-witness':40,
  'generating-proof': 70,
  'done':             100,
  'error':            100,
};
