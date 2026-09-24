/** Deterministic string → index. Avoids Object.hashCode and crypto (sync, no deps). */
export function stableIndex(str: string, length: number): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h) % length;
}
