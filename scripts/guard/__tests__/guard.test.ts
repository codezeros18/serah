import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { guardBatasImpor } from "../a-batas-impor.ts";
import { guardKataTerlarang } from "../b-kata-terlarang.ts";
import { guardLiteralTeks } from "../c-literal-teks.ts";
import { guardFloatDecimal } from "../d-float-decimal.ts";
import { MODEL_ENTITAS_USAHA, MODEL_IDENTITAS, guardKolomIdentitas } from "../e-kolom-identitas.ts";
import { guardGeolokasi } from "../f-geolokasi.ts";
import { guardSdkAi } from "../g-sdk-ai.ts";
import { guardKosakataBayar } from "../h-kosakata-bayar.ts";
import { guardUbahSerah } from "../i-ubah-serah.ts";
import { guardKodePaket } from "../j-kode-paket.ts";
import { guardConsoleLog } from "../k-console-log.ts";
import { guardAmbangAturan } from "../l-ambang-aturan.ts";
import { guardEnvTertrack } from "../m-env-tertrack.ts";
import { IZIN_TANPA_PERAN, guardRuteMutasi, jalurRute } from "../n-rute-mutasi.ts";
import { guardTanpaStubProduksi } from "../o-tanpa-stub-produksi.ts";
import { DAFTAR_GUARD } from "../daftar.ts";
import { IZIN_KATA } from "../izin-kata.ts";
import type { Guard, Temuan } from "../jenis.ts";
import { ambilString, bersihkanKode } from "../util.ts";

// Setiap guard: "menggigit" (pelanggaran → temuan) dan "tidak salah tuduh" (kode sah → nol temuan).

function jalankan(g: Guard, berkas: Record<string, string>, tertrack: string[] = []): Temuan[] {
  const h = g.periksa({ berkas: Object.entries(berkas).map(([jalur, isi]) => ({ jalur, isi })), tertrack });
  if (h.status === "dilewati") throw new Error(`dilewati: ${h.sebab}`);
  return h.temuan;
}

describe("daftar guard", () => {
  it("berisi 15 guard (a)–(o) berurutan", () => {
    expect(DAFTAR_GUARD.map((g) => g.kode).join("")).toBe("abcdefghijklmno");
  });
});

describe("util pemindai", () => {
  it("membuang komentar tapi mempertahankan string berisi //", () => {
    const k = bersihkanKode(`const a = "http://x"; // console.log(1)\n/* serah.update( */ b();`);
    expect(k).toContain(`"http://x"`);
    expect(k).not.toContain("console.log");
    expect(k).not.toContain("serah.update");
    expect(k.split("\n").length).toBe(2);
  });

  it("mengambil string termasuk template dengan ekspresi", () => {
    const s = ambilString("const x = `halo ${nama} dunia`; const y = 'a b';").map((x) => x.nilai);
    expect(s).toEqual(["halo ", " dunia", "a b"]);
  });
});

