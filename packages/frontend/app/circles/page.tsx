'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWriteContract, useAccount } from 'wagmi';
import { parseEther, keccak256, stringToBytes } from 'viem';
import { Nav } from '@/components/Nav';
import { DEPLOYED_ADDRESSES, ROSCA_CIRCLE_ABI, CircleState, STATE_LABELS } from '@/lib/contracts';
import { truncateHex } from '@/lib/crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CircleEntry {
  address: string;
  circleId: string;
  memberCount: number;
  contributionAmount: string;
  state: CircleState;
  joined: number;
}

// Demo circles — in production these would be fetched from events
const DEMO_CIRCLES: CircleEntry[] = [
  {
    address: DEPLOYED_ADDRESSES.demoCircle,
    circleId: '0x' + Buffer.from(keccak256(stringToBytes('shroud-demo-circle-1')).slice(2), 'hex').toString('hex'),
    memberCount: 5,
    contributionAmount: '0.01',
    state: CircleState.JOINING,
    joined: 0,
  },
];

// ── Create form ───────────────────────────────────────────────────────────────

function CreateCircleForm({ onCreated }: { onCreated: () => void }) {
  const { isConnected } = useAccount();
  const [form, setForm] = useState({
    memberCount:        '5',
    contributionAmount: '0.01',
    roundDurationDays:  '7',
  });
  const [error, setError] = useState<string | null>(null);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleCreate = async () => {
    setError(null);
    if (DEPLOYED_ADDRESSES.identityRegistry === '0x0000000000000000000000000000000000000000') {
      setError('Contracts not yet deployed. Run: forge script script/Deploy.s.sol --broadcast');
      return;
    }
    // In production: deploy a new ROSCACircle with these params
    // For hackathon demo: show the params and guide user
    alert(`ROSCACircle creation requires deploying a new contract.\n\nParams:\n- Members: ${form.memberCount}\n- Contribution: ${form.contributionAmount} ETH\n- Duration: ${form.roundDurationDays} days\n\nSee Deploy.s.sol for the deployment script.`);
    onCreated();
  };

  return (
    <div className="panel space-y-4">
      <h3 className="font-display font-semibold text-sm text-text">Create Circle</h3>
      <p className="text-xs text-muted leading-relaxed">
        Deploy a new ROSCACircle contract with custom parameters.
        The circle creator sets the rules — they are enforced by the contract.
      </p>

      <div className="space-y-3">
        <div>
          <label className="data-label block mb-1">Member Count</label>
          <input className="input-field" type="number" min="2" max="64"
            value={form.memberCount} onChange={set('memberCount')} />
          <p className="text-xs text-muted mt-1">Max 64 (depth-6 Merkle tree)</p>
        </div>
        <div>
          <label className="data-label block mb-1">Contribution per Round (ETH)</label>
          <input className="input-field" type="number" step="0.001" min="0.001"
            value={form.contributionAmount} onChange={set('contributionAmount')} />
        </div>
        <div>
          <label className="data-label block mb-1">Round Duration (days)</label>
          <input className="input-field" type="number" min="1" max="30"
            value={form.roundDurationDays} onChange={set('roundDurationDays')} />
        </div>
      </div>

      <div className="p-2.5 bg-surface border border-border rounded font-mono text-xs text-muted space-y-1">
        <div className="flex justify-between">
          <span>Total pool per round:</span>
          <span className="text-text">
            {(parseFloat(form.contributionAmount || '0') * parseInt(form.memberCount || '0')).toFixed(3)} ETH
          </span>
        </div>
        <div className="flex justify-between">
          <span>Total lifecycle:</span>
          <span className="text-text">
            {parseInt(form.memberCount || '0')} rounds × {form.roundDurationDays} days
          </span>
        </div>
      </div>

      {error && (
        <div className="p-2.5 bg-danger/10 border border-danger/30 rounded text-xs text-danger leading-relaxed">
          {error}
        </div>
      )}

      <button
        className="btn-primary w-full"
        onClick={handleCreate}
        disabled={!isConnected}
      >
        {isConnected ? 'Deploy Circle' : 'Connect wallet first'}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CirclesPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-12">

        <div className="flex items-center justify-between mb-8 animate-fade-up">
          <div>
            <p className="font-mono text-xs text-accent uppercase tracking-widest mb-1">Step 2 of 4</p>
            <h1 className="font-display text-2xl font-bold text-text">Savings Circles</h1>
          </div>
          <button className="btn-ghost text-xs" onClick={() => setShowCreate(s => !s)}>
            {showCreate ? '× Cancel' : '+ Create Circle'}
          </button>
        </div>

        <div className="grid sm:grid-cols-[1fr_300px] gap-8">

          {/* ── Table ─────────────────────────────────────────────────── */}
          <div className="animate-fade-up-d1">

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 px-3 pb-2 border-b border-border">
              {['Circle', 'Members', 'Contribution', 'State', ''].map(h => (
                <div key={h} className="data-label">{h}</div>
              ))}
            </div>

            {/* Rows */}
            {DEMO_CIRCLES.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-muted">No circles yet.</p>
                <button className="btn-ghost text-xs mt-3" onClick={() => setShowCreate(true)}>
                  Create the first one
                </button>
              </div>
            ) : (
              DEMO_CIRCLES.map((c) => (
                <div
                  key={c.address}
                  className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 px-3 py-3 border-b border-border/50 hover:bg-highlight transition-colors items-center"
                >
                  <div>
                    <div className="font-mono text-xs text-text">{truncateHex(c.address, 6)}</div>
                    <div className="font-mono text-[10px] text-muted/60 mt-0.5">
                      id: {truncateHex(c.circleId, 4)}
                    </div>
                  </div>
                  <div className="font-mono text-xs text-muted">
                    {c.joined}/{c.memberCount}
                  </div>
                  <div className="font-mono text-xs text-muted">
                    {c.contributionAmount} ETH
                  </div>
                  <div>
                    <span className={`badge ${
                      c.state === CircleState.JOINING   ? 'badge-joining'   :
                      c.state === CircleState.ACTIVE    ? 'badge-active'    :
                                                          'badge-completed'
                    }`}>
                      {STATE_LABELS[c.state]}
                    </span>
                  </div>
                  <div>
                    <Link
                      href={`/circles/${c.address}`}
                      className="btn-ghost text-[11px] py-1 px-2"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              ))
            )}

            {/* Hint about fetching circles from events */}
            <p className="text-xs text-muted/50 mt-4 font-mono">
              In production, circles are indexed from ROSCACircle deployment events.
            </p>
          </div>

          {/* ── Sidebar: create form or info ──────────────────────────── */}
          <aside className="space-y-4 animate-fade-up-d2">
            {showCreate ? (
              <CreateCircleForm onCreated={() => setShowCreate(false)} />
            ) : (
              <div className="panel space-y-3">
                <h3 className="font-display font-semibold text-xs text-muted uppercase tracking-widest">
                  About circles
                </h3>
                <div className="space-y-2 text-xs text-muted leading-relaxed">
                  <p>
                    Each circle is an independent ROSCACircle contract with its own membership Merkle root, contribution amount, and round schedule.
                  </p>
                  <p>
                    Joining requires a ZK proof of identity. Your membership in one circle is cryptographically unlinkable from your membership in another.
                  </p>
                </div>
                <div className="space-y-1 pt-1">
                  {[
                    ['Max members', '64'],
                    ['Min members', '2'],
                    ['Proof system', 'Groth16/BN254'],
                    ['Custody', 'FROST 2-of-3'],
                  ].map(([k, v]) => (
                    <div key={k} className="data-row">
                      <span className="data-label">{k}</span>
                      <span className="font-mono text-xs text-text">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

        </div>
      </main>
    </div>
  );
}
