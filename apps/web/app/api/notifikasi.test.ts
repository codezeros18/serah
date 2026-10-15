import { randomBytes } from "node:crypto";
import { JENIS_NOTIFIKASI, TEKS, type JenisNotifikasi, type Peran } from "@serah/kontrak";
import { emailDemo } from "@serah/kontrak/demo";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PengirimRekam } from "@/lib/adaptor/email";
import type { HasilPush, LanggananPush, PayloadPush, PengirimPush } from "@/lib/adaptor/push";
import { denganSistem } from "@/lib/server/db";
import { buatNotifikasi, kalimatNotifikasi, placeholderNotifikasi, setelKanalNotifikasiUji } from "@/lib/server/notifikasi";
import { orgBaru } from "@/lib/server/uji/akun";
import { data, demo, denganPemilik, masuk, panggil, satu, semua, type DemoS08 } from "@/lib/server/uji/klien";
import { POST as bacaSatu } from "./notifikasi/[id]/baca/route";
import { POST as bacaSemua } from "./notifikasi/baca-semua/route";
import { GET as daftar } from "./notifikasi/route";
import { GET as kunciPublik } from "./push/kunci-publik/route";
import { DELETE as berhenti, POST as langganan } from "./push/langganan/route";

// S17-2/S17-3 — notifikasi: penerima peran per jenis, pengiriman push & email setelah commit (preferensi, hak paket,
// 410), API daftar/baca/baca-semua, langganan push.

class PushRekam implements PengirimPush {
  terkirim: { endpoint: string; payload: PayloadPush }[] = [];
  hasil: HasilPush = { ok: true };
  async kirim(l: LanggananPush, payload: PayloadPush): Promise<HasilPush> {
    this.terkirim.push({ endpoint: l.endpoint, payload });
    return this.hasil;
  }
}

const push = new PushRekam();
const email = new PengirimRekam();
let d: DemoS08;
let jenisOrg: Record<"KAWASAN" | "PENGANGKUT" | "PENERIMA", string>;

beforeAll(async () => {
  d = await demo();
  jenisOrg = { KAWASAN: d.org.kawasan, PENGANGKUT: d.org.pengangkut, PENERIMA: d.org.daurUlang };
  setelKanalNotifikasiUji({ push, email });
});
afterAll(() => setelKanalNotifikasiUji(null));
beforeEach(() => {
  push.terkirim = [];
  push.hasil = { ok: true };
  email.terkirim.length = 0;
});

const isiData = (jenis: JenisNotifikasi) => Object.fromEntries(placeholderNotifikasi(jenis).map((p) => [p, `uji-${p}`]));
const kodeUnik = () => `UJI-${randomBytes(6).toString("hex")}`;

/** Tabel penerima ditulis tangan (matriks §G), independen dari PERAN_TUJUAN. */
const HARAP: Record<JenisNotifikasi, Partial<Record<"KAWASAN" | "PENGANGKUT" | "PENERIMA", Peran[]>>> = {
  SERAH_MENUNGGU_SETUJU: { KAWASAN: ["PENGELOLA"] },
  SERAH_DIANGKUT: { PENGANGKUT: ["PENGANGKUT"], PENERIMA: ["PENERIMA"] },
  SERAH_DITUTUP: { KAWASAN: ["PENGELOLA", "PETUGAS"], PENGANGKUT: ["PENGANGKUT"] },
  SERAH_MENGGANTUNG: { KAWASAN: ["PENGELOLA"], PENGANGKUT: ["PENGANGKUT"], PENERIMA: ["PENERIMA"] },
  PRIORITAS_ANGKUT: { KAWASAN: ["PETUGAS", "PENGELOLA"], PENGANGKUT: ["PENGANGKUT"] },
  WADAH_LEWAT_BATAS: { KAWASAN: ["PETUGAS", "PENGELOLA"] },
  CATATAN_HARIAN_BELUM: { KAWASAN: ["PETUGAS", "PENGELOLA"] },
  KONTRAK_PERLU_KONFIRMASI: { PENGANGKUT: ["PENGANGKUT"], PENERIMA: ["PENERIMA"] },
  PERMINTAAN_KOREKSI: { KAWASAN: ["PENGELOLA"], PENERIMA: ["PENERIMA"] },
  IZIN_DIPUTUS: { PENGANGKUT: ["PENGANGKUT"], PENERIMA: ["PENERIMA"] },
  TAGIHAN_TERBIT: { KAWASAN: ["PENGELOLA"] },
  UJI_COBA_BERAKHIR: { KAWASAN: ["PENGELOLA"] },
};