describe("(a) batas-impor", () => {
  it("menggigit: core mengimpor Prisma, node:fs, db; memakai Date.now/new Date()/Math.random/fetch", () => {
    const t = jalankan(guardBatasImpor, {
      "packages/core/status/index.ts": [
        `import { PrismaClient } from "@prisma/client";`,
        `import { readFileSync } from "node:fs";`,
        `import x from "@serah/db";`,
        `const a = Date.now(); const b = new Date(); const c = Math.random(); fetch("x");`,
      ].join("\n"),
    });
    expect(t.map((x) => x.pesan).join("\n")).toMatch(/@prisma\/client/);
    expect(t.some((x) => x.pesan.includes("node:fs"))).toBe(true);
    expect(t.some((x) => x.pesan.includes("core tidak boleh mengimpor db"))).toBe(true);
    expect(t.filter((x) => /Date|Math\.random|fetch/.test(x.pesan)).length).toBe(4);
  });

  it("menggigit: kontrak mengimpor core, ui mengimpor core (bukan angka), db mengimpor core", () => {
    const t = jalankan(guardBatasImpor, {
      "packages/kontrak/src/a.ts": `import { x } from "@serah/core";`,
      "packages/ui/src/b.tsx": `import { y } from "@serah/core/status";\nimport z from "../../../apps/web/lib/klien/x";`,
      "packages/db/seed/c.ts": `import { kode } from "@serah/core/kode";`,
    });
    expect(t.length).toBe(4);
  });

  it("menggigit: klien → server/adaptor/db; server → klien; halaman → db; halaman → core", () => {
    const t = jalankan(guardBatasImpor, {
      "apps/web/lib/klien/a.ts": `import { s } from "../server/sesi";\nimport { b } from "@/lib/adaptor/bayar/x";\nimport { p } from "@serah/db";`,
      "apps/web/lib/server/b.ts": `import { k } from "@/lib/klien/fetch";`,
      "apps/web/app/(app)/petugas/page.tsx": `import { db } from "@serah/db";\nimport { r } from "@serah/core/rantai";`,
      "apps/web/app/api/x/route.ts": `import { db } from "@serah/db";`,
    });
    expect(t.length).toBe(7);
  });

  it("tidak salah tuduh: impor sah tiap zona", () => {
    const t = jalankan(guardBatasImpor, {
      "packages/kontrak/src/api/a.ts": `import { z } from "zod";\nimport { Aliran } from "../enum";`,
      "packages/kontrak/src/a.test.ts": `import { readFileSync } from "node:fs";\nimport { it } from "vitest";`,
      "packages/core/rantai/index.ts": `import type { Aliran } from "@serah/kontrak";\nimport { gram } from "../angka";\nconst t = new Date(sekarang.getTime());`,
      "packages/ui/src/Tombol.tsx": `import { useState } from "react";\nimport { formatGramKeKg } from "@serah/core/angka";\nimport { TEKS } from "@serah/kontrak/teks";`,
      "packages/db/seed/index.ts": `import { PrismaClient } from "@prisma/client";\nimport { PrismaPg } from "@prisma/adapter-pg";\nimport { ALIRAN } from "@serah/kontrak";`,
      "apps/web/lib/klien/a.ts": `import { formatGramKeKg } from "@serah/core/angka";\nimport { openDB } from "idb";`,
      "apps/web/app/(app)/page.tsx": `import { muatSesi } from "@/lib/server/sesi";\nimport { Tombol } from "@serah/ui";`,
      "apps/web/app/api/serah/route.ts": `import { terapkan } from "@serah/core/status";\nimport { denganAkses } from "@/lib/server/db";`,
      "apps/web/lib/server/db.ts": `import { PrismaClient } from "@serah/db";\n// import { x } from "@/lib/klien/y";`,
    });
    expect(t).toEqual([]);
  });
});

