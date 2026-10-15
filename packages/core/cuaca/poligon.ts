// Titik-dalam-poligon, ray casting integer. Perkalian silang dengan BigInt (tanpa Float).
// Titik tepat di sisi/sudut poligon = di dalam.

/** [lintang_e6, bujur_e6] */
export type TitikE6 = readonly [latE6: number, lonE6: number];

function diSisi(x: bigint, y: bigint, xi: bigint, yi: bigint, xj: bigint, yj: bigint): boolean {
  const silang = (xj - xi) * (y - yi) - (x - xi) * (yj - yi);
  if (silang !== 0n) return false;
  const [xMin, xMaks] = xi < xj ? [xi, xj] : [xj, xi];
  const [yMin, yMaks] = yi < yj ? [yi, yj] : [yj, yi];
  return x >= xMin && x <= xMaks && y >= yMin && y <= yMaks;
}

export function titikDalamPoligon(latE6: number, lonE6: number, poligonE6: readonly TitikE6[]): boolean {
  const n = poligonE6.length;
  if (n < 3) return false;
  const y = BigInt(latE6);
  const x = BigInt(lonE6);
  let dalam = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = poligonE6[i]!;
    const pj = poligonE6[j]!;
    const yi = BigInt(pi[0]);
    const xi = BigInt(pi[1]);
    const yj = BigInt(pj[0]);
    const xj = BigInt(pj[1]);
    if (diSisi(x, y, xi, yi, xj, yj)) return true;
    if (yi > y !== yj > y) {
      const d = yj - yi;
      const kiri = (x - xi) * d;
      const kanan = (xj - xi) * (y - yi);
      // x < xi + (xj-xi)(y-yi)/d, dikali d agar tanpa pembagian
      if (d > 0n ? kiri < kanan : kiri > kanan) dalam = !dalam;
    }
  }
  return dalam;
}
