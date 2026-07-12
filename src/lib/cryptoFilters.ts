import type { Crypto } from '../types/crypto';

/** Lọc coin có symbol HOẶC tên chứa từ khóa (không phân biệt hoa/thường). */
export function filterCryptos(cryptos: Crypto[], query: string): Crypto[] {
  const q = query.trim().toLowerCase();
  if (!q) return cryptos;
  return cryptos.filter(
    (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
  );
}
