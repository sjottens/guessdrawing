/** Uniform random integer in [0, max). Uses Web Crypto, so it runs in Workers and Node. */
export function randomInt(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0]! >= limit);
  return buf[0]! % max;
}

export function randomId(): string {
  return crypto.randomUUID();
}
