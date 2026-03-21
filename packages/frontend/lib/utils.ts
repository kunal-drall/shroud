import { type ClassValue, clsx } from 'clsx';

/** Merge tailwind class names safely */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Truncate a hex address: 0x1234...5678 */
export function formatAddress(addr: string, chars = 4): string {
  if (!addr) return '';
  return `${addr.slice(0, 2 + chars)}...${addr.slice(-chars)}`;
}

/** Format wei as ETH with up to 4 decimal places */
export function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(4).replace(/\.?0+$/, '') + ' ETH';
}

/** Zero-pad a bigint to 32 bytes hex */
export function toHex32(n: bigint): `0x${string}` {
  return `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;
}
