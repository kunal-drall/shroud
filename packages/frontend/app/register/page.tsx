'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { Nav } from '@/components/Nav';
import {
  generateMasterKey,
  computeCommitment,
  saveMskLocally,
  loadMskLocally,
  toBytes32,
  truncateHex,
} from '@/lib/crypto';
import { DEPLOYED_ADDRESSES, IDENTITY_REGISTRY_ABI } from '@/lib/contracts';

type Step = 'idle' | 'generating' | 'generated' | 'registering' | 'done';

export default function RegisterPage() {
  const { isConnected } = useAccount();

  const [step, setStep]           = useState<Step>('idle');
  const [msk, setMsk]             = useState<bigint | null>(null);
  const [commitment, setCommit]   = useState<bigint | null>(null);
  const [leafIndex, setLeafIndex] = useState<number | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [showMsk, setShowMsk]     = useState(false);

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Load existing key on mount
  const existing = typeof window !== 'undefined' ? loadMskLocally() : null;

  const handleGenerate = async () => {
    setError(null);
    setStep('generating');
    try {
      const { msk: newMsk, commitment: newCommit } = await generateMasterKey();
      setMsk(newMsk);
      setCommit(newCommit);
      setStep('generated');
    } catch (e: any) {
      setError(e.message);
      setStep('idle');
    }
  };

  const handleRegister = async () => {
    if (!commitment) return;
    setError(null);
    setStep('registering');
    try {
      writeContract({
        address: DEPLOYED_ADDRESSES.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'register',
        args: [toBytes32(commitment)],
      });
    } catch (e: any) {
      setError(e.message);
      setStep('generated');
    }
  };

  // Watch for tx success
  if (isSuccess && step === 'registering') {
    if (msk !== null) {
      saveMskLocally(msk, 0); // leaf index 0 placeholder; update from event
    }
    setStep('done');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-12">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="mb-10 animate-fade-up">
          <p className="font-mono text-xs text-accent uppercase tracking-widest mb-2">Step 1 of 4</p>
          <h1 className="font-display text-2xl font-bold text-text">Register Identity</h1>
          <p className="text-sm text-muted mt-2 max-w-lg leading-relaxed">
            Generate a master secret key, compute your Poseidon commitment, and register it
            in the on-chain Merkle tree. Your key never leaves this browser.
          </p>
        </div>

        <div className="grid sm:grid-cols-[1fr_280px] gap-8">

          {/* ── Main panel ────────────────────────────────────────────── */}
          <div className="space-y-4 animate-fade-up-d1">

            {/* Existing key warning */}
            {existing && step === 'idle' && (
              <div className="panel border-warn/30">
                <p className="text-xs text-warn font-medium mb-1">Identity already stored locally</p>
                <p className="text-xs text-muted">
                  msk: <span className="font-mono">{truncateHex(existing.msk.toString(16).padStart(64,'0'), 8)}</span>
                </p>
                <p className="text-xs text-muted mt-1">
                  Generating a new key will overwrite the stored key. Only do this if you have not already registered on-chain.
                </p>
              </div>
            )}

            {/* Generate step */}
            <div className="panel">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-mono text-[10px] text-muted uppercase tracking-widest">Step 1</div>
                  <div className="font-display font-semibold text-sm text-text mt-0.5">Generate keypair</div>
                </div>
                {step !== 'idle' && (
                  <span className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs">✓</span>
                )}
              </div>

              {step === 'idle' && (
                <button
                  className="btn-primary w-full"
                  onClick={handleGenerate}
                  disabled={!isConnected}
                >
                  {isConnected ? 'Generate Identity' : 'Connect wallet first'}
                </button>
              )}

              {step === 'generating' && (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted">Sampling from BN254 field...</span>
                </div>
              )}

              {(step === 'generated' || step === 'registering' || step === 'done') && commitment && (
                <div className="space-y-3">
                  <div className="data-row">
                    <span className="data-label">Commitment</span>
                    <span className="data-value text-text">
                      {truncateHex('0x' + commitment.toString(16).padStart(64,'0'), 10)}
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Algorithm</span>
                    <span className="data-value">Poseidon(msk) · BN254</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Master key</span>
                    <button
                      className="font-mono text-xs text-muted hover:text-text transition-colors"
                      onClick={() => setShowMsk(s => !s)}
                    >
                      {showMsk && msk
                        ? truncateHex('0x' + msk.toString(16).padStart(64,'0'), 16)
                        : '••••••••  (click to reveal)'}
                    </button>
                  </div>
                  <div className="p-2 bg-warn/5 border border-warn/20 rounded">
                    <p className="text-[11px] text-warn leading-relaxed">
                      Your master key is stored in localStorage. Back it up securely — loss means permanent exclusion from your circles.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Register step */}
            {(step === 'generated' || step === 'registering' || step === 'done') && (
              <div className="panel">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-mono text-[10px] text-muted uppercase tracking-widest">Step 2</div>
                    <div className="font-display font-semibold text-sm text-text mt-0.5">Register on-chain</div>
                  </div>
                  {step === 'done' && (
                    <span className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs">✓</span>
                  )}
                </div>

                {step === 'generated' && (
                  <button
                    className="btn-primary w-full"
                    onClick={handleRegister}
                    disabled={!isConnected}
                  >
                    Register Commitment
                  </button>
                )}

                {(step === 'registering' || (step === 'registering' && isMining)) && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-muted">
                      {isMining ? 'Transaction mining...' : 'Awaiting signature...'}
                    </span>
                  </div>
                )}

                {step === 'done' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-2.5 bg-accent/10 border border-accent/30 rounded text-xs text-accent font-medium">
                      <span>✓</span> Identity registered on Arbitrum Sepolia
                    </div>
                    {txHash && (
                      <div className="data-row">
                        <span className="data-label">Tx hash</span>
                        <span className="data-value">{truncateHex(txHash, 8)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded text-xs text-danger">
                {error}
              </div>
            )}
          </div>

          {/* ── Sidebar ───────────────────────────────────────────────── */}
          <aside className="space-y-4 animate-fade-up-d2">
            <div className="panel">
              <h3 className="font-display font-semibold text-xs text-muted uppercase tracking-widest mb-3">
                What gets registered
              </h3>
              <div className="space-y-3 text-xs text-muted leading-relaxed">
                <p>
                  Only your <span className="text-text font-mono">commitment = Poseidon(msk)</span> goes on-chain.
                  It is a one-way hash — no one can recover your master key from it.
                </p>
                <p>
                  The commitment is inserted as a leaf in the on-chain Poseidon Merkle tree. The updated root is used as the public input to your ZK proofs.
                </p>
              </div>
            </div>

            <div className="panel">
              <h3 className="font-display font-semibold text-xs text-muted uppercase tracking-widest mb-3">
                Privacy model
              </h3>
              <div className="space-y-2 text-xs text-muted leading-relaxed">
                <div className="flex gap-2">
                  <span className="text-accent flex-shrink-0">→</span>
                  <span>On-chain: commitment (public hash)</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-danger flex-shrink-0">→</span>
                  <span>Local only: master secret key</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-accent flex-shrink-0">→</span>
                  <span>ZK proof: proves membership without revealing which leaf</span>
                </div>
              </div>
            </div>

            {step === 'done' && (
              <a href="/circles" className="btn-primary w-full text-center block">
                Browse Circles →
              </a>
            )}
          </aside>

        </div>
      </main>
    </div>
  );
}