describe("(b) kata-terlarang", () => {
  it("menggigit: kata terlarang di halaman, ui, README, teks.ts (di luar kalimat izin)", () => {
    const t = jalankan(guardKataTerlarang, {
      "apps/web/app/(app)/kawasan/page.tsx": `<p>Kinerja TPS</p>`,
      "packages/ui/src/Lencana.tsx": `const label = "Pengangkut terbaik";`,
      "README.md": "SERAH mencegah banjir di kawasan.",
      "packages/kontrak/src/teks.ts": `X: "Data ini akurat.",`,
      "apps/web/lib/adaptor/email/templat.ts": `const s = "Pelanggaran tercatat";`,
    });
    expect(t.map((x) => x.pesan.toLowerCase())).toEqual([
      'kata terlarang "kinerja"',
      'kata terlarang "terbaik"',
      'kata terlarang "mencegah banjir"',
      'kata terlarang "akurat"',
      'kata terlarang "pelanggaran"',
    ]);
  });

  it("menggigit: kalimat izin di luar berkas yang diizinkan", () => {
    const t = jalankan(guardKataTerlarang, { "apps/web/app/(publik)/tentang/page.tsx": `<li>${IZIN_KATA[0]?.kalimat}</li>` });
    expect(t.length).toBe(1);
  });

  it("menggigit: teks.ts sungguhan tanpa daftar izin memuat tepat 2 kata terlarang", () => {
    const isi = readFileSync(new URL("../../../packages/kontrak/src/teks.ts", import.meta.url), "utf8");
    const t = jalankan(guardKataTerlarang, { "packages/kontrak/src/teks-salinan-tanpa-izin.ts": isi });
    // Berkas di luar daftar izin tidak dicakup → bandingkan langsung dengan cakupan teks.ts:
    expect(t).toEqual([]);
    const tanpaIzin = isi.replace("Tidak menjamin", "Tidak menjamin ").replace("melanggar hukum;", "melanggar  hukum;");
    const t2 = jalankan(guardKataTerlarang, { "packages/kontrak/src/teks.ts": tanpaIzin });
    expect(t2.map((x) => x.pesan).sort()).toEqual(['kata terlarang "melanggar"', 'kata terlarang "menjamin"']);
  });

  it("tidak salah tuduh: kalimat izin persis di teks.ts & README, kata mirip, berkas di luar cakupan", () => {
    const t = jalankan(guardKataTerlarang, {
      "packages/kontrak/src/teks.ts": IZIN_KATA.map((i) => `"${i.kalimat}"`).join("\n"),
      "README.md": IZIN_KATA.map((i) => `- ${i.kalimat}`).join("\n"),
      "apps/web/app/x/page.tsx": `<p>{TEKS.K3_JUDUL}</p> // skoring? diskon, nakalan-tidak: kata 'peringkatan' bukan kata utuh`,
      "packages/core/aturan/daftar.ts": `// melanggar (bukan teks pengguna)`,
      "apps/web/app/x/page.test.tsx": `expect(teks).not.toContain("skor")`,
    });
    expect(t).toEqual([]);
  });
});

describe("(c) literal-teks", () => {
  it("menggigit: string & teks JSX Indonesia ≥4 kata di halaman dan ui", () => {
    const t = jalankan(guardLiteralTeks, {
      "apps/web/app/(app)/petugas/page.tsx": `export default () => <p>Simpan catatan untuk hari ini</p>;`,
      "packages/ui/src/Kosong.tsx": `const pesan = "Belum ada data yang tersedia";`,
      "apps/web/app/api/x/route.ts": "const p = `Serah tidak dapat diterima sekarang`;",
    });
    expect(t.length).toBe(3);
  });

  it("tidak salah tuduh: className, teks.ts, kunci TEKS, URL, SQL, frasa pendek, test", () => {
    const t = jalankan(guardLiteralTeks, {
      "apps/web/app/(app)/petugas/page.tsx": [
        `import { TEKS } from "@serah/kontrak/teks";`,
        `export default () => <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4">{TEKS.T1_JUDUL}</main>;`,
        `const u = "https://data.bmkg.go.id/prakiraan-cuaca";`,
        `const q = "SELECT kode FROM serah WHERE status = $1 ORDER BY dibuat_pada";`,
        `const pendek = "Ya atau tidak";`,
        `// Komentar boleh: ini catatan untuk pengembang saja`,
      ].join("\n"),
      "packages/kontrak/src/teks.ts": `A: "Catatan ini tidak dapat diubah lagi",`,
      "apps/web/app/x.test.tsx": `it("menampilkan teks yang benar di layar", () => {});`,
    });
    expect(t).toEqual([]);
  });
});

const SKEMA_BERSIH = `
model Organisasi {
  id   String @id
  nama String
  @@map("organisasi")
}
model Pengguna {
  id    String @id
  email String @unique
  @@map("pengguna")
}
model TokenSekali {
  id              String @id
  emailTujuanHash String @map("email_tujuan_hash")
  @@map("token_sekali")
}
model PreferensiNotifikasi {
  penggunaId String @map("pengguna_id")
  email      Boolean
  @@map("preferensi_notifikasi")
}
model Kawasan {
  id            String @id
  nama          String
  namaKelurahan String? @map("nama_kelurahan")
  @@map("kawasan")
}
model WadahCatat {
  id    String @id
  beratG Int @map("berat_g")
  // nama petugas tidak disimpan (komentar)
  @@map("wadah_catat")
}
model Tps {
  latE6 Int @map("lat_e6")
  lonE6 Int @map("lon_e6")
  @@map("tps")
}
`;