describe("buatNotifikasi — penerima peran per jenis (S17-2)", () => {
  it.each(JENIS_NOTIFIKASI.map((j) => [j]))("%s: peran tujuan per jenis organisasi sesuai matriks", async (jenis) => {
    for (const [org, id] of Object.entries(jenisOrg) as [keyof typeof jenisOrg, string][]) {
      const kode = kodeUnik();
      const n = await denganSistem((tx) => buatNotifikasi(tx, [{ jenis, organisasiId: id, objekKode: kode, data: isiData(jenis) }], new Date()));
      const baris = await semua<{ peran: string[] }>(`SELECT peran_tujuan::text[] AS peran FROM notifikasi WHERE objek_kode = $1`, [kode]);
      const harap = HARAP[jenis][org];
      if (harap) {
        expect(n, `${jenis}/${org}`).toBe(1);
        expect(baris.map((b) => [...b.peran].sort()), `${jenis}/${org}`).toEqual([[...harap].sort()]);
      } else {
        expect(n, `${jenis}/${org}`).toBe(0);
        expect(baris, `${jenis}/${org}`).toEqual([]);
      }
    }
  });

  it("data wajib tepat placeholder NTF_*: kurang atau kelebihan ditolak; peran di luar tujuan ditolak", async () => {
    const tulis = (data: Record<string, string>, peran?: Peran[]) =>
      denganSistem((tx) => buatNotifikasi(tx, [{ jenis: "SERAH_DIANGKUT", organisasiId: d.org.daurUlang, objekKode: kodeUnik(), data, ...(peran ? { peran } : {}) }], new Date()));
    await expect(tulis({ kode: "SRH-1" })).rejects.toThrow(/placeholder penerima/);
    await expect(tulis({ kode: "SRH-1", penerima: "X", email: "a@b.c" })).rejects.toThrow(/di luar placeholder/);
    await expect(tulis({ kode: "SRH-1", penerima: "X" }, ["PENGELOLA"])).rejects.toThrow(/peran di luar tujuan/);
    expect(await tulis({ kode: "SRH-1", penerima: "X" }, ["PENERIMA"])).toBe(1);
  });

  it("teks dari NTF_* dengan placeholder terisi", () => {
    expect(kalimatNotifikasi("SERAH_DIANGKUT", { kode: "SRH-20261015-0001", penerima: "Daur Ulang Contoh Mandiri" })).toBe(
      TEKS.NTF_SERAH_DIANGKUT.replace("{kode}", "SRH-20261015-0001").replace("{penerima}", "Daur Ulang Contoh Mandiri"),
    );
  });
});

