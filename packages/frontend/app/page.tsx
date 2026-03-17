import Link from 'next/link';
import { Nav } from '@/components/Nav';

const STATS = [
  { label: 'Proving System', value: 'Groth16',    sub: 'BN254 elliptic curve' },
  { label: 'Constraints',    value: '1,911',       sub: 'Poseidon Merkle depth-6' },
  { label: 'Chain',          value: 'Arb Sepolia', sub: 'Chain ID 421614' },
];

const LAYERS = [
  {
    tag: 'Identity Layer',
    title: 'Anonymous Self-Credentials',
    body: 'Members register an on-chain identity commitment and prove membership with a Groth16 ZK proof. Circle-specific nullifiers prevent double-joining without revealing identity.',
    ref: 'ePrint 2025/618',
  },
  {
    tag: 'Protocol Layer',
    title: 'ROSCA State Machine',
    body: 'A novel state machine connects identity and custody. Members join, contribute each round, and receive one payout per lifecycle. Defaults are handled by deadline logic.',
    ref: 'Novel — Shroud',
  },
  {
    tag: 'Custody Layer',
    title: 'FROST Threshold Signatures',
    body: 'Funds are held at a threshold-controlled address. Disbursements require a 2-of-3 FROST signature co-signed by Thetacrypt TEE nodes, verified on-chain.',
    ref: 'arXiv 2502.03247',
  },
];

const STEPS = [
  { n: '01', title: 'Register',   body: 'Generate a master secret key. Compute your identity commitment = Poseidon(msk). Register on-chain — your key never leaves your browser.' },
  { n: '02', title: 'Join',       body: 'Submit a ZK proof of Merkle tree membership plus a circle-specific nullifier. The nullifier prevents double-joining without revealing which leaf you are.' },
  { n: '03', title: 'Contribute', body: 'Each round, all members contribute the agreed ETH amount to the pool. Contributions are tracked by pseudonym, not wallet address.' },
  { n: '04', title: 'Claim',      body: 'When it\'s your turn, claim the full pool. Disbursement requires a FROST threshold signature from Thetacrypt nodes, verified on-chain.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-16">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="mb-20 animate-fade-up">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-px h-12 bg-accent mt-1 flex-shrink-0" />
            <div>
              <p className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                Shape Rotator 2026 · Cryptographic Primitives &amp; Identity
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-text leading-none tracking-tight">
                Private savings circles
              </h1>
            </div>
          </div>

          <div className="ml-4 space-y-3 mb-10">
            {[
              'Open protocol.',
              'Anonymous membership via ZK proofs.',
              'Threshold custody via FROST signatures.',
            ].map((line, i) => (
              <p key={line} className={`font-mono text-sm text-muted animate-fade-up-d${i + 1}`}>
                {line}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 animate-fade-up-d3">
            <Link href="/register" className="btn-primary">Register Identity</Link>
            <Link href="/circles"  className="btn-ghost">Browse Circles</Link>
          </div>
        </section>

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        <section className="mb-20 animate-fade-up-d2">
          <div className="grid grid-cols-3 border border-border rounded overflow-hidden">
            {STATS.map(({ label, value, sub }, i) => (
              <div key={label} className={`px-5 py-4 ${i < STATS.length - 1 ? 'border-r border-border' : ''}`}>
                <div className="text-xs text-muted uppercase tracking-widest mb-1">{label}</div>
                <div className="font-mono text-lg font-semibold text-text">{value}</div>
                <div className="text-xs text-muted/60 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Three-layer architecture ───────────────────────────────────── */}
        <section className="mb-20 animate-fade-up-d3">
          <h2 className="font-display font-semibold text-xs text-muted uppercase tracking-widest mb-6">
            Architecture
          </h2>
          <div className="grid sm:grid-cols-3 gap-px bg-border rounded overflow-hidden">
            {LAYERS.map(({ tag, title, body, ref }) => (
              <div key={tag} className="bg-bg p-5 space-y-3">
                <div>
                  <span className="text-[10px] font-mono text-accent uppercase tracking-widest">{tag}</span>
                  <h3 className="font-display font-semibold text-sm text-text mt-1">{title}</h3>
                </div>
                <p className="text-xs text-muted leading-relaxed">{body}</p>
                <span className="inline-block text-[10px] font-mono text-muted/50 border border-border rounded px-1.5 py-0.5">
                  {ref}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section className="animate-fade-up-d4">
          <h2 className="font-display font-semibold text-xs text-muted uppercase tracking-widest mb-6">
            How it works
          </h2>
          <div className="space-y-0">
            {STEPS.map(({ n, title, body }, i) => (
              <div key={n} className={`flex gap-6 py-6 ${i < STEPS.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="font-mono text-xs text-muted/40 pt-0.5 w-6 flex-shrink-0">{n}</div>
                <div>
                  <div className="font-display font-semibold text-sm text-text mb-1">{title}</div>
                  <div className="text-xs text-muted leading-relaxed">{body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      <footer className="border-t border-border py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <span className="font-mono text-xs text-muted">Shroud Protocol · Arbitrum Sepolia</span>
          <div className="flex items-center gap-4">
            <a href="https://eprint.iacr.org/2025/618" target="_blank" rel="noopener noreferrer"
               className="font-mono text-xs text-muted hover:text-text transition-colors">ASC Paper</a>
            <a href="https://arxiv.org/abs/2502.03247" target="_blank" rel="noopener noreferrer"
               className="font-mono text-xs text-muted hover:text-text transition-colors">Thetacrypt</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
