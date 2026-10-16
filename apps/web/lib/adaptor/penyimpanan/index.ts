// Adaptor `Penyimpanan` (BLUEPRINT §O.3). Mode `lokal` menulis ke ./.data/foto (dev & test);
// mode `r2` memakai Cloudflare R2 (S3-kompatibel), bucket privat, unduh lewat URL bertanda tangan.
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface Penyimpanan {
  simpan(kunci: string, buffer: Buffer, mime: string): Promise<void>;
  /** URL yang berlaku `detik` detik. */
  urlBertandaTangan(kunci: string, detik: number): Promise<string>;
  hapus(kunci: string): Promise<void>;
}

const POLA_KUNCI = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;

/** Kunci objek hanya boleh karakter aman; menolak `..` dan jalur absolut. */
export function kunciSah(kunci: string): boolean {
  return POLA_KUNCI.test(kunci) && !kunci.split("/").some((s) => s === ".." || s === "." || s === "");
}

/** Kunci objek foto: org/<organisasi_id>/<yyyy>/<mm>/<foto_id>.webp */
export function kunciFoto(organisasiId: string, fotoId: string, waktu: Date): string {
  const yyyy = String(waktu.getUTCFullYear());
  const mm = String(waktu.getUTCMonth() + 1).padStart(2, "0");
  return `org/${organisasiId}/${yyyy}/${mm}/${fotoId}.webp`;
}

export type OpsiLokal = {
  /** Direktori dasar; bawaan ./.data/foto. */
  dir?: string;
  /** Rahasia penanda tangan URL lokal. */
  rahasia: string;
  /** Awalan URL layanan unduh lokal, mis. `${BASE_URL}/api/foto-lokal`. */
  awalanUrl: string;
  /** Jam untuk kedaluwarsa (disuntik agar bisa dites). */
  sekarang?: () => number;
};

/** Mode lokal. URL ditandatangani HMAC `kunci.kedaluwarsa`; rute pelayan memanggil `bacaLokal`. */
export class PenyimpananLokal implements Penyimpanan {
  private readonly dir: string;
  private readonly jam: () => number;

  constructor(private readonly o: OpsiLokal) {
    this.dir = resolve(o.dir ?? join(process.cwd(), ".data", "foto"));
    this.jam = o.sekarang ?? (() => Date.now());
  }

  private jalur(kunci: string): string {
    if (!kunciSah(kunci)) throw new Error("Kunci penyimpanan tidak sah");
    const p = resolve(this.dir, kunci);
    if (!p.startsWith(this.dir + sep)) throw new Error("Kunci penyimpanan di luar direktori");
    return p;
  }

  async simpan(kunci: string, buffer: Buffer, _mime: string): Promise<void> {
    const p = this.jalur(kunci);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, buffer);
  }

  private tanda(kunci: string, kedaluwarsa: number): string {
    return createHmac("sha256", this.o.rahasia).update(`${kunci}.${kedaluwarsa}`).digest("hex");
  }

  async urlBertandaTangan(kunci: string, detik: number): Promise<string> {
    this.jalur(kunci);
    const exp = Math.floor(this.jam() / 1000) + detik;
    return `${this.o.awalanUrl}/${kunci}?exp=${exp}&sig=${this.tanda(kunci, exp)}`;
  }

  /** Dipakai rute pelayan: kembalikan isi bila tanda tangan sah & belum kedaluwarsa, selain itu null. */
  async bacaLokal(kunci: string, exp: number, sig: string): Promise<Buffer | null> {
    if (!kunciSah(kunci) || exp < Math.floor(this.jam() / 1000)) return null;
    const benar = Buffer.from(this.tanda(kunci, exp), "hex");
    const dapat = Buffer.from(sig, "hex");
    if (benar.length !== dapat.length || !timingSafeEqual(benar, dapat)) return null;
    try {
      return await readFile(this.jalur(kunci));
    } catch {
      return null;
    }
  }

  async hapus(kunci: string): Promise<void> {
    await rm(this.jalur(kunci), { force: true });
  }
}

export type OpsiR2 = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

export class PenyimpananR2 implements Penyimpanan {
  private readonly s3: S3Client;

  constructor(private readonly o: OpsiR2) {
    this.s3 = new S3Client({
      region: "auto",
      endpoint: `https://${o.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: o.accessKeyId, secretAccessKey: o.secretAccessKey },
    });
  }

  async simpan(kunci: string, buffer: Buffer, mime: string): Promise<void> {
    if (!kunciSah(kunci)) throw new Error("Kunci penyimpanan tidak sah");
    await this.s3.send(new PutObjectCommand({ Bucket: this.o.bucket, Key: kunci, Body: buffer, ContentType: mime }));
  }

  /** Isi objek, atau null bila tidak ada (dipakai server untuk menyajikan foto lewat URL bertanda tangan aplikasi). */
  async baca(kunci: string): Promise<Buffer | null> {
    if (!kunciSah(kunci)) throw new Error("Kunci penyimpanan tidak sah");
    try {
      const r = await this.s3.send(new GetObjectCommand({ Bucket: this.o.bucket, Key: kunci }));
      return r.Body ? Buffer.from(await r.Body.transformToByteArray()) : null;
    } catch (e) {
      if (e instanceof NoSuchKey || (e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }

  urlBertandaTangan(kunci: string, detik: number): Promise<string> {
    if (!kunciSah(kunci)) throw new Error("Kunci penyimpanan tidak sah");
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.o.bucket, Key: kunci }), { expiresIn: detik });
  }

  async hapus(kunci: string): Promise<void> {
    if (!kunciSah(kunci)) throw new Error("Kunci penyimpanan tidak sah");
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.o.bucket, Key: kunci }));
  }
}

export type EnvPenyimpanan = {
  PENYIMPANAN_MODE: "lokal" | "r2";
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  SESI_SECRET?: string;
  BASE_URL?: string;
};

/** Pabrik menurut `PENYIMPANAN_MODE`. Env diberikan pemanggil (lib/server); adaptor tidak membaca process.env. */
export function buatPenyimpanan(env: EnvPenyimpanan): Penyimpanan {
  if (env.PENYIMPANAN_MODE === "r2") {
    const { R2_ACCOUNT_ID: a, R2_ACCESS_KEY_ID: k, R2_SECRET_ACCESS_KEY: s, R2_BUCKET: b } = env;
    if (!a || !k || !s || !b) throw new Error("Konfigurasi R2 tidak lengkap");
    return new PenyimpananR2({ accountId: a, accessKeyId: k, secretAccessKey: s, bucket: b });
  }
  return new PenyimpananLokal({
    rahasia: env.SESI_SECRET ?? "rahasia-lokal-dev",
    awalanUrl: `${env.BASE_URL ?? "http://localhost:3000"}/api/foto-lokal`,
  });
}