describe("pengiriman push & email (setelah commit)", () => {
  let penggunaPengelola: string;
  const endpoint = `https://push.contoh.invalid/${randomBytes(8).toString("hex")}`;

  beforeAll(async () => {
    penggunaPengelola = (await satu<{ id: string }>(`SELECT id FROM pengguna WHERE email = $1`, [emailDemo("PENGELOLA")])).id;
    await denganPemilik((k) =>
      k.query(`INSERT INTO langganan_push (id, pengguna_id, endpoint, p256dh, auth, dibuat_pada) VALUES ($1, $2, $3, 'p', 'a', now())`, [
        `ujs17l${randomBytes(9).toString("hex")}`,
        penggunaPengelola,
        endpoint,
      ]),
    );
  });

  const kirimMenunggu = (kode = kodeUnik()) =>
    denganSistem((tx) => buatNotifikasi(tx, [{ jenis: "SERAH_MENUNGGU_SETUJU", organisasiId: d.org.kawasan, objekKode: kode, data: { kode } }], new Date())).then(() => kode);

  it("push ke langganan pengelola: judul APP_NAMA, isi teks NTF, tautan detail serah; email ke pengelola terverifikasi", async () => {
    const kode = await kirimMenunggu();
    const ke = push.terkirim.filter((p) => p.endpoint === endpoint);
    expect(ke).toEqual([{ endpoint, payload: { judul: TEKS.APP_NAMA, isi: kalimatNotifikasi("SERAH_MENUNGGU_SETUJU", { kode }), url: `/serah/${kode}` } }]);
    const surel = email.terkirim.filter((e) => e.ke === emailDemo("PENGELOLA"));
    expect(surel).toHaveLength(1);
    expect(surel[0]?.teks).toContain(kalimatNotifikasi("SERAH_MENUNGGU_SETUJU", { kode }));
    // Petugas bukan peran tujuan SERAH_MENUNGGU_SETUJU.
    expect(email.terkirim.some((e) => e.ke === emailDemo("PETUGAS"))).toBe(false);
  });

  it("preferensi pengguna: push/email dimatikan → tidak dikirim (in-app tetap tercatat)", async () => {
    await denganPemilik((k) =>
      k.query(
        `INSERT INTO preferensi_notifikasi (pengguna_id, organisasi_id, email, push) VALUES ($1, $2, false, false)
         ON CONFLICT (pengguna_id, organisasi_id) DO UPDATE SET email = false, push = false`,
        [penggunaPengelola, d.org.kawasan],
      ),
    );
    try {
      const kode = await kirimMenunggu();
      expect(push.terkirim.filter((p) => p.endpoint === endpoint)).toEqual([]);
      expect(email.terkirim.filter((e) => e.ke === emailDemo("PENGELOLA"))).toEqual([]);
      expect(Number((await satu<{ n: string }>(`SELECT count(*) AS n FROM notifikasi WHERE objek_kode = $1`, [kode])).n)).toBe(1);
    } finally {
      await denganPemilik((k) => k.query(`DELETE FROM preferensi_notifikasi WHERE pengguna_id = $1 AND organisasi_id = $2`, [penggunaPengelola, d.org.kawasan]));
    }
  });

  it("hak paket: organisasi paket DASAR (notifikasi.email = false) tidak menerima email, push tetap", async () => {
    const org = `ujs17o${randomBytes(9).toString("hex")}`;
    await denganPemilik(async (k) => {
      await k.query(
        `INSERT INTO organisasi (id, kode, nama, jenis, aliran_diterima, status_izin, yurisdiksi, demo, dibuat_pada)
         VALUES ($1, $2, 'Kawasan Uji S17', 'KAWASAN', ARRAY[]::"Aliran"[], 'BELUM_DIAJUKAN', 'DKI', false, now())`,
        [org, `ORG-UJ17${randomBytes(3).toString("hex")}`],
      );
      await k.query(
        `INSERT INTO langganan (id, organisasi_id, paket_kode, status, diperbarui_pada) VALUES ($1, $2, 'KAWASAN_DASAR', 'AKTIF', now())`,
        [`ujs17g${randomBytes(9).toString("hex")}`, org],
      );
    });
    await masuk("PENGELOLA", org); // keanggotaan PENGELOLA demo di organisasi ini
    const kode = kodeUnik();
    await denganSistem((tx) => buatNotifikasi(tx, [{ jenis: "TAGIHAN_TERBIT", organisasiId: org, objekKode: kode, data: { nomor: "TGH-202610-0001", jumlah: "350.000" } }], new Date()));
    expect(email.terkirim).toEqual([]);
    expect(push.terkirim.filter((p) => p.endpoint === endpoint).map((p) => p.payload.url)).toEqual(["/notifikasi"]);
  });

  it("push 404/410 → langganan dihapus", async () => {
    const usang = `https://push.contoh.invalid/${randomBytes(8).toString("hex")}`;
    await denganPemilik((k) =>
      k.query(`INSERT INTO langganan_push (id, pengguna_id, endpoint, p256dh, auth, dibuat_pada) VALUES ($1, $2, $3, 'p', 'a', now())`, [
        `ujs17l${randomBytes(9).toString("hex")}`,
        penggunaPengelola,
        usang,
      ]),
    );
    push.hasil = { ok: false, hapusLangganan: true };
    await kirimMenunggu();
    expect((await semua(`SELECT 1 FROM langganan_push WHERE endpoint = $1`, [usang])).length).toBe(0);
    push.hasil = { ok: true };
    // Endpoint utama juga ikut terhapus oleh hasil 410 di atas → daftarkan ulang untuk test berikutnya.
    await denganPemilik((k) =>
      k.query(
        `INSERT INTO langganan_push (id, pengguna_id, endpoint, p256dh, auth, dibuat_pada) VALUES ($1, $2, $3, 'p', 'a', now()) ON CONFLICT (endpoint) DO NOTHING`,
        [`ujs17l${randomBytes(9).toString("hex")}`, penggunaPengelola, endpoint],
      ),
    );
  });

  it("transaksi batal → tidak ada baris, push, maupun email", async () => {
    const kode = kodeUnik();
    await expect(
      denganSistem(async (tx) => {
        await buatNotifikasi(tx, [{ jenis: "SERAH_MENUNGGU_SETUJU", organisasiId: d.org.kawasan, objekKode: kode, data: { kode } }], new Date());
        throw new Error("batal");
      }),
    ).rejects.toThrow("batal");
    expect(push.terkirim).toEqual([]);
    expect(email.terkirim).toEqual([]);
    expect(await semua(`SELECT 1 FROM notifikasi WHERE objek_kode = $1`, [kode])).toEqual([]);
  });
});