describe("(d) float-decimal", () => {
  it("dilewati bila skema belum ada", () => {
    expect(guardFloatDecimal.periksa({ berkas: [{ jalur: "packages/db/index.ts", isi: "" }], tertrack: [] }).status).toBe("dilewati");
  });

  it("menggigit: Float, Decimal, @db.Decimal, numeric di SQL", () => {
    const t = jalankan(guardFloatDecimal, {
      "packages/db/prisma/schema.prisma": `model A {\n  berat Float\n  harga Decimal? @db.Decimal(10,2)\n}`,
      "packages/db/prisma/migrations/1/migration.sql": `ALTER TABLE a ADD COLUMN b numeric(10,2);\nCREATE TABLE c (d double precision);`,
    });
    expect(t.length).toBe(5);
  });

  it("tidak salah tuduh: Int, nama kolom mengandung 'real'/'float', komentar", () => {
    const t = jalankan(guardFloatDecimal, {
      "packages/db/prisma/schema.prisma": `${SKEMA_BERSIH}\nmodel B {\n  floatingG Int // bukan Float\n}`,
      "packages/db/sql/fungsi.sql": `-- tanpa numeric\nCREATE TABLE x (berat_g integer, realisasi_g bigint);`,
    });
    expect(t).toEqual([]);
  });
});

describe("(e) kolom-identitas", () => {
  it("dilewati bila skema belum ada", () => {
    expect(guardKolomIdentitas.periksa({ berkas: [], tertrack: [] }).status).toBe("dilewati");
  });

  it("menggigit: nama/email/telepon/lokasi/latitude/nik di model operasional", () => {
    const t = jalankan(guardKolomIdentitas, {
      "packages/db/prisma/schema.prisma": `model Serah {\n  namaSopir String\n  emailPetugas String\n  telepon String\n  lokasi_truk String @map("lokasi_truk")\n  latitude Int\n  nik String\n  @@map("serah")\n}`,
    });
    expect(t.length).toBe(6);
  });

  it("menggigit: kolom identitas selain nama di model usaha", () => {
    const t = jalankan(guardKolomIdentitas, {
      "packages/db/prisma/schema.prisma": `model Organisasi {\n  nama String\n  teleponPemilik String\n  @@map("organisasi")\n}`,
    });
    expect(t.map((x) => x.pesan)).toEqual(['Organisasi.teleponPemilik: kolom "telepon" di model operasional']);
  });

  it("tidak salah tuduh: model identitas, nama badan usaha, koordinat _e6, komentar", () => {
    expect(jalankan(guardKolomIdentitas, { "packages/db/prisma/schema.prisma": SKEMA_BERSIH })).toEqual([]);
  });

  it("T21: schema.prisma sungguhan aktif diperiksa dan bersih; model identitas & usaha yang dikecualikan memang ada", () => {
    const isi = readFileSync(new URL("../../../packages/db/prisma/schema.prisma", import.meta.url), "utf8");
    const jalur = "packages/db/prisma/schema.prisma";
    expect(guardKolomIdentitas.periksa({ berkas: [{ jalur, isi }], tertrack: [] })).toEqual({ status: "diperiksa", temuan: [] });
    expect(guardFloatDecimal.periksa({ berkas: [{ jalur, isi }], tertrack: [] })).toEqual({ status: "diperiksa", temuan: [] });
    const map = [...isi.matchAll(/@@map\("([a-z_]+)"\)/g)].map((m) => m[1]);
    for (const t of [...MODEL_IDENTITAS, ...MODEL_ENTITAS_USAHA]) expect(map, t).toContain(t);
  });
});

