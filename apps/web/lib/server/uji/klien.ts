import { randomUUID } from "node:crypto";
import { crc32 } from "node:zlib";
import { uraiUrlDb } from "@serah/db/url";
import type { Peran } from "@serah/kontrak";
import { emailDemo } from "@serah/kontrak/demo";
import pg from "pg";
import { POST as masukDemo } from "@/app/api/auth/demo/route";
import { POST as gantiOrganisasi } from "@/app/api/sesi/organisasi/route";
import { muatEnv } from "../env";

// Pembantu test integrasi S08: panggil route handler langsung (tanpa server), sesi demo per peran,
// dan baca ID data demo sebagai pemilik (tanpa RLS). Butuh DEMO_MODE=true + DB ber-seed demo.

export const asal = () => new URL(muatEnv().BASE_URL).origin;

type Handler = (request: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export type Panggilan = {
  metode?: "GET" | "POST";
  jalur: string;
  cookie?: string;
  body?: unknown;
  form?: FormData;
  kunci?: string | null;
  params?: Record<string, string>;
  header?: Record<string, string>;
};

export type Hasil = { status: number; json: { ok: boolean; data?: unknown; galat?: { kode: string; pesan: string; aturan?: { kode: string; aksi: string; teks: string } } }; header: Headers };

export async function panggil(handler: unknown, p: Panggilan): Promise<Hasil> {
  const metode = p.metode ?? (p.body !== undefined || p.form ? "POST" : "GET");
  const header: Record<string, string> = { origin: asal(), ...(p.cookie ? { cookie: p.cookie } : {}), ...(p.header ?? {}) };
  if (p.kunci !== null && metode === "POST") header["idempotency-key"] = p.kunci ?? randomUUID();
  let body: BodyInit | undefined;
  if (p.form) body = p.form;
  else if (p.body !== undefined) {
    body = JSON.stringify(p.body);
    header["content-type"] = "application/json";
  }
  const r = await (handler as Handler)(new Request(`${asal()}${p.jalur}`, { method: metode, headers: header, ...(body ? { body } : {}) }), {
    params: Promise.resolve(p.params ?? {}),
  });
  const teks = await r.text();
  return { status: r.status, json: teks ? JSON.parse(teks) : {}, header: r.headers };
}

export function data<T = Record<string, unknown>>(h: Hasil): T {
  if (!h.json.ok) throw new Error(`diharapkan sukses, malah ${h.status} ${JSON.stringify(h.json.galat)}`);
  return h.json.data as T;
}

// ── DB pemilik (tanpa RLS) ─────────────────────────────────────────────────

export async function denganPemilik<T>(fn: (k: pg.Client) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL_MIGRASI;
  if (!url) throw new Error("DATABASE_URL_MIGRASI kosong — test integrasi butuh PostgreSQL ber-seed demo");
  const { connectionString, skema } = uraiUrlDb(url);
  const k = new pg.Client({ connectionString, options: `-c search_path=${skema}` });
  await k.connect();
  try {
    return await fn(k);
  } finally {
    await k.end();
  }
}

export async function satu<T extends pg.QueryResultRow>(sql: string, nilai: unknown[] = []): Promise<T> {
  const r = await denganPemilik((k) => k.query<T>(sql, nilai));
  if (!r.rows[0]) throw new Error(`tidak ada baris: ${sql}`);
  return r.rows[0];
}

export async function semua<T extends pg.QueryResultRow>(sql: string, nilai: unknown[] = []): Promise<T[]> {
  return (await denganPemilik((k) => k.query<T>(sql, nilai))).rows;
}

export type DemoS08 = {
  org: Record<"kawasan" | "pengangkut" | "daurUlang" | "pelapakBerkah" | "pelapakBaru" | "tpst" | "b3" | "tps3r", string>;
  kawasan: string;
  tps1: string;
  tps2: string;
  kendaraan: string;
};

export async function demo(): Promise<DemoS08> {
  const o = await semua<{ kode: string; id: string }>(`SELECT kode, id FROM organisasi WHERE demo`);
  const id = (kode: string) => o.find((x) => x.kode === kode)?.id ?? "";
  if (!id("ORG-PCS")) throw new Error("Data demo belum ada — jalankan seed dengan DEMO_MODE=true");
  const tps = await semua<{ kode: string; id: string }>(`SELECT kode, id FROM tps WHERE kode IN ('TPS-PCS-01', 'TPS-PCS-02')`);
  const kend = await satu<{ id: string }>(`SELECT id FROM kendaraan WHERE plat = 'B 9001 SRH'`);
  return {
    org: {
      kawasan: id("ORG-PCS"),
      pengangkut: id("ORG-ACB"),
      daurUlang: id("ORG-DUCM"),
      pelapakBerkah: id("ORG-PCBK"),
      pelapakBaru: id("ORG-PCBR"),
      tpst: id("ORG-TPSTC"),
      b3: id("ORG-FB3C"),
      tps3r: id("ORG-TPS3RC"),
    },
    kawasan: (await satu<{ id: string }>(`SELECT id FROM kawasan WHERE kode = 'KWS-PCS'`)).id,
    tps1: tps.find((t) => t.kode === "TPS-PCS-01")?.id ?? "",
    tps2: tps.find((t) => t.kode === "TPS-PCS-02")?.id ?? "",
    kendaraan: kend.id,
  };
}

// ── Sesi ───────────────────────────────────────────────────────────────────

const cacheCookie = new Map<string, string>();

/** Cookie sesi demo untuk peran (opsional: pindah ke organisasi lain, keanggotaan ditambahkan bila perlu). */
export async function masuk(peran: Peran, organisasiId?: string): Promise<string> {
  const kunci = `${peran}:${organisasiId ?? ""}`;
  const ada = cacheCookie.get(kunci);
  if (ada) return ada;
  const r = await masukDemo(
    new Request(`${asal()}/api/auth/demo`, { method: "POST", headers: { origin: asal(), "content-type": "application/json" }, body: JSON.stringify({ peran }) }),
  );
  if (r.status !== 200) throw new Error(`masuk demo ${peran} gagal: ${r.status}`);
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  if (organisasiId) {
    await denganPemilik(async (k) => {
      const p = await k.query<{ id: string }>(`SELECT id FROM pengguna WHERE email = $1`, [emailDemo(peran)]);
      await k.query(
        `INSERT INTO keanggotaan (id, pengguna_id, organisasi_id, peran, pengurus, aktif, dibuat_pada)
         VALUES ($1, $2, $3, $4, false, true, now()) ON CONFLICT (pengguna_id, organisasi_id, peran) DO NOTHING`,
        [`ujis08${randomUUID().replaceAll("-", "").slice(0, 18)}`, p.rows[0]?.id, organisasiId, peran],
      );
    });
    const g = await gantiOrganisasi(
      new Request(`${asal()}/api/sesi/organisasi`, {
        method: "POST",
        headers: { origin: asal(), "content-type": "application/json", cookie },
        body: JSON.stringify({ organisasiId, peran }),
      }),
    );
    if (g.status !== 200) throw new Error(`ganti organisasi gagal: ${g.status}`);
  }
  cacheCookie.set(kunci, cookie);
  return cookie;
}

// ── Gambar contoh (dengan metadata yang harus dibuang) ─────────────────────

function chunkPng(jenis: string, isi: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + isi.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, isi.length);
  out.set(new TextEncoder().encode(jenis), 4);
  out.set(isi, 8);
  dv.setUint32(8 + isi.length, crc32(out.subarray(4, 8 + isi.length)));
  return out;
}

