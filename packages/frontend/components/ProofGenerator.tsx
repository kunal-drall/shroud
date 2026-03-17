'use client';

import { useState, useCallback } from 'react';
import {
  generateMembershipProof,
  formatProofTime,
  ProofResult,
  ProofStatus,
  PROOF_STATUS_LABELS,
  PROOF_STATUS_PROGRESS,
} from '@/lib/snarkjs-utils';
import { getMerkleProof } from '@/lib/crypto';

interface ProofGeneratorProps {
  msk: bigint;
  merkleRoot: bigint;
  circleId: bigint;
  leaves: bigint[];        // all registered commitments in the tree
  leafIndex: number;       // this user's leaf position
  onProofGenerated: (result: ProofResult) => void;
  disabled?: boolean;
}

export function ProofGenerator({
  msk,
  merkleRoot,
  circleId,
  leaves,
  leafIndex,
  onProofGenerated,
  disabled,
}: ProofGeneratorProps) {
  const [status, setStatus] = useState<ProofStatus>('idle');
  const [proofTime, setProofTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setError(null);
    setProofTime(null);

    try {
      const { pathElements, pathIndices } = await getMerkleProof(leafIndex, leaves);

      const result = await generateMembershipProof(
        msk,
        pathElements,
        pathIndices,
        merkleRoot,
        circleId,
        (s) => setStatus(s)
      );

      setProofTime(result.proofTimeMs);
      onProofGenerated(result);
    } catch (err: any) {
      setError(err?.message ?? 'Unknown error during proof generation');
      setStatus('idle');
    }
  }, [msk, merkleRoot, circleId, leaves, leafIndex, onProofGenerated]);

  const progress = PROOF_STATUS_PROGRESS[status];
  const isRunning = !['idle', 'done', 'error'].includes(status);

  return (
    <div className="space-y-4">
      {/* Button */}
      {status === 'idle' || status === 'error' ? (
        <button
          className="btn-primary w-full"
          onClick={generate}
          disabled={disabled}
        >
          Generate ZK Proof
        </button>
      ) : status === 'done' ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-accent/10 border border-accent/30 rounded text-sm text-accent font-medium">
          <span className="text-base">✓</span>
          Proof generated in {proofTime !== null ? formatProofTime(proofTime) : '—'}
        </div>
      ) : null}

      {/* Progress */}
      {(isRunning || status === 'done') && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted">{PROOF_STATUS_LABELS[status]}</span>
            <span className="text-xs font-mono text-muted">{progress}%</span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Metadata */}
      {status === 'done' && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: 'System',       value: 'Groth16' },
            { label: 'Curve',        value: 'BN254' },
            { label: 'Constraints',  value: '1,911' },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-2 bg-surface border border-border/50 rounded">
              <div className="text-xs text-muted">{label}</div>
              <div className="text-xs font-mono text-accent mt-0.5">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded text-xs text-danger leading-relaxed">
          {error.includes('zkey') || error.includes('wasm')
            ? 'Circuit files not found. Ensure /public/circuits/membership.wasm and .zkey are present.'
            : error}
        </div>
      )}

      {/* Disclaimer */}
      {status === 'idle' && (
        <p className="text-xs text-muted leading-relaxed">
          Proof runs entirely in your browser. Your master secret key never leaves this device.
          Generation takes 5–15 seconds depending on hardware.
        </p>
      )}
    </div>
  );
}