describe("(f) geolokasi", () => {
  it("menggigit: navigator.geolocation, getCurrentPosition, dependensi geolokasi", () => {
    const t = jalankan(guardGeolokasi, {
      "apps/web/lib/klien/a.ts": `navigator.geolocation.getCurrentPosition(cb);`,
      "apps/web/lib/klien/b.ts": `const g = navigator\n  .geolocation;`,
      "apps/web/package.json": `{ "dependencies": { "geolib": "1.0.0" } }`,
    });
    expect(t.length).toBe(4);
  });

  it("tidak salah tuduh: Permissions-Policy geolocation=(), komentar, teks", () => {
    const t = jalankan(guardGeolokasi, {
      "apps/web/next.config.ts": `const h = { "Permissions-Policy": "camera=(self), geolocation=()" };\n// navigator.geolocation dilarang`,
      "apps/web/package.json": `{ "dependencies": { "next": "16.4.1" } }`,
    });
    expect(t).toEqual([]);
  });
});

describe("(g) sdk-ai", () => {
  it("menggigit: SDK diimpor di luar adaptor ai", () => {
    const t = jalankan(guardSdkAi, {
      "apps/web/lib/server/layanan/tiket.ts": `import Anthropic from "@anthropic-ai/sdk";`,
      "packages/core/x.ts": `const m = await import("@anthropic-ai/sdk");`,
    });
    expect(t.length).toBe(2);
  });

  it("tidak salah tuduh: di adaptor ai, di komentar", () => {
    const t = jalankan(guardSdkAi, {
      "apps/web/lib/adaptor/ai/anthropic.ts": `import Anthropic from "@anthropic-ai/sdk";`,
      "apps/web/lib/server/a.ts": `// SDK "@anthropic-ai/sdk" hanya di adaptor\nimport { baca } from "@/lib/adaptor/ai";`,
    });
    expect(t).toEqual([]);
  });
});

describe("(h) kosakata-bayar", () => {
  it("menggigit: order_id, transaction_status, gross_amount, snap di luar adaptor bayar", () => {
    const t = jalankan(guardKosakataBayar, {
      "apps/web/app/api/webhook/midtrans/route.ts": `const id = body.order_id; if (body.transaction_status === "settlement") {}`,
      "apps/web/lib/server/layanan/bayar.ts": `const n = p.gross_amount; const snap = buat();`,
    });
    expect(t.length).toBe(4);
  });

  it("tidak salah tuduh: di adaptor bayar, snapshot BMKG, snapToken DTO, komentar", () => {
    const t = jalankan(guardKosakataBayar, {
      "apps/web/lib/adaptor/bayar/midtrans.ts": `const x = { order_id: n, gross_amount: t }; snap.createTransaction(x);`,
      "apps/web/lib/adaptor/bmkg/snapshot.ts": `const mode = "SNAPSHOT"; muatSnapshot();`,
      "packages/kontrak/src/api/tagihan.ts": `z.object({ snapToken: z.string() })\n// order_id tidak boleh di sini`,
    });
    expect(t).toEqual([]);
  });
});

describe("(i) ubah-serah", () => {
  it("menggigit: prisma.serah.update, tx.serah.updateMany, SQL UPDATE serah", () => {
    const t = jalankan(guardUbahSerah, {
      "apps/web/app/api/serah/route.ts": `await prisma.serah.update({ where, data });\nawait tx.serah.updateMany({});`,
      "apps/web/lib/server/cron.ts": "await tx.$executeRaw`UPDATE serah SET status = 'MENGGANTUNG'`;",
    });
    expect(t.length).toBe(3);
  });

  it("tidak salah tuduh: di transisi.ts, serah_wadah, serah.findMany, komentar", () => {
    const t = jalankan(guardUbahSerah, {
      "apps/web/lib/server/layanan/transisi.ts": `await tx.serah.update({ where, data });`,
      "apps/web/lib/server/a.ts": "await tx.serah.findMany({}); await tx.$executeRaw`UPDATE serah_wadah SET x = 1`;\n// serah.update( dilarang",
    });
    expect(t).toEqual([]);
  });
});

