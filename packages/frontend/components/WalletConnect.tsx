'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { useEffect, useState } from 'react';
import { arbitrumSepolia } from '@/lib/wagmi';
import { truncateHex } from '@/lib/crypto';

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Avoid hydration mismatch: always render the button until client-side state is ready
  if (!mounted || !isConnected) {
    return (
      <button
        className="btn-ghost text-xs"
        onClick={() => {
          const metaMaskConnector = connectors.find(c => c.name === 'MetaMask') ?? connectors[0];
          connect({ connector: metaMaskConnector });
        }}
      >
        Connect Wallet
      </button>
    );
  }

  if (isWrongChain) {
    return (
      <button
        className="btn-ghost text-xs border-warn/40 text-warn"
        onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
      >
        Switch to Arbitrum Sepolia
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-accent" />
        <span className="font-mono text-muted">
          {truncateHex(address!, 4)}
        </span>
      </div>
      <button
        className="btn-ghost text-xs py-1.5 px-2"
        onClick={() => disconnect()}
      >
        ×
      </button>
    </div>
  );
}
