// SHA-256 (FIPS 180-4) murni TypeScript. core tidak boleh mengimpor node:crypto (guard batas impor),
// dan fungsi ini harus sinkron & identik di server maupun peramban. Diuji silang dengan node:crypto.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const AWAL = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

const putar = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** SHA-256 atas byte → 32 byte. */
export function sha256(data: Uint8Array): Uint8Array {
  const panjangBit = BigInt(data.length) * 8n;
  const total = (((data.length + 9 + 63) >> 6) << 6) >>> 0;
  const blok = new Uint8Array(total);
  blok.set(data);
  blok[data.length] = 0x80;
  const tampilan = new DataView(blok.buffer);
  tampilan.setBigUint64(total - 8, panjangBit, false);

  const h = Uint32Array.from(AWAL);
  const w = new Uint32Array(64);
  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = tampilan.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const w15 = w[t - 15]!;
      const w2 = w[t - 2]!;
      const s0 = putar(w15, 7) ^ putar(w15, 18) ^ (w15 >>> 3);
      const s1 = putar(w2, 17) ^ putar(w2, 19) ^ (w2 >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!];
    for (let t = 0; t < 64; t++) {
      const S1 = putar(e, 6) ^ putar(e, 11) ^ putar(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t]! + w[t]!) >>> 0;
      const S0 = putar(a, 2) ^ putar(a, 13) ^ putar(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0;
    h[5] = (h[5]! + f) >>> 0;
    h[6] = (h[6]! + g) >>> 0;
    h[7] = (h[7]! + hh) >>> 0;
  }
  const keluar = new Uint8Array(32);
  const kv = new DataView(keluar.buffer);
  for (let i = 0; i < 8; i++) kv.setUint32(i * 4, h[i]!, false);
  return keluar;
}

const pengode = new TextEncoder();

/** SHA-256 atas UTF-8 teks → hex huruf kecil 64 karakter. */
export function sha256Hex(teks: string): string {
  let hex = "";
  for (const b of sha256(pengode.encode(teks))) hex += b.toString(16).padStart(2, "0");
  return hex;
}
