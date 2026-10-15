"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ALASAN_TOLAK, type AlasanTolak } from "@serah/kontrak/enum";
import type { RujukanAturan } from "@serah/kontrak/galat";
import { TEKS, isi, type KunciTeks } from "@serah/kontrak/teks";
import { BannerGalat, Dialog, IsianBerat, Kartu, LencanaAliran, LencanaStatus, PanelAturan, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg, parseBeratKgKeGram } from "@/lib/klien/angka";
import { unggahFoto } from "@/lib/klien/foto";
import { KameraFoto } from "@/lib/klien/komponen/kamera-foto";
import { useMuat } from "@/lib/klien/muat";
import { beratAtauNol, ringkasRincian, type IsianRincian } from "@/lib/klien/rincian";

type Hasil = "tutup" | "siap";
type SaranAi = {
  /** Berat hasil baca dalam gram, null bila tak terbaca. */
  beratG: number | null;
  nomor: string | null;
  keyakinan: "TINGGI" | "SEDANG" | "RENDAH";
  model: string;
};

const KUNCI_ALASAN: Record<AlasanTolak, KunciTeks> = {
  TERCAMPUR_ORGANIK: "ALASAN_TERCAMPUR_ORGANIK",
  BASAH_KOTOR: "ALASAN_BASAH_KOTOR",
  JENIS_TIDAK_SESUAI: "ALASAN_JENIS_TIDAK_SESUAI",
  RESIDU_BERLEBIH: "ALASAN_RESIDU_BERLEBIH",
  LAINNYA: "ALASAN_LAINNYA",
};

/** Teks kg hasil baca AI (mis. "30" atau "42,5") → gram; null bila tidak sah. */
function gramDariTeks(teks: string | null): number | null {
  return teks === null ? null : parseBeratKgKeGram(teks);
}