/** PNG kecil berisi tEXt & eXIf (metadata) + IDAT unik per `benih`. Isi gambar tidak didekode server. */
export function pngContoh(benih: string, lebar = 4, tinggi = 3): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, lebar);
  dv.setUint32(4, tinggi);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const enc = new TextEncoder();
  const bagian = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunkPng("IHDR", ihdr),
    chunkPng("tEXt", enc.encode("Author\0Nama Orang Rahasia")),
    chunkPng("eXIf", enc.encode("MM\0*GPSLatitude-6.1")),
    chunkPng("IDAT", enc.encode(`data-gambar-${benih}`)),
    chunkPng("IEND", new Uint8Array()),
  ];
  const total = new Uint8Array(bagian.reduce((s, b) => s + b.length, 0));
  let i = 0;
  for (const b of bagian) {
    total.set(b, i);
    i += b.length;
  }
  return total;
}

/** JPEG minimal: SOI, APP1 Exif (GPS), COM, SOF0 (ukuran), SOS + data, EOI. */
export function jpegContoh(benih: string, lebar = 8, tinggi = 6): Uint8Array {
  const enc = new TextEncoder();
  const seg = (m: number, isi: Uint8Array) => new Uint8Array([0xff, m, (isi.length + 2) >> 8, (isi.length + 2) & 0xff, ...isi]);
  const sof = new Uint8Array([8, tinggi >> 8, tinggi & 0xff, lebar >> 8, lebar & 0xff, 1, 1, 0x11, 0]);
  return new Uint8Array([
    0xff, 0xd8,
    ...seg(0xe1, enc.encode("Exif\0\0GPSLatitude-6.164532")),
    ...seg(0xfe, enc.encode("komentar kamera")),
    ...seg(0xc0, sof),
    ...seg(0xda, new Uint8Array([1, 1, 0, 0, 0x3f, 0])),
    ...enc.encode(`entropi-${benih}`),
    0xff, 0xd9,
  ]);
}

export function formFoto(jenis: string, isi: Uint8Array, mime: string, serahKode?: string): FormData {
  const f = new FormData();
  f.set("jenis", jenis);
  if (serahKode) f.set("serahKode", serahKode);
  f.set("berkas", new Blob([isi.slice().buffer as ArrayBuffer], { type: mime }), "foto");
  return f;
}
