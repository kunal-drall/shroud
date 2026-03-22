'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWalletClient, usePublicClient } from 'wagmi';
import { parseEther, keccak256, stringToBytes, encodeAbiParameters } from 'viem';
import { Nav } from '@/components/Nav';
import { DEPLOYED_ADDRESSES, ROSCA_CIRCLE_BYTECODE, CircleState, STATE_LABELS } from '@/lib/contracts';
import { truncateHex } from '@/lib/crypto';
import { supabase } from '@/lib/supabase';
import type { CircleRow } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CircleEntry {
  address: string;
  circleId: string;
  memberCount: number;
  contributionAmount: string;
  state: CircleState;
  joined: number;
}

function rowToEntry(r: CircleRow): CircleEntry {
  return {
    address:            r.address,
    circleId:           r.circle_id,
    memberCount:        r.member_count,
    contributionAmount: r.contribution_amount,
    state:              r.state as CircleState,
    joined:             r.joined,
  };
}

// Demo circles — always shown regardless of DB
const DEMO_CIRCLES: CircleEntry[] = [
  {
    address:            DEPLOYED_ADDRESSES.demoCircle,
    circleId:           keccak256(stringToBytes('shroud-demo-circle-1')),
    memberCount:        5,
    contributionAmount: '0.01',
    state:              CircleState.JOINING,
    joined:             0,
  },
];

// ── Create form ───────────────────────────────────────────────────────────────

const DEMO_PUBKEY_X = BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798');
const DEMO_PUBKEY_Y = BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8');