describe("(j) kode-paket", () => {
  it("menggigit: literal kode paket di layanan & halaman", () => {
    const t = jalankan(guardKodePaket, {
      "apps/web/lib/server/layanan/langganan.ts": `if (paket === "KAWASAN_STANDAR") {}\nconst p = { paketKode: "INTERNAL" };`,
      "apps/web/app/(app)/akun/page.tsx": `const gratis = kode === 'MITRA';`,
    });
    expect(t.length).toBe(3);
  });

  it("tidak salah tuduh: di hak.ts, seed, test, JenisOrganisasi INTERNAL, komentar", () => {
    const t = jalankan(guardKodePaket, {
      "apps/web/lib/server/hak.ts": `const BAWAAN = "KAWASAN_DASAR";`,
      "packages/db/seed/paket.ts": `["KAWASAN_UJI_COBA", "MITRA"]`,
      "packages/core/hak/index.test.ts": `"KAWASAN_STANDAR"`,
      "packages/kontrak/src/enum.ts": `export const JENIS_ORGANISASI = ["KAWASAN", "PENGANGKUT", "PENERIMA", "INTERNAL"] as const;`,
      "apps/web/lib/server/sesi.ts": `if (org.jenis === "INTERNAL") {}\n// paket "KAWASAN_STANDAR" dibaca dari data`,
    });
    expect(t).toEqual([]);
  });
});

describe("(k) console-log", () => {
  it("menggigit: console.log di app, packages, seed", () => {
    const t = jalankan(guardConsoleLog, {
      "apps/web/lib/server/a.ts": `console.log("x");`,
      "packages/core/b.ts": `console . log(1)`,
      "packages/db/seed/index.ts": `console.log("seed");`,
    });
    expect(t.length).toBe(3);
  });

  it("tidak salah tuduh: scripts/, console.error, komentar, string", () => {
    const t = jalankan(guardConsoleLog, {
      "scripts/wt-baru.mjs": `console.log("ok");`,
      "apps/web/lib/server/a.ts": `// console.log(x)\nconst s = "pakai console.log hanya di skrip";\nconsole.error(galat);`,
    });
    expect(t).toEqual([]);
  });
});

describe("(l) ambang-aturan", () => {
  it("menggigit: 72, 24, 12, 2000, 6 di core/aturan selain konfigurasi.ts", () => {
    const t = jalankan(guardAmbangAturan, {
      "packages/core/aturan/r05.ts": `if (umurJam >= 72) {}\nif (jam > 24 || jam > 12) {}\nconst bp = 2000; const n = 2_000; const x = 6;`,
    });
    expect(t.length).toBe(6);
  });

  it("tidak salah tuduh: konfigurasi.ts, kode R06/R12, angka lain, string, komentar, test, di luar aturan", () => {
    const t = jalankan(guardAmbangAturan, {
      "packages/core/aturan/konfigurasi.ts": `export const KONFIGURASI = { R05_JAM: 72, R06_JAM: 24, R07_JAM: 12, R08_BP: 2000 };`,
      "packages/core/aturan/daftar.ts": `const kode = "R06"; const a = KONFIGURASI.R05_JAM; const b = 10_000; const c = 0.6; // 72 jam\nconst teks = "batas 24 jam";`,
      "packages/core/aturan/r05.test.ts": `expect(evaluasi(72)).toBe(true);`,
      "packages/core/status/index.ts": `const MENGGANTUNG_JAM = 12;`,
    });
    expect(t).toEqual([]);
  });
});

describe("(m) env-tertrack", () => {
  it("menggigit: .env, .env.local, apps/web/.env.production ter-track", () => {
    expect(jalankan(guardEnvTertrack, {}, [".env", ".env.local", "apps/web/.env.production"]).length).toBe(3);
  });

  it("tidak salah tuduh: .env.example, envelope.ts, berkas tak ter-track", () => {
    expect(jalankan(guardEnvTertrack, { ".env": "RAHASIA=1" }, [".env.example", "packages/kontrak/src/env.ts", ".envrc.md"])).toEqual([]);
  });
});

