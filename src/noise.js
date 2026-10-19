// Compact 2D simplex noise (public-domain algorithm by Stefan Gustavson), seeded.
export function createNoise2D(seed = 1) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  return (xin, yin) => {
    const sk = (xin + yin) * F2;
    const i = Math.floor(xin + sk); const j = Math.floor(yin + sk);
    const t = (i + j) * G2;
    const x0 = xin - (i - t); const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0; const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2; const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2; const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255; const jj = j & 255;
    let n = 0;
    const c = (x, y, g) => { let tt = 0.5 - x * x - y * y; if (tt < 0) return 0; tt *= tt; const gr = grad[g % 8]; return tt * tt * (gr[0] * x + gr[1] * y); };
    n += c(x0, y0, perm[ii + perm[jj]]);
    n += c(x1, y1, perm[ii + i1 + perm[jj + j1]]);
    n += c(x2, y2, perm[ii + 1 + perm[jj + 1]]);
    return 70 * n;
  };
}

export function seeded(seed = 7) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