function CreateCircleForm({ onCreated }: { onCreated: (entry: CircleEntry) => void }) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [form, setForm] = useState({
    memberCount:        '5',
    contributionAmount: '0.01',
    roundDurationDays:  '7',
    name:               'My Circle',
  });
  const [status, setStatus] = useState<'idle' | 'deploying' | 'mining' | 'done'>('idle');
  const [deployed, setDeployed] = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleCreate = async () => {
    if (!walletClient) { setError('Connect wallet first'); return; }
    setError(null);
    setStatus('deploying');
    try {
      const memberCount       = BigInt(form.memberCount);
      const contributionWei   = parseEther(form.contributionAmount);
      const roundDurationSecs = BigInt(parseInt(form.roundDurationDays) * 86400);
      const circleId          = BigInt(keccak256(stringToBytes(form.name + Date.now())));

      const rootResp = await fetch('https://sepolia-rollup.arbitrum.io/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_call',
          params: [{ to: DEPLOYED_ADDRESSES.identityRegistry, data: '0x49590657' }, 'latest'],
        }),
      });
      const merkleRoot = ((await rootResp.json()).result ?? ('0x' + '0'.repeat(64))) as `0x${string}`;

      const constructorArgs = encodeAbiParameters(
        [
          { type: 'address' }, { type: 'address' },
          { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' },
          { type: 'bytes32' }, { type: 'uint256' },
          { type: 'uint256' }, { type: 'uint256' },
        ],
        [
          DEPLOYED_ADDRESSES.membershipVerifier,
          DEPLOYED_ADDRESSES.frostVerifier,
          memberCount, contributionWei, roundDurationSecs,
          merkleRoot, circleId,
          DEMO_PUBKEY_X, DEMO_PUBKEY_Y,
        ]
      );

      const initcode = (ROSCA_CIRCLE_BYTECODE + constructorArgs.slice(2)) as `0x${string}`;
      const hash = await walletClient.sendTransaction({
        data: initcode, gas: 2_000_000n,
        maxFeePerGas: 1_000_000_000n, maxPriorityFeePerGas: 10_000_000n,
      });

      setStatus('mining');
      if (!publicClient) throw new Error('No RPC client — refresh and try again');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const contractAddress = receipt.contractAddress;
      if (!contractAddress) throw new Error('No contract address in receipt');

      const entry: CircleEntry = {
        address:            contractAddress,
        circleId:           '0x' + circleId.toString(16).padStart(64, '0'),
        memberCount:        Number(memberCount),
        contributionAmount: form.contributionAmount,
        state:              CircleState.JOINING,
        joined:             0,
      };

      // Persist to Supabase
      if (supabase) {
        await supabase.from('circles').upsert({
          address:             entry.address,
          circle_id:           entry.circleId,
          member_count:        entry.memberCount,
          contribution_amount: entry.contributionAmount,
          state:               entry.state,
          joined:              entry.joined,
        });
      }

      setDeployed(contractAddress);
      setStatus('done');
      onCreated(entry);
    } catch (e: any) {
      setError((e as Error).message ?? 'Deployment failed');
      setStatus('idle');
    }
  };

  return (
    <div className="panel space-y-4">
      <h3 className="font-display font-semibold text-sm text-text">Create Circle</h3>
      <p className="text-xs text-muted leading-relaxed">
        Deploy a new ROSCACircle contract. Rules are enforced on-chain — no admin can override them.
      </p>

      {status === 'done' && deployed ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2.5 bg-accent/10 border border-accent/30 rounded text-xs text-accent font-medium">
            <span>✓</span> Circle deployed
          </div>
          <div className="data-row">
            <span className="data-label">Contract</span>
            <span className="font-mono text-xs text-text">{truncateHex(deployed, 8)}</span>
          </div>
          <Link href={`/circles/${deployed}`} className="btn-primary w-full text-center block text-xs">
            View Circle →
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div>
              <label className="data-label block mb-1">Circle Name</label>
              <input className="input-field" type="text" value={form.name} onChange={set('name')} />
            </div>
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
              <span>Pool per round:</span>
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
            disabled={status === 'deploying' || status === 'mining' || !walletClient}
          >
            {status === 'deploying' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Awaiting signature…
              </span>
            ) : status === 'mining' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Mining…
              </span>
            ) : walletClient ? 'Deploy Circle' : 'Connect wallet first'}
          </button>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CirclesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [dbCircles, setDbCircles]   = useState<CircleEntry[]>([]);
  const [loading, setLoading]       = useState(true);

  // Load circles from Supabase on mount
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase
      .from('circles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setDbCircles(data.map(rowToEntry));
        setLoading(false);
      });
  }, []);

  // Deduplicate against DEMO_CIRCLES by address
  const demoAddrs = new Set(DEMO_CIRCLES.map(c => c.address.toLowerCase()));
  const allCircles = [
    ...DEMO_CIRCLES,
    ...dbCircles.filter(c => !demoAddrs.has(c.address.toLowerCase())),
  ];

  const handleCircleCreated = (entry: CircleEntry) => {
    setDbCircles(prev => [entry, ...prev]);
    setShowCreate(false);
  };

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

          {/* ── Table ──────────────────────────────────────────────── */}
          <div className="animate-fade-up-d1">
            <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 px-3 pb-2 border-b border-border">
              {['Circle', 'Members', 'Contribution', 'State', ''].map(h => (
                <div key={h} className="data-label">{h}</div>
              ))}
            </div>

            {loading ? (
              <div className="py-8 flex items-center gap-3 px-3">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span className="text-sm text-muted">Loading circles…</span>
              </div>
            ) : allCircles.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-muted">No circles yet.</p>
                <button className="btn-ghost text-xs mt-3" onClick={() => setShowCreate(true)}>
                  Create the first one
                </button>
              </div>
            ) : (
              allCircles.map((c) => (
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
                  <div className="font-mono text-xs text-muted">{c.joined}/{c.memberCount}</div>
                  <div className="font-mono text-xs text-muted">{c.contributionAmount} ETH</div>
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
                    <Link href={`/circles/${c.address}`} className="btn-ghost text-[11px] py-1 px-2">
                      View →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Sidebar ────────────────────────────────────────────── */}
          <aside className="space-y-4 animate-fade-up-d2">
            {showCreate ? (
              <CreateCircleForm onCreated={handleCircleCreated} />
            ) : (
              <div className="panel space-y-3">
                <h3 className="font-display font-semibold text-xs text-muted uppercase tracking-widest">
                  About circles
                </h3>
                <div className="space-y-2 text-xs text-muted leading-relaxed">
                  <p>
                    Each circle is an independent ROSCACircle contract with its own membership Merkle root,
                    contribution amount, and round schedule.
                  </p>
                  <p>
                    Joining requires a ZK proof of identity. Your membership in one circle is
                    cryptographically unlinkable from your membership in another.
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