describe("(n) rute-mutasi", () => {
  const kontrak = {
    "packages/kontrak/src/api/x.ts": [
      'rute({ metode: "POST", jalur: "/api/serah", akses: ["PETUGAS", "PENGELOLA"], masukan: A, keluaran: B }),',
      'rute({ metode: "POST", jalur: "/api/admin/paket", akses: ["ADMIN"], masukan: A, keluaran: B }),',
      'rute({ metode: "POST", jalur: "/api/akun/hapus", akses: ["SESI"], masukan: A, keluaran: B }),',
      'rute({ metode: "POST", jalur: "/api/webhook/midtrans", akses: ["WEBHOOK"], masukan: A, keluaran: B }),',
      'rute({ metode: "POST", jalur: "/api/cron/harian", akses: ["CRON"], masukan: A, keluaran: B }),',
      'rute({ metode: "POST", jalur: "/api/baru", akses: ["SESI"], masukan: A, keluaran: B }),',
    ].join("\n"),
  };
  const sah = {
    "apps/web/app/api/serah/route.ts": `export const POST = tanganiRute(async (r) => { cekAsal(r); const sesi = await wajibSesi(r); wajibPeran(sesi, "PETUGAS", "PENGELOLA"); });
export const GET = tanganiRute(async (r) => { const sesi = await wajibSesi(r); });`,
    "apps/web/app/api/admin/paket/route.ts": `export const POST = tanganiRute(async (r) => dalamAdmin(r, {}, () => 1));`,
    "apps/web/app/api/akun/hapus/route.ts": `export const POST = tanganiRute(async (r) => { cekAsal(r); await wajibSesi(r); });`,
    "apps/web/app/api/webhook/midtrans/route.ts": `export const POST = tanganiRute(async (r) => terimaNotifikasi(r));`,
    "apps/web/app/api/cron/harian/route.ts": `export const POST = tanganiRute(async (r) => { wajibCron(r); });`,
  };
  // Hanya izin yang relevan untuk fixture ini; entri izin lain dilaporkan "tidak ada sebagai handler".
  const relevan = (t: Temuan[]) => t.filter((x) => !x.pesan.startsWith("IZIN_TANPA_PERAN memuat"));

  it("jalurRute membuang grup rute dan akhiran route.ts", () => {
    expect(jalurRute("apps/web/app/api/serah/[kode]/tutup/route.ts")).toBe("/api/serah/[kode]/tutup");
    expect(jalurRute("apps/web/app/(app)/kawasan/page.tsx")).toBeNull();
  });

  it("tidak salah tuduh: peran persis kontrak, dalamAdmin, SESI dengan izin, webhook & cron", () => {
    expect(relevan(jalankan(guardRuteMutasi, { ...kontrak, ...sah }))).toEqual([]);
  });

  it("menggigit: tanpa wajibPeran, peran berbeda dari kontrak, tanpa cekAsal, tanpa wajibSesi/wajibCron, tidak di kontrak, tanpa izin", () => {
    const pesan = (berkas: Record<string, string>) => relevan(jalankan(guardRuteMutasi, { ...kontrak, ...sah, ...berkas })).map((t) => t.pesan);
    expect(pesan({ "apps/web/app/api/serah/route.ts": `export const POST = tanganiRute(async (r) => { cekAsal(r); await wajibSesi(r); });` })).toEqual([
      "POST /api/serah: tanpa wajibPeran (kontrak: PETUGAS, PENGELOLA)",
    ]);
    expect(pesan({ "apps/web/app/api/serah/route.ts": `export const POST = tanganiRute(async (r) => { cekAsal(r); wajibPeran(sesi, "PETUGAS"); });` })[0]).toMatch(/≠ kontrak/);
    expect(pesan({ "apps/web/app/api/serah/route.ts": `export const POST = tanganiRute(async (r) => { wajibPeran(sesi, "PENGELOLA", "PETUGAS"); });` })).toEqual([
      "POST /api/serah: mutasi tanpa cekAsal (CSRF Origin)",
    ]);
    expect(pesan({ "apps/web/app/api/akun/hapus/route.ts": `export const POST = tanganiRute(async (r) => { cekAsal(r); });` })).toEqual([
      "POST /api/akun/hapus: akses SESI/PENGURUS tanpa wajibSesi",
    ]);
    expect(pesan({ "apps/web/app/api/cron/harian/route.ts": `export const POST = tanganiRute(async (r) => 1);` })).toEqual(["POST /api/cron/harian: rute CRON tanpa wajibCron"]);
    expect(pesan({ "apps/web/app/api/liar/route.ts": `export const DELETE = tanganiRute(async (r) => 1);` })).toEqual([
      "DELETE /api/liar: tidak ada di kontrak (packages/kontrak/src/api)",
    ]);
    expect(pesan({ "apps/web/app/api/baru/route.ts": `export const POST = tanganiRute(async (r) => { cekAsal(r); await wajibSesi(r); });` })).toEqual([
      "POST /api/baru: tanpa peran di kontrak (SESI) tetapi tidak tercantum di IZIN_TANPA_PERAN",
    ]);
  });

  it("daftar izin hanya berisi rute tanpa peran yang nyata (dilaporkan bila basi)", () => {
    expect(Object.keys(IZIN_TANPA_PERAN).length).toBeGreaterThan(0);
    const t = jalankan(guardRuteMutasi, { ...kontrak, ...sah }).filter((x) => x.pesan.startsWith("IZIN_TANPA_PERAN memuat"));
    expect(t.map((x) => x.pesan)).toContain("IZIN_TANPA_PERAN memuat POST /api/auth/masuk yang tidak ada sebagai handler");
  });
});