describe("API notifikasi (S17-3)", () => {
  type Daftar = { notifikasi: { id: string; jenis: string; objekKode: string; data: Record<string, unknown>; dibaca: boolean }[] };

  it("hanya peran tujuan di organisasi aktif yang melihat; baca pribadi & idempoten; baca-semua; milik orang lain 404", async () => {
    const [pengelola, petugas, penerima] = [await masuk("PENGELOLA"), await masuk("PETUGAS"), await masuk("PENERIMA")];
    const kode = kodeUnik();
    await denganSistem((tx) => buatNotifikasi(tx, [{ jenis: "SERAH_MENUNGGU_SETUJU", organisasiId: d.org.kawasan, objekKode: kode, data: { kode } }], new Date()));
    const cari = async (c: string) => data<Daftar>(await panggil(daftar, { jalur: "/api/notifikasi", cookie: c })).notifikasi.find((n) => n.objekKode === kode);

    const n = await cari(pengelola);
    expect(n).toMatchObject({ jenis: "SERAH_MENUNGGU_SETUJU", data: { kode }, dibaca: false });
    expect(await cari(petugas)).toBeUndefined(); // organisasi sama, peran bukan tujuan
    expect(await cari(penerima)).toBeUndefined(); // organisasi lain

    expect((await panggil(bacaSatu, { jalur: "/", cookie: penerima, kunci: null, params: { id: n!.id }, body: {} })).status).toBe(404);
    expect(data(await panggil(bacaSatu, { jalur: "/", cookie: pengelola, kunci: null, params: { id: n!.id }, body: {} }))).toEqual({ id: n!.id, dibaca: true });
    expect(data(await panggil(bacaSatu, { jalur: "/", cookie: pengelola, kunci: null, params: { id: n!.id }, body: {} }))).toEqual({ id: n!.id, dibaca: true });
    expect((await cari(pengelola))?.dibaca).toBe(true);
    const belum = data<Daftar>(await panggil(daftar, { jalur: "/api/notifikasi?belumDibaca=true", cookie: pengelola })).notifikasi;
    expect(belum.some((x) => x.objekKode === kode)).toBe(false);

  });

  it("baca-semua: menandai semua yang belum dibaca, idempoten (organisasi terisolasi: test paralel lain tidak ikut menambah)", async () => {
    // Organisasi demo dipakai bersama berkas test lain yang berjalan paralel, sehingga notifikasi baru bisa muncul di
    // antara dua panggilan. Kawasan baru milik test ini saja membuat hitungan pasti.
    const o = await orgBaru(new PengirimRekam(), { jenis: "KAWASAN" });
    for (let i = 0; i < 2; i++) {
      await denganSistem((tx) => buatNotifikasi(tx, [{ jenis: "SERAH_MENUNGGU_SETUJU", organisasiId: o.organisasiId, objekKode: kodeUnik(), data: { kode: "X" } }], new Date()));
    }
    expect(data<{ jumlah: number }>(await panggil(bacaSemua, { jalur: "/", cookie: o.cookie, kunci: null, body: {} })).jumlah).toBe(2);
    expect(data<Daftar>(await panggil(daftar, { jalur: "/api/notifikasi?belumDibaca=true", cookie: o.cookie })).notifikasi).toEqual([]);
    expect(data<{ jumlah: number }>(await panggil(bacaSemua, { jalur: "/", cookie: o.cookie, kunci: null, body: {} })).jumlah).toBe(0);
  });

  it("tanpa sesi → 401; mutasi tanpa Origin → 400", async () => {
    expect((await panggil(daftar, { jalur: "/api/notifikasi" })).status).toBe(401);
    const c = await masuk("PENGELOLA");
    const r = await (bacaSemua as unknown as (r: Request) => Promise<Response>)(new Request("http://x/api/notifikasi/baca-semua", { method: "POST", headers: { cookie: c } }));
    expect(r.status).toBe(400);
  });
});

