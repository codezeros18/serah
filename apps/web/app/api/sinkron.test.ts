import { randomUUID } from "node:crypto";
import { TEKS } from "@serah/kontrak";
import { beforeAll, describe, expect, it } from "vitest";
import { data, demo, formFoto, masuk, panggil, pngContoh, satu, type DemoS08 } from "@/lib/server/uji/klien";
import { POST as unggah } from "./foto/route";
import { POST as ambil } from "./serah/[kode]/ambil/route";
import { POST as buatSerah } from "./serah/route";
import { POST as sinkron } from "./sinkron/route";
import { POST as catatWadah } from "./wadah/route";

// S08-5 — T17 integrasi: sinkron idempoten (aksi sama 2× → 1 efek) + transisi kedaluwarsa → SINKRON_DITOLAK.

let d: DemoS08;
let petugas: string;
let pengangkut: string;

beforeAll(async () => {
  d = await demo();
  petugas = await masuk("PETUGAS");
  pengangkut = await masuk("PENGANGKUT");
});

const t = () => new Date().toISOString();
const wadahAksi = (kunci = randomUUID(), aliran = "KUNING") => ({
  idempotencyKey: kunci,
  terjadiPada: t(),
  jenis: "WADAH_CATAT",
  payload: { tpsId: d.tps1, aliran, beratG: 7_000, terjadiPada: t() },
});
const kirim = (aksi: unknown[], cookie = petugas, kunci?: string) => panggil(sinkron, { jalur: "/api/sinkron", cookie, kunci, body: { aksi } });
type Hasil = { hasil: { idempotencyKey: string; status: string; galat?: { kode: string; pesan: string } }[] };

describe("T17 — POST /api/sinkron", () => {
  it("aksi sama 2× dalam satu batch → DITERAPKAN lalu DUPLIKAT; satu baris, ditandai offline", async () => {
    const a = wadahAksi();
    const h = data<Hasil>(await kirim([a, a]));
    expect(h.hasil.map((x) => x.status)).toEqual(["DITERAPKAN", "DUPLIKAT"]);
    const w = await satu<{ n: string; offline: boolean }>(`SELECT count(*) AS n, bool_and(offline) AS offline FROM wadah_catat WHERE idempotency_key = $1`, [a.idempotencyKey]);
    expect(w).toEqual({ n: "1", offline: true });
  });

  it("aksi yang sudah terkirim online lalu terulang dari antrean → DUPLIKAT (rute sama)", async () => {
    const kunci = randomUUID();
    const a = wadahAksi(kunci);
    data(await panggil(catatWadah, { jalur: "/api/wadah", cookie: petugas, kunci, body: a.payload }));
    expect(data<Hasil>(await kirim([a])).hasil[0]?.status).toBe("DUPLIKAT");
    expect(Number((await satu<{ n: string }>(`SELECT count(*) AS n FROM event WHERE idempotency_key = $1`, [kunci])).n)).toBe(1);
  });

  it("batch dikirim ulang (kunci batch sama) → respons batch identik + Idempotent-Replay", async () => {
    const kunci = randomUUID();
    const batch = [wadahAksi(), wadahAksi(randomUUID(), "ABU")];
    const a = await kirim(batch, petugas, kunci);
    const b = await kirim(batch, petugas, kunci);
    expect(b.json).toEqual(a.json);
    expect(b.header.get("idempotent-replay")).toBe("true");
    expect(data<Hasil>(a).hasil.map((x) => x.status)).toEqual(["DITERAPKAN", "DITERAPKAN"]);
  });

  it("transisi kedaluwarsa: AMBIL dari antrean atas serah yang sudah diambil → DITOLAK TRANSISI_TIDAK_SAH + audit SINKRON_DITOLAK", async () => {
    const w = data<{ id: string }>(await panggil(catatWadah, { jalur: "/api/wadah", cookie: petugas, body: { tpsId: d.tps1, aliran: "KUNING", beratG: 5_000, terjadiPada: t() } }));
    const kode = data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: petugas, body: { tpsId: d.tps1, wadahIds: [w.id] } })).kode;
    const foto = (benih: string) =>
      panggil(unggah, { jalur: "/api/foto", cookie: pengangkut, kunci: null, form: formFoto("MUATAN", pngContoh(benih), "image/png", kode) }).then((h) => data<{ fotoId: string }>(h).fotoId);
    const fotoOnline = await foto(randomUUID());
    const fotoOffline = await foto(randomUUID());
    data(await panggil(ambil, { jalur: "/", cookie: pengangkut, params: { kode }, body: { fotoId: fotoOnline, kendaraanId: d.kendaraan, penerimaId: d.org.daurUlang } }));

    const kunci = randomUUID();
    const h = data<Hasil>(
      await kirim(
        [{ idempotencyKey: kunci, terjadiPada: t(), jenis: "SERAH_AMBIL", payload: { kode, fotoId: fotoOffline, kendaraanId: d.kendaraan, penerimaId: d.org.daurUlang } }],
        pengangkut,
      ),
    );
    expect(h.hasil[0]).toEqual({ idempotencyKey: kunci, status: "DITOLAK", galat: { kode: "TRANSISI_TIDAK_SAH", pesan: TEKS.G_SINKRON_TOLAK, rincian: [{ jalur: [], kode: "STATUS_TIDAK_COCOK" }] } });
    const audit = await satu<{ aksi: string; objek_jenis: string; peran: string; galat: string }>(
      `SELECT aksi, objek_jenis, peran::text, data->'galat'->>'kode' AS galat FROM audit_log WHERE objek_id = $1`,
      [kunci],
    );
    expect(audit).toEqual({ aksi: "SINKRON_DITOLAK", objek_jenis: "SERAH_AMBIL", peran: "PENGANGKUT", galat: "TRANSISI_TIDAK_SAH" });
    expect((await satu<{ status: string; versi: number }>(`SELECT status::text, versi FROM serah WHERE kode = $1`, [kode]))).toEqual({ status: "MENUNGGU_SETUJU", versi: 2 });
  });

  it("satu aksi ditolak tidak membatalkan aksi lain di batch yang sama", async () => {
    const baik = wadahAksi();
    const salah = { ...wadahAksi(), payload: { ...wadahAksi().payload, tpsId: "tz4a98xxat96iws9zmbrgj3a" } };
    const h = data<Hasil>(await kirim([salah, baik]));
    expect(h.hasil.map((x) => x.status)).toEqual(["DITOLAK", "DITERAPKAN"]);
  });

  it("peran salah per aksi → DITOLAK PERAN_TIDAK_BOLEH; batch > 20 → 400", async () => {
    expect(data<Hasil>(await kirim([wadahAksi()], pengangkut)).hasil[0]?.galat?.kode).toBe("PERAN_TIDAK_BOLEH");
    const besar = await kirim(Array.from({ length: 21 }, () => wadahAksi()));
    expect(besar.status).toBe(400);
  });
});