export default function LayarTutup() {
  const { kode } = useParams<{ kode: string }>();
  const serah = useMuat(() => panggil("GET", "/api/serah/[kode]", { params: { kode } }));
  const d = serah.keadaan.status === "siap" ? serah.keadaan.data : null;

  const [fotoTiketId, setFotoTiketId] = useState<string | null>(null);
  const [ai, setAi] = useState<SaranAi | null>(null);
  const [aiMati, setAiMati] = useState(false);
  const [membaca, setMembaca] = useState(false);
  const [nomor, setNomor] = useState("");
  const [beratTiket, setBeratTiket] = useState("");
  const [terkonfirmasi, setTerkonfirmasi] = useState(false);
  const [rincian, setRincian] = useState<IsianRincian[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [peringatan, setPeringatan] = useState<RujukanAturan[]>([]);
  const [dialogR08, setDialogR08] = useState(false);
  const [hasil, setHasil] = useState<Hasil>("siap");

  // Koreksi berat setelah tertutup.
  const [koreksiBuka, setKoreksiBuka] = useState(false);
  // Teks kg per sasaran (kunci: "TIKET" | `D:${rincianId}` | `T:${rincianId}`); kosong = tidak diubah.
  const [koreksiNilai, setKoreksiNilai] = useState<Record<string, string>>({});
  const [koreksiAlasan, setKoreksiAlasan] = useState("");
  const [koreksiOk, setKoreksiOk] = useState(false);

  const beratTiketG = beratAtauNol(beratTiket);
  const beratTiketSah = beratTiketG !== null && beratTiketG > 0;

  // Isian rincian awal: seluruh berat TPS per aliran sebagai "diterima" tidak ditebak — dibiarkan kosong.
  const isianRincian: IsianRincian[] = useMemo(
    () =>
      rincian ??
      (d?.aliran ?? []).map((aliran) => ({ aliran, diterima: "", ditolak: "", alasan: "" as const, keterangan: "" })),
    [rincian, d?.aliran],
  );
  const ringkas = ringkasRincian(isianRincian, beratTiketSah ? beratTiketG : null);

  function ubahRincian(i: number, bagian: Partial<IsianRincian>) {
    setRincian(isianRincian.map((r, j) => (j === i ? { ...r, ...bagian } : r)));
  }

  async function bacaTiket(blob: Blob) {
    setSibuk(true);
    setGalat(null);
    const f = await unggahFoto(blob, "TIKET", kode);
    if (!f.ok) {
      setSibuk(false);
      setGalat(f.pesan);
      return;
    }
    setFotoTiketId(f.fotoId);
    setMembaca(true);
    const b = await panggil("POST", "/api/tiket/baca", { body: { fotoId: f.fotoId } });
    setMembaca(false);
    setSibuk(false);
    if (b.ok) {
      const g = gramDariTeks(b.data.beratKgTeks);
      setAi({ beratG: g, nomor: b.data.nomorTiket, keyakinan: b.data.keyakinan, model: b.data.model });
      setNomor(b.data.nomorTiket ?? "");
      setBeratTiket(g === null ? "" : formatGramKeKg(g));
    } else if (b.galat.kode === "AI_TIDAK_TERSEDIA") {
      setAiMati(true);
    } else {
      setGalat(b.pesan);
    }
  }

  // Sumber tiket (§N.1): tidak diubah / diubah dari saran AI / manual.
  const sumber: "AI_DIKONFIRMASI" | "AI_DIKOREKSI" | "MANUAL" =
    ai === null ? "MANUAL" : ai.beratG !== null && ai.beratG === beratTiketG && nomor === (ai.nomor ?? "") ? "AI_DIKONFIRMASI" : "AI_DIKOREKSI";

  // Penerima SELALU menekan "Angka sudah sesuai tiket" atau mengubah angka (isian manual).
  const siapTutup = terkonfirmasi && beratTiketSah && ringkas.sah && ringkas.sama && ringkas.alasanLengkap && ringkas.aksi !== null;

  async function tutup() {
    if (!beratTiketSah || beratTiketG === null) return;
    setSibuk(true);
    setGalat(null);
    const h = await panggil("POST", "/api/serah/[kode]/tutup", {
      params: { kode },
      idempotencyKey: crypto.randomUUID(),
      body: {
        tiket: {
          ...(fotoTiketId ? { fotoId: fotoTiketId } : {}),
          ...(nomor.trim() !== "" ? { nomor: nomor.trim() } : {}),
          beratG: beratTiketG,
          sumber,
          ...(ai ? { aiKeyakinan: ai.keyakinan, aiModel: ai.model } : {}),
        },
        rincian: isianRincian.map((r) => ({
          aliran: r.aliran,
          diterimaG: beratAtauNol(r.diterima) ?? 0,
          ditolakG: beratAtauNol(r.ditolak) ?? 0,
          ...(r.alasan !== "" ? { alasan: r.alasan } : {}),
          ...(r.keterangan.trim() !== "" ? { keterangan: r.keterangan.trim() } : {}),
        })),
      },
    });
    setSibuk(false);
    if (!h.ok) {
      setGalat(h.pesan);
      if (h.galat.kode === "KONFLIK_VERSI") void serah.ulang();
      return;
    }
    setHasil("tutup");
    setPeringatan(h.data.peringatan);
    // R-08 tidak menolak: tampilkan konfirmasi kedua dengan jalan ke koreksi.
    if (h.data.peringatan.some((p) => p.kode === "R08")) setDialogR08(true);
    void serah.ulang();
  }

  /** Nilai final saat ini (gram) per sasaran koreksi, dari detail serah. */
  function nilaiKoreksiSaatIni(kunci: string): number {
    if (kunci === "TIKET") return d?.tiket?.beratFinalG ?? 0;
    const r = d?.rincian.find((x) => x.id === kunci.slice(2));
    return kunci.startsWith("D:") ? (r?.diterimaFinalG ?? 0) : (r?.ditolakFinalG ?? 0);
  }

  const kunciKoreksi = ["TIKET", ...(d?.rincian ?? []).flatMap((r) => [`D:${r.id}`, `T:${r.id}`])];
  const nilaiKoreksi = (kunci: string): number | null =>
    koreksiNilai[kunci] === undefined ? nilaiKoreksiSaatIni(kunci) : beratAtauNol(koreksiNilai[kunci] ?? "");
  const tiketBaruG = nilaiKoreksi("TIKET");
  const jumlahBaruG = (d?.rincian ?? []).reduce((j, r) => j + (nilaiKoreksi(`D:${r.id}`) ?? 0) + (nilaiKoreksi(`T:${r.id}`) ?? 0), 0);
  const koreksiSah = kunciKoreksi.every((k) => nilaiKoreksi(k) !== null) && tiketBaruG !== null && tiketBaruG === jumlahBaruG;

  async function kirimKoreksi() {
    const tiketId = d?.tiket?.id;
    if (!tiketId || !koreksiSah) {
      setGalat(TEKS.G_BERAT_TIDAK_SAH);
      return;
    }
    if (koreksiAlasan.trim() === "") {
      setGalat(TEKS.UMUM_ALASAN_WAJIB);
      return;
    }
    const perubahan = kunciKoreksi
      .filter((k) => nilaiKoreksi(k) !== nilaiKoreksiSaatIni(k))
      .map((k) => ({
        target: k === "TIKET" ? ("TIKET" as const) : k.startsWith("D:") ? ("RINCIAN_DITERIMA" as const) : ("RINCIAN_DITOLAK" as const),
        targetId: k === "TIKET" ? tiketId : k.slice(2),
        nilaiFinalG: nilaiKoreksi(k) ?? 0,
      }));
    if (perubahan.length === 0) return;
    setSibuk(true);
    setGalat(null);
    const h = await panggil("POST", "/api/serah/[kode]/koreksi", {
      params: { kode },
      idempotencyKey: crypto.randomUUID(),
      body: { alasan: koreksiAlasan.trim(), perubahan },
    });
    setSibuk(false);
    if (h.ok) {
      setKoreksiOk(true);
      setKoreksiBuka(false);
      void serah.ulang();
    } else setGalat(h.pesan);
  }

  const tertutup = d !== null && ["DITERIMA", "DITERIMA_SEBAGIAN", "DITOLAK"].includes(d.status);
  const r08 = peringatan.find((p) => p.kode === "R08");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{isi("P1_TUTUP_JUDUL", { kode_serah: kode })}</h1>
      {serah.keadaan.status === "memuat" ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}
      {serah.keadaan.status === "galat" ? <BannerGalat pesan={serah.keadaan.pesan} onCoba={() => void serah.ulang()} /> : null}

      {d ? (
        <Kartu className="flex flex-col gap-3">
          <p className="text-base font-semibold">{isi("P1_MUATAN", { nama_kawasan: d.kawasan.nama })}</p>
          <LencanaStatus status={d.status} />
          <ul className="flex flex-col gap-2">
            {d.wadah.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-2">
                <LencanaAliran aliran={w.aliran} pendek />
                <span>{w.beratG === null ? TEKS.UMUM_BERAT_BELUM : isi("UMUM_KG", { nilai: formatGramKeKg(w.beratG) })}</span>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}

      {galat ? <BannerGalat pesan={galat} /> : null}

      {d && !tertutup && hasil === "siap" ? (
        <>
          {/* 1. Foto tiket → AI membaca (hasil = saran berlabel) */}
          {fotoTiketId === null && !aiMati ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">{TEKS.P1_FOTO_TIKET}</h2>
              <KameraFoto
                petunjuk={TEKS.P1_FOTO_TIKET}
                labelAmbil={sibuk ? TEKS.P1_MEMBACA : TEKS.P1_FOTO_TIKET}
                onFoto={(b) => void bacaTiket(b)}
              />
              <Tombol varian="sekunder" onClick={() => setAiMati(true)}>
                {TEKS.P1_ISI_MANUAL}
              </Tombol>
            </section>
          ) : null}
          {membaca ? (
            <p role="status" className="text-base font-semibold">
              {TEKS.P1_MEMBACA}
            </p>
          ) : null}

          {aiMati && ai === null && fotoTiketId !== null ? <BannerGalat pesan={TEKS.G_AI_MATI} /> : null}
          {ai !== null ? (
            ai.keyakinan === "TINGGI" && ai.beratG !== null ? (
              <p role="note" className="rounded-kartu border-l-8 border-aksi bg-kertas p-3 text-base font-semibold">
                {TEKS.AI_LABEL}
              </p>
            ) : (
              <BannerGalat pesan={TEKS.G_AI_RAGU} />
            )
          ) : null}

          {/* 2. Angka tiket: dikonfirmasi atau diisi manual */}
          {(fotoTiketId !== null || aiMati) && !membaca ? (
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="nomor" className="text-base font-semibold">
                  {TEKS.P1_NOMOR_TIKET}
                </label>
                <input
                  id="nomor"
                  type="text"
                  value={nomor}
                  onChange={(e) => {
                    setNomor(e.target.value);
                    setTerkonfirmasi(false);
                  }}
                  className="min-h-12 rounded-kontrol border-2 border-garis bg-kertas px-3 text-xl"
                />
              </div>
              <IsianBerat
                id="berat-tiket"
                label={TEKS.P1_BERAT_TIKET}
                nilai={beratTiket}
                onUbah={(v) => {
                  setBeratTiket(v);
                  setTerkonfirmasi(false);
                }}
                salah={beratTiket !== "" && !beratTiketSah}
              />
              <Tombol
                varian={terkonfirmasi ? "sekunder" : "utama"}
                onClick={() => setTerkonfirmasi(true)}
                disabled={!beratTiketSah}
                aria-pressed={terkonfirmasi}
              >
                {terkonfirmasi ? `✓ ${TEKS.P1_KONFIRMASI_AI}` : TEKS.P1_KONFIRMASI_AI}
              </Tombol>
            </section>
          ) : null}

          {/* 3. Rincian per aliran */}
          {terkonfirmasi ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-bold">{TEKS.P1_PER_ALIRAN}</h2>
              <p className="text-sm text-tinta-redup">{TEKS.P1_HAK_TOLAK}</p>
              {isianRincian.map((r, i) => (
                <Kartu key={r.aliran} className="flex flex-col gap-3" data-aliran-rincian={r.aliran}>
                  <LencanaAliran aliran={r.aliran} />
                  <IsianBerat
                    id={`diterima-${r.aliran}`}
                    label={TEKS.P1_DITERIMA}
                    nilai={r.diterima}
                    onUbah={(v) => ubahRincian(i, { diterima: v })}
                    salah={r.diterima !== "" && beratAtauNol(r.diterima) === null}
                  />
                  <IsianBerat
                    id={`ditolak-${r.aliran}`}
                    label={TEKS.P1_DITOLAK}
                    nilai={r.ditolak}
                    onUbah={(v) => ubahRincian(i, { ditolak: v })}
                    salah={r.ditolak !== "" && beratAtauNol(r.ditolak) === null}
                  />
                  {(beratAtauNol(r.ditolak) ?? 0) > 0 ? (
                    <div className="flex flex-col gap-2">
                      <label htmlFor={`alasan-${r.aliran}`} className="text-base font-semibold">
                        {TEKS.UMUM_ALASAN}
                      </label>
                      <select
                        id={`alasan-${r.aliran}`}
                        value={r.alasan}
                        onChange={(e) => ubahRincian(i, { alasan: e.target.value as AlasanTolak | "" })}
                        className="min-h-12 rounded-kontrol border-2 border-garis bg-kertas px-3 text-base"
                      >
                        <option value="" />
                        {ALASAN_TOLAK.map((a) => (
                          <option key={a} value={a}>
                            {TEKS[KUNCI_ALASAN[a]]}
                          </option>
                        ))}
                      </select>
                      {r.alasan === "LAINNYA" ? (
                        <>
                          <label htmlFor={`ket-${r.aliran}`} className="text-base font-semibold">
                            {TEKS.ALASAN_KETERANGAN_LABEL}
                          </label>
                          <input
                            id={`ket-${r.aliran}`}
                            type="text"
                            maxLength={300}
                            value={r.keterangan}
                            onChange={(e) => ubahRincian(i, { keterangan: e.target.value })}
                            className="min-h-12 rounded-kontrol border-2 border-garis bg-kertas px-3 text-base"
                          />
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </Kartu>
              ))}

              {ringkas.sah && !ringkas.sama ? (
                <p role="alert" className="text-base font-semibold">
                  {isi("P1_JUMLAH_TIDAK_SAMA", { berat_tiket: beratTiketG === null ? "-" : formatGramKeKg(beratTiketG) })}
                </p>
              ) : null}

              <Tombol onClick={() => void tutup()} disabled={!siapTutup || sibuk}>
                {ringkas.aksi === "TOLAK"
                  ? TEKS.P1_TOLAK
                  : ringkas.aksi === "SEBAGIAN"
                    ? TEKS.P1_TOLAK_SEBAGIAN
                    : TEKS.P1_TERIMA}
              </Tombol>
            </section>
          ) : null}
        </>
      ) : null}

      {hasil === "tutup" || tertutup ? (
        <section className="flex flex-col gap-3">
          {hasil === "tutup" ? (
            <p role="status" className="text-lg font-semibold">
              {isi("P1_DITUTUP", { kode_serah: kode })}
            </p>
          ) : null}
          {r08 ? <PanelAturan aksi="PERINGATAN" kode="R08" teks={r08.teks} /> : null}
          {koreksiOk ? (
            <p role="status" className="text-base font-semibold">
              {`✓ ${TEKS.P1_KOREKSI}`}
            </p>
          ) : null}

          {!koreksiBuka ? (
            <Tombol varian="sekunder" onClick={() => setKoreksiBuka(true)}>
              {TEKS.P1_KOREKSI}
            </Tombol>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-tinta-redup">{TEKS.P1_KOREKSI_PETUNJUK}</p>
              <IsianBerat
                id="koreksi-tiket"
                label={TEKS.P1_BERAT_TIKET}
                nilai={koreksiNilai.TIKET ?? formatGramKeKg(nilaiKoreksiSaatIni("TIKET"))}
                onUbah={(v) => setKoreksiNilai({ ...koreksiNilai, TIKET: v })}
              />
              {(d?.rincian ?? []).map((r) => (
                <div key={r.id} className="flex flex-col gap-2">
                  <LencanaAliran aliran={r.aliran} pendek />
                  <IsianBerat
                    id={`koreksi-d-${r.id}`}
                    label={TEKS.P1_DITERIMA}
                    nilai={koreksiNilai[`D:${r.id}`] ?? formatGramKeKg(r.diterimaFinalG)}
                    onUbah={(v) => setKoreksiNilai({ ...koreksiNilai, [`D:${r.id}`]: v })}
                  />
                  <IsianBerat
                    id={`koreksi-t-${r.id}`}
                    label={TEKS.P1_DITOLAK}
                    nilai={koreksiNilai[`T:${r.id}`] ?? formatGramKeKg(r.ditolakFinalG)}
                    onUbah={(v) => setKoreksiNilai({ ...koreksiNilai, [`T:${r.id}`]: v })}
                  />
                </div>
              ))}
              {!koreksiSah ? (
                <p role="alert" className="text-base font-semibold">
                  {isi("P1_JUMLAH_TIDAK_SAMA", { berat_tiket: tiketBaruG === null ? "-" : formatGramKeKg(tiketBaruG) })}
                </p>
              ) : null}
              <label htmlFor="koreksi-alasan" className="text-base font-semibold">
                {TEKS.UMUM_ALASAN}
              </label>
              <textarea
                id="koreksi-alasan"
                rows={3}
                value={koreksiAlasan}
                onChange={(e) => setKoreksiAlasan(e.target.value)}
                className="rounded-kontrol border-2 border-garis bg-kertas p-3 text-base"
              />
              <Tombol onClick={() => void kirimKoreksi()} disabled={sibuk || !koreksiSah}>
                {TEKS.UMUM_KIRIM}
              </Tombol>
            </div>
          )}
        </section>
      ) : null}

      <Dialog terbuka={dialogR08} judul={TEKS.ATURAN_JUDUL_PERINGATAN} onTutup={() => setDialogR08(false)}>
        {r08 ? <PanelAturan aksi="PERINGATAN" kode="R08" teks={r08.teks} /> : null}
        <div className="mt-3">
          <Tombol
            onClick={() => {
              setDialogR08(false);
              setKoreksiBuka(true);
            }}
          >
            {TEKS.P1_KOREKSI}
          </Tombol>
        </div>
      </Dialog>

      <Link href="/penerima" className="inline-flex min-h-12 items-center text-base font-semibold underline">
        {TEKS.UMUM_KEMBALI}
      </Link>
    </div>
  );
}