describe("API push (S17-3)", () => {
  it("langganan disimpan; endpoint yang sama dari pengguna lain dipindahkan; berhenti menghapus milik sendiri; kunci publik", async () => {
    const [pengelola, penerima] = [await masuk("PENGELOLA"), await masuk("PENERIMA")];
    const endpoint = `https://push.contoh.invalid/${randomBytes(8).toString("hex")}`;
    const body = { endpoint, keys: { p256dh: "kunci-p256dh", auth: "kunci-auth" } };
    expect(data(await panggil(langganan, { jalur: "/", cookie: pengelola, kunci: null, body }))).toEqual({ ok: true });
    const pemilik = async () => (await semua<{ email: string }>(`SELECT p.email FROM langganan_push l JOIN pengguna p ON p.id = l.pengguna_id WHERE l.endpoint = $1`, [endpoint])).map((r) => r.email);
    expect(await pemilik()).toEqual([emailDemo("PENGELOLA")]);

    expect(data(await panggil(langganan, { jalur: "/", cookie: penerima, kunci: null, body }))).toEqual({ ok: true });
    expect(await pemilik()).toEqual([emailDemo("PENERIMA")]);

    // Pengelola tidak bisa menghapus langganan yang kini milik penerima.
    const hapusPengelola = await (berhenti as unknown as (r: Request) => Promise<Response>)(
      new Request(`${process.env.BASE_URL}/api/push/langganan`, { method: "DELETE", headers: { cookie: pengelola, origin: new URL(process.env.BASE_URL!).origin, "content-type": "application/json" }, body: JSON.stringify({ endpoint }) }),
    );
    expect(hapusPengelola.status).toBe(200);
    expect(await pemilik()).toEqual([emailDemo("PENERIMA")]);
    const hapusPenerima = await (berhenti as unknown as (r: Request) => Promise<Response>)(
      new Request(`${process.env.BASE_URL}/api/push/langganan`, { method: "DELETE", headers: { cookie: penerima, origin: new URL(process.env.BASE_URL!).origin, "content-type": "application/json" }, body: JSON.stringify({ endpoint }) }),
    );
    expect(hapusPenerima.status).toBe(200);
    expect(await pemilik()).toEqual([]);

    expect((await panggil(langganan, { jalur: "/", cookie: pengelola, kunci: null, body: { endpoint: "bukan-url", keys: body.keys } })).status).toBe(400);
    expect(data(await panggil(kunciPublik, { jalur: "/", cookie: pengelola }))).toEqual({ kunciPublik: process.env.VAPID_PUBLIC_KEY || null });
  });
});
