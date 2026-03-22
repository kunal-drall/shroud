'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem } from 'viem';
import { Nav } from '@/components/Nav';
import { CircleStatus } from '@/components/CircleStatus';
import { ProofGenerator } from '@/components/ProofGenerator';
import { NullifierDisplay } from '@/components/NullifierDisplay';
import { ROSCA_CIRCLE_ABI, CircleState, STATE_LABELS, DEPLOYED_ADDRESSES } from '@/lib/contracts';
import {
  loadMskLocally,
  savePseudonym,
  loadPseudonym,
  computeCommitment,
  buildMerkleTree,
  toBytes32,
  truncateHex,
} from '@/lib/crypto';
import type { ProofResult } from '@/lib/snarkjs-utils';

// ── Demo FROST signature (pre-generated for hackathon demo) ───────────────────
// In production: Thetacrypt nodes co-sign the payout message in real-time.
// For demo: we use a pre-signed ECDSA signature from a test key that matches
// the threshold pubkey configured in the contract constructor.
const DEMO_FROST_R = BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798');
const DEMO_FROST_S = BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8');

// ── Panel components ──────────────────────────────────────────────────────────

function JoinPanel({
  circleAddress,
  circleId,
  merkleRoot,
  onJoined,
}: {
  circleAddress: `0x${string}`;
  circleId: bigint;
  merkleRoot: bigint;
  onJoined: (pseudonym: string, nullifier: string) => void;
}) {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [proof, setProof]               = useState<ProofResult | null>(null);
  const [pseudonym, setPseudonym]       = useState('');
  const [nullifier, setNullifier]       = useState('');
  const [error, setError]               = useState<string | null>(null);

  // Registry tree state
  const [leaves, setLeaves]             = useState<bigint[]>([]);
  const [userLeafIndex, setUserLeafIdx] = useState<number>(-1);
  const [leavesRoot, setLeavesRoot]     = useState<bigint>(0n);
  const [loadingTree, setLoadingTree]   = useState(true);
  const [treeError, setTreeError]       = useState<string | null>(null);

  const localKey = typeof window !== 'undefined' ? loadMskLocally() : null;

  // Fetch all IdentityRegistered events to build the real leaves array
  useEffect(() => {
    if (!publicClient || !localKey) { setLoadingTree(false); return; }
    (async () => {
      setLoadingTree(true);
      setTreeError(null);
      try {
        const logs = await publicClient.getLogs({
          address: DEPLOYED_ADDRESSES.identityRegistry,
          event: parseAbiItem('event IdentityRegistered(bytes32 indexed commitment, uint256 leafIndex, bytes32 newRoot)'),
          fromBlock: 0n,
          toBlock: 'latest',
        });

        const sorted = [...logs].sort((a, b) =>
          Number((a.args as any).leafIndex) - Number((b.args as any).leafIndex)
        );
        const leavesArr = sorted.map(log => BigInt((log.args as any).commitment));
        setLeaves(leavesArr);

        // Find user's commitment in the tree
        const userCommitment = await computeCommitment(localKey.msk);
        const userHex = toBytes32(userCommitment);
        const idx = sorted.findIndex(log => (log.args as any).commitment === userHex);
        setUserLeafIdx(idx);

        // Compute the Merkle root from the actual leaves
        if (leavesArr.length > 0) {
          const { root } = await buildMerkleTree(leavesArr);
          setLeavesRoot(root);
        }
      } catch (e: any) {
        setTreeError(e?.message ?? 'Failed to load registry data');
      } finally {
        setLoadingTree(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive nullifier when proof is ready
  useEffect(() => {
    if (!proof) return;
    const nul = proof.pubSignals[2]; // nullifier is pubSignals[2]
    setNullifier('0x' + BigInt(nul).toString(16).padStart(64, '0'));
  }, [proof]);

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess && pseudonym && nullifier) {
      savePseudonym(circleAddress, pseudonym);
      onJoined(pseudonym, nullifier);
    }
  }, [isSuccess, circleAddress, pseudonym, nullifier, onJoined]);

  const handleJoin = async () => {
    if (!proof) return;
    setError(null);
    const ps = ('0x' + Math.floor(Math.random() * 1e15).toString(16).padStart(64, '0')) as `0x${string}`;
    setPseudonym(ps);
    try {
      writeContract({
        address: circleAddress,
        abi: ROSCA_CIRCLE_ABI,
        functionName: 'joinCircle',
        args: [
          proof.pA as unknown as [bigint, bigint],
          proof.pB as unknown as [[bigint, bigint], [bigint, bigint]],
          proof.pC as unknown as [bigint, bigint],
          proof.pubSignals as unknown as [bigint, bigint, bigint],
          ps,
        ],
      });
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!localKey) {
    return (
      <div className="panel">
        <p className="text-sm text-muted">
          No identity found locally.{' '}
          <a href="/register" className="text-accent underline">Register first →</a>
        </p>
      </div>
    );
  }

  if (loadingTree) {
    return (
      <div className="panel">
        <div className="flex items-center gap-3 py-3">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm text-muted">Loading identity registry…</span>
        </div>
      </div>
    );
  }

  if (treeError) {
    return (
      <div className="panel">
        <p className="text-xs text-danger">Registry error: {treeError}</p>
      </div>
    );
  }

  if (userLeafIndex === -1) {
    return (
      <div className="panel">
        <p className="text-sm text-muted">
          Your commitment was not found in the identity registry.{' '}
          <a href="/register" className="text-accent underline">Register your identity first →</a>
        </p>
      </div>
    );
  }

  // Circle was deployed before the user registered — roots don't match
  const circleRootMismatch = leaves.length > 0 && leavesRoot !== merkleRoot;

  return (
    <div className="space-y-4">
      <div className="panel">
        <h3 className="font-display font-semibold text-sm text-text mb-3">Join with ZK Proof</h3>
        <p className="text-xs text-muted leading-relaxed mb-4">
          Generate a Groth16 membership proof from your master key. This proves you are
          in the identity Merkle tree without revealing which leaf.
        </p>

        {circleRootMismatch ? (
          <div className="p-3 bg-warn/10 border border-warn/30 rounded text-xs text-warn leading-relaxed space-y-2">
            <p className="font-medium">Merkle root mismatch</p>
            <p>
              This circle was deployed before your identity was registered.
              Its stored Merkle root does not include your commitment.
            </p>
            <p>
              <a href="/circles" className="underline font-medium">Create a new circle →</a>
              {' '}New circles capture the current registry root automatically.
            </p>
          </div>
        ) : (
          <ProofGenerator
            msk={localKey.msk}
            merkleRoot={merkleRoot}
            circleId={circleId}
            leaves={leaves}
            leafIndex={userLeafIndex}
            onProofGenerated={setProof}
            disabled={!isConnected}
          />
        )}
      </div>

      {proof && !circleRootMismatch && (
        <div className="panel space-y-4">
          <h3 className="font-display font-semibold text-sm text-text">Submit Proof</h3>

          {nullifier && <NullifierDisplay nullifier={nullifier} />}

          {!isMining && !isSuccess && (
            <button className="btn-primary w-full" onClick={handleJoin}>
              Join Circle
            </button>
          )}
          {isMining && (
            <div className="flex items-center gap-3 py-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted">Transaction mining…</span>
            </div>
          )}
          {isSuccess && (
            <div className="flex items-center gap-2 p-2.5 bg-accent/10 border border-accent/30 rounded text-xs text-accent font-medium">
              <span>✓</span> Successfully joined. Waiting for other members…
            </div>
          )}
          {error && (
            <p className="text-xs text-danger">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ContributePanel({
  circleAddress,
  contributionAmount,
  currentRound,
}: {
  circleAddress: `0x${string}`;
  contributionAmount: bigint;
  currentRound: number;
}) {
  const pseudonym = typeof window !== 'undefined' ? loadPseudonym(circleAddress) : null;
  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [error, setError] = useState<string | null>(null);

  const handleContribute = () => {
    if (!pseudonym) return;
    setError(null);
    try {
      writeContract({
        address: circleAddress,
        abi: ROSCA_CIRCLE_ABI,
        functionName: 'contribute',
        args: [pseudonym as `0x${string}`],
        value: contributionAmount,
      });
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!pseudonym) {
    return (
      <div className="panel">
        <p className="text-xs text-muted">No pseudonym found for this circle. Did you join?</p>
      </div>
    );
  }

  return (
    <div className="panel space-y-4">
      <h3 className="font-display font-semibold text-sm text-text">Contribute — Round {currentRound}</h3>
      <div className="data-row">
        <span className="data-label">Amount</span>
        <span className="data-value text-text">{formatEther(contributionAmount)} ETH</span>
      </div>
      <div className="data-row">
        <span className="data-label">Your pseudonym</span>
        <span className="font-mono text-xs text-muted">{truncateHex(pseudonym, 6)}</span>
      </div>

      {!isLoading && !isSuccess && (
        <button className="btn-primary w-full" onClick={handleContribute}>
          Contribute {formatEther(contributionAmount)} ETH
        </button>
      )}
      {isLoading && (
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted">Mining...</span>
        </div>
      )}
      {isSuccess && (
        <div className="flex items-center gap-2 p-2.5 bg-accent/10 border border-accent/30 rounded text-xs text-accent font-medium">
          <span>✓</span> Contribution recorded for round {currentRound}
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function ClaimPanel({
  circleAddress,
  contributionAmount,
  memberCount,
  currentRound,
}: {
  circleAddress: `0x${string}`;
  contributionAmount: bigint;
  memberCount: number;
  currentRound: number;
}) {
  const { address } = useAccount();
  const [recipient, setRecipient] = useState(address ?? '');
  const [error, setError]         = useState<string | null>(null);

  const payout = contributionAmount * BigInt(memberCount);

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleClaim = () => {
    if (!recipient) return;
    setError(null);
    try {
      writeContract({
        address: circleAddress,
        abi: ROSCA_CIRCLE_ABI,
        functionName: 'claimPayout',
        args: [DEMO_FROST_R, DEMO_FROST_S, recipient as `0x${string}`],
      });
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="panel space-y-4">
      <h3 className="font-display font-semibold text-sm text-text">Claim Payout — Round {currentRound}</h3>
      <p className="text-xs text-muted leading-relaxed">
        This round&apos;s payout is authorized by a pre-signed FROST threshold signature
        from the Thetacrypt nodes. Specify any recipient address for privacy.
      </p>

      <div className="data-row">
        <span className="data-label">Payout amount</span>
        <span className="data-value text-accent font-semibold">{formatEther(payout)} ETH</span>
      </div>

      <div>
        <label className="data-label block mb-1">Recipient address (can be fresh wallet)</label>
        <input
          className="input-field"
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          placeholder="0x..."
        />
      </div>

      <div className="p-2 bg-surface border border-border/50 rounded">
        <p className="text-[11px] text-muted font-mono">
          FROST sig: {truncateHex('0x' + DEMO_FROST_R.toString(16), 6)}...
        </p>
        <p className="text-[11px] text-muted/60 mt-0.5">
          Demo: pre-signed by test threshold key. Production uses live Thetacrypt nodes.
        </p>
      </div>

      {!isLoading && !isSuccess && (
        <button className="btn-primary w-full" onClick={handleClaim} disabled={!recipient}>
          Claim {formatEther(payout)} ETH
        </button>
      )}
      {isLoading && (
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted">Mining...</span>
        </div>
      )}
      {isSuccess && (
        <div className="flex items-center gap-2 p-2.5 bg-accent/10 border border-accent/30 rounded text-xs text-accent font-medium">
          <span>✓</span> Payout of {formatEther(payout)} ETH sent to {truncateHex(recipient, 6)}
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CircleDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const circleAddress = id as `0x${string}`;

  const { data: info } = useReadContract({
    address: circleAddress,
    abi: ROSCA_CIRCLE_ABI,
    functionName: 'getCircleInfo',
  });

  const { data: merkleRootRaw } = useReadContract({
    address: circleAddress,
    abi: ROSCA_CIRCLE_ABI,
    functionName: 'merkleRoot',
  });

  const { data: circleIdRaw } = useReadContract({
    address: circleAddress,
    abi: ROSCA_CIRCLE_ABI,
    functionName: 'circleId',
  });

  const { data: roundDeadlineRaw } = useReadContract({
    address: circleAddress,
    abi: ROSCA_CIRCLE_ABI,
    functionName: 'roundDeadline',
  });

  const [joined, setJoined] = useState(false);
  const [lastNullifier, setLastNullifier] = useState<string | null>(null);

  const state          = info ? Number(info[0]) : 0;
  const joinedCount    = info ? Number(info[1]) : 0;
  const memberCount    = info ? Number(info[2]) : 0;
  const currentRound   = info ? Number(info[3]) : 0;
  const totalRounds    = info ? Number(info[4]) : 0;
  const balance        = info ? info[5] : 0n;
  const merkleRoot     = merkleRootRaw ? BigInt(merkleRootRaw) : 0n;
  const circleId       = circleIdRaw ? BigInt(circleIdRaw as bigint) : 0n;
  const deadline       = roundDeadlineRaw ? Number(roundDeadlineRaw) : 0;

  const deadlineDate = deadline > 0 ? new Date(deadline * 1000).toLocaleString() : '—';

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-12">

        {/* ── Circle header ─────────────────────────────────────────── */}
        <div className="mb-8 animate-fade-up">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-1">
                ROSCACircle
              </p>
              <h1 className="font-mono text-lg font-semibold text-text">
                {truncateHex(circleAddress, 10)}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${
                state === CircleState.JOINING   ? 'badge-joining'   :
                state === CircleState.ACTIVE    ? 'badge-active'    :
                                                  'badge-completed'
              }`}>
                {STATE_LABELS[state] ?? '...'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-[1fr_300px] gap-8">

          {/* ── Left: active panel ────────────────────────────────────── */}
          <div className="space-y-4 animate-fade-up-d1">

            {/* State machine progress */}
            <div className="panel">
              <CircleStatus
                state={state}
                currentRound={currentRound}
                totalRounds={totalRounds}
                joinedCount={joinedCount}
                memberCount={memberCount}
              />
            </div>

            {/* JOINING: show join panel */}
            {state === CircleState.JOINING && !joined && (
              <JoinPanel
                circleAddress={circleAddress}
                circleId={circleId}
                merkleRoot={merkleRoot}
                onJoined={(ps, nul) => { setJoined(true); setLastNullifier(nul); }}
              />
            )}

            {state === CircleState.JOINING && joined && (
              <div className="panel space-y-3">
                <div className="flex items-center gap-2 text-sm text-accent font-medium">
                  <span>✓</span> You have joined. Waiting for {memberCount - joinedCount} more member(s).
                </div>
                {lastNullifier && <NullifierDisplay nullifier={lastNullifier} />}
              </div>
            )}

            {/* ACTIVE: show contribute + claim panels */}
            {state === CircleState.ACTIVE && (
              <>
                <ContributePanel
                  circleAddress={circleAddress}
                  contributionAmount={balance && memberCount > 0 ? BigInt(0) : 0n}
                  currentRound={currentRound}
                />
                <ClaimPanel
                  circleAddress={circleAddress}
                  contributionAmount={0n}
                  memberCount={memberCount}
                  currentRound={currentRound}
                />
              </>
            )}

            {/* COMPLETED */}
            {state === CircleState.COMPLETED && (
              <div className="panel">
                <div className="text-sm text-muted text-center py-4">
                  All rounds complete. Circle is finalized.
                </div>
              </div>
            )}

          </div>

          {/* ── Right: circle info ────────────────────────────────────── */}
          <aside className="space-y-4 animate-fade-up-d2">
            <div className="panel space-y-0">
              <h3 className="font-display font-semibold text-xs text-muted uppercase tracking-widest mb-3">
                Circle Info
              </h3>
              {[
                { label: 'Address',      value: truncateHex(circleAddress, 8) },
                { label: 'Members',      value: `${joinedCount} / ${memberCount}` },
                { label: 'Round',        value: `${currentRound} / ${totalRounds}` },
                { label: 'Pool balance', value: `${formatEther(balance as bigint)} ETH` },
                { label: 'Deadline',     value: deadlineDate },
              ].map(({ label, value }) => (
                <div key={label} className="data-row">
                  <span className="data-label">{label}</span>
                  <span className="font-mono text-xs text-text">{value}</span>
                </div>
              ))}
            </div>

            <div className="panel">
              <h3 className="font-display font-semibold text-xs text-muted uppercase tracking-widest mb-3">
                Security
              </h3>
              <div className="space-y-2 text-xs text-muted leading-relaxed">
                <div className="flex gap-2">
                  <span className="text-accent flex-shrink-0 mt-px">→</span>
                  <span>Membership: Groth16 ZK proof</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-accent flex-shrink-0 mt-px">→</span>
                  <span>Custody: FROST 2-of-3 threshold</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-accent flex-shrink-0 mt-px">→</span>
                  <span>Sybil: Poseidon nullifiers</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-accent flex-shrink-0 mt-px">→</span>
                  <span>Reentrancy: OZ ReentrancyGuard</span>
                </div>
              </div>
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}
