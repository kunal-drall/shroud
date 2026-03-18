'use client';

import { useState } from 'react';
import { truncateHex } from '@/lib/crypto';

interface NullifierDisplayProps {
  nullifier: string;
  label?: string;
}

export function NullifierDisplay({ nullifier, label = 'Nullifier' }: NullifierDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(nullifier);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-xs text-muted uppercase tracking-widest">{label}</span>
      )}
      <button
        onClick={() => { handleCopy(); setExpanded(e => !e); }}
        title="Click to copy"
        className="text-left group"
      >
        <span
          className={[
            'font-mono text-sm transition-all duration-200',
            expanded ? 'text-text' : 'text-muted',
            'group-hover:text-text',
          ].join(' ')}
        >
          {expanded ? nullifier : truncateHex(nullifier, 8)}
        </span>
        {copied && (
          <span className="ml-2 text-xs text-accent">copied</span>
        )}
      </button>
      <p className="text-xs text-muted leading-relaxed">
        Your nullifier for this circle. Cryptographically unlinkable from your nullifiers in other circles.
      </p>
    </div>
  );
}
