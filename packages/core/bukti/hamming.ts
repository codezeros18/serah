// Jarak Hamming antar dHash 64-bit (hex 16 karakter). Murni, tanpa Float.

const POLA_DHASH = /^[0-9a-f]{16}$/i;

export function adalahDhash(s: string): boolean {
  return POLA_DHASH.test(s);
}

export function jarakHamming(a: string, b: string): number {
  if (!adalahDhash(a) || !adalahDhash(b)) throw new Error("dHash harus 16 karakter heksadesimal");
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x > 0n) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}