describe("(o) tanpa-stub-produksi", () => {
  it("menggigit: impor lib/server/uji, impor integrasi-stub, menyebut stub, membaca API_MOCK sembarangan", () => {
    const t = jalankan(guardTanpaStubProduksi, {
      "apps/web/lib/server/layanan/x.ts": `import { manualPembaca } from "../uji/stub-integrasi";
export const a = manualPembaca;`,
      "apps/web/app/api/y/route.ts": `import { integrasi } from "@/lib/server/integrasi-stub";`,
      "apps/web/lib/klien/komponen/z.tsx": `export const m = process.env.NEXT_PUBLIC_API_MOCK === "true";`,
    }).map((x) => `${x.berkas}: ${x.pesan}`);
    expect(t).toContain('apps/web/lib/server/layanan/x.ts: kode produksi mengimpor "../uji/stub-integrasi" (stub/pembantu test)');
    expect(t).toContain('apps/web/lib/server/layanan/x.ts: kode produksi menyebut stub "manualPembaca"');
    expect(t).toContain('apps/web/app/api/y/route.ts: kode produksi mengimpor "@/lib/server/integrasi-stub" (stub/pembantu test)');
    expect(t).toContain("apps/web/lib/klien/komponen/z.tsx: NEXT_PUBLIC_API_MOCK dibaca di luar api.ts/mock/env.ts");
  });
  it("tidak salah tuduh: test, folder uji, mock klien, api.ts, env.ts, impor integrasi biasa", () => {
    expect(
      jalankan(guardTanpaStubProduksi, {
        "apps/web/lib/server/layanan/x.ts": `import { integrasi } from "../integrasi";`,
        "apps/web/lib/server/uji/stub-integrasi.ts": `export const manualPembaca = 1;`,
        "apps/web/app/api/a.test.ts": `import { manualPembaca } from "@/lib/server/uji/stub-integrasi";`,
        "apps/web/lib/klien/api.ts": `export const MOCK = process.env.NEXT_PUBLIC_API_MOCK === "true";`,
        "apps/web/lib/klien/mock.ts": `// NEXT_PUBLIC_API_MOCK
export const x = 1;`,
        "apps/web/lib/server/env.ts": `const k = "NEXT_PUBLIC_API_MOCK";`,
        "packages/core/x.ts": `export const manualPembaca = 1;`,
      }),
    ).toEqual([]);
  });
});

