"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { Aliran, KodeAturan } from "@serah/kontrak/enum";
import { TEKS, isi, type KunciTeks } from "@serah/kontrak/teks";
import { BannerGalat, LencanaAliran, PanelAturan, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { unggahFoto } from "@/lib/klien/foto";
import { KameraFoto } from "@/lib/klien/komponen/kamera-foto";
import { PemindaiQr } from "@/lib/klien/komponen/pemindai-qr";
import { useMuat } from "@/lib/klien/muat";

type Langkah = "pindai" | "foto" | "tujuan" | "terkirim";
type Tolak = { kode: KodeAturan; teks: string };

const KUNCI_KONTRAK = {
  USULAN: "KONTRAK_USULAN",
  AKTIF: "KONTRAK_AKTIF",
  BERAKHIR: "KONTRAK_BERAKHIR",
  DIBATALKAN: "KONTRAK_DIBATALKAN",
} as const satisfies Record<string, KunciTeks>;

/** A2 — ambil serah: pindai QR → foto muatan → kendaraan & penerima → kirim. */
export default function LayarA2() {
  const { kode } = useParams<{ kode: string }>();
  const [langkah, setLangkah] = useState<Langkah>("pindai");
  const [galat, setGalat] = useState<string | null>(null);
  const [tolak, setTolak] = useState<Tolak | null>(null);
  const [fotoId, setFotoId] = useState<string | null>(null);
  const [kendaraanId, setKendaraanId] = useState("");
  const [penerimaId, setPenerimaId] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const serah = useMuat(() => panggil("GET", "/api/serah/[kode]", { params: { kode } }));
  const kendaraan = useMuat(() => panggil("GET", "/api/kendaraan"));
  // Pengangkut hanya melihat penerima yang berkontrak dengannya (direktori mitra khusus pengelola).
  const kontrak = useMuat(() => panggil("GET", "/api/kontrak"));
  const penerimaKontrak = useMemo(() => {
    if (kontrak.keadaan.status !== "siap") return [];
    const peta = new Map<string, { id: string; nama: string; aliran: Set<Aliran>; status: keyof typeof KUNCI_KONTRAK }>();
    for (const k of kontrak.keadaan.data.kontrak) {
      if (k.status === "BERAKHIR" || k.status === "DIBATALKAN") continue;
      const ada = peta.get(k.penerima.id) ?? { id: k.penerima.id, nama: k.penerima.nama, aliran: new Set<Aliran>(), status: k.status };
      k.aliran.forEach((a) => ada.aliran.add(a));
      if (k.status === "AKTIF") ada.status = "AKTIF";
      peta.set(k.penerima.id, ada);
    }
    return [...peta.values()];
  }, [kontrak.keadaan]);

  const hasilPindai = useCallback(
    (teks: string) => {
      if (teks.trim() === kode) {
        setGalat(null);
        setLangkah("foto");
      } else {
        setGalat(TEKS.G_QR_TIDAK_DIKENAL);
      }
    },
    [kode],
  );

  async function kirimFoto(blob: Blob) {
    setSibuk(true);
    setGalat(null);
    setTolak(null);
    const h = await unggahFoto(blob, "MUATAN", kode);
    setSibuk(false);
    if (h.ok) {
      setFotoId(h.fotoId);
      setLangkah("tujuan");
    } else if (h.galat.kode === "ATURAN_DITOLAK" && h.galat.aturan) {
      setTolak({ kode: h.galat.aturan.kode, teks: h.galat.aturan.teks });
    } else {
      setGalat(h.pesan);
    }
  }

  async function kirim() {
    if (!fotoId) return;
    setSibuk(true);
    setGalat(null);
    setTolak(null);
    const h = await panggil("POST", "/api/serah/[kode]/ambil", {
      params: { kode },
      body: { fotoId, kendaraanId, penerimaId },
      idempotencyKey: crypto.randomUUID(),
    });
    setSibuk(false);
    if (h.ok) {
      setLangkah("terkirim");
    } else if (h.galat.aturan && h.galat.kode === "ATURAN_DITOLAK") {
      setTolak({ kode: h.galat.aturan.kode, teks: h.galat.aturan.teks });
    } else {
      setGalat(h.pesan);
    }
  }

  const detail = serah.keadaan.status === "siap" ? serah.keadaan.data : null;

  const URUTAN_LANGKAH: readonly Langkah[] = ["pindai", "foto", "tujuan", "terkirim"];
  const indeksAktif = URUTAN_LANGKAH.indexOf(langkah);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black tracking-tight text-tinta">{isi("A2_JUDUL", { kode_serah: kode })}</h1>

      {/* Indikator Langkah Bertahap untuk Driver */}
      <div className="flex items-center justify-between gap-1 rounded-kartu border-2 border-garis-halus bg-kertas p-3 shadow-xs">
        {[
          { id: "pindai", label: TEKS.A2_PINDAI, nomor: 1 },
          { id: "foto", label: TEKS.A2_FOTO, nomor: 2 },
          { id: "tujuan", label: TEKS.A2_KENDARAAN, nomor: 3 },
          { id: "terkirim", label: TEKS.UMUM_KONFIRMASI, nomor: 4 },
        ].map((t, idx) => {
          const aktif = idx === indeksAktif;
          const sudah = idx < indeksAktif;
          return (
            <div key={t.id} className="flex flex-1 flex-col items-center gap-1 text-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black transition-all ${
                  sudah
                    ? "bg-status-selesai text-white"
                    : aktif
                      ? "border-2 border-aksi bg-aksi text-aksi-teks ring-2 ring-aksi/30"
                      : "border-2 border-garis-halus bg-latar text-tinta-redup"
                }`}
              >
                {sudah ? "✓" : t.nomor}
              </span>
              <span
                className={`truncate text-xs font-semibold ${
                  aktif ? "font-bold text-aksi" : sudah ? "text-status-selesai" : "text-tinta-redup"
                }`}
              >
                {t.label}
              </span>
            </div>
          );
        })}
      </div>

      {serah.keadaan.status === "galat" ? <BannerGalat pesan={serah.keadaan.pesan} onCoba={() => void serah.ulang()} /> : null}
      {detail ? (
        <div className="flex flex-col gap-2.5 rounded-kartu border-2 border-garis bg-kertas p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-black tracking-tight text-tinta">{detail.tps.nama}</p>
              <p className="text-sm font-semibold text-tinta-redup">{detail.kawasan.nama}</p>
            </div>
            <span className="shrink-0 rounded-kontrol border border-garis bg-latar px-2.5 py-1 font-mono text-sm font-bold text-tinta">
              {kode}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {detail.aliran.map((a) => (
              <LencanaAliran key={a} aliran={a} pendek />
            ))}
          </div>
        </div>
      ) : null}

      {galat ? <BannerGalat pesan={galat} /> : null}
      {tolak ? <PanelAturan aksi="TOLAK" kode={tolak.kode} teks={tolak.teks} /> : null}

      {langkah === "pindai" ? (
        <section className="flex flex-col gap-3 rounded-kartu border-2 border-garis-halus bg-kertas p-4 shadow-sm">
          <h2 className="flex items-center gap-2.5 text-lg font-black text-tinta">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-aksi text-sm font-bold text-aksi-teks shadow-xs">
              1
            </span>
            <span>{TEKS.A2_PINDAI}</span>
          </h2>
          <PemindaiQr petunjuk={TEKS.A2_PINDAI} onHasil={hasilPindai} />
          {/* QR sudah dikenal dari daftar A1; tombol ini untuk perangkat tanpa kamera yang bisa memindai. */}
          <Tombol
            varian="sekunder"
            className="min-h-14 w-full border-2 border-garis text-base font-bold active:scale-[0.98] transition-all"
            onClick={() => setLangkah("foto")}
          >
            {TEKS.UMUM_LANJUT}
          </Tombol>
        </section>
      ) : null}

      {langkah === "foto" ? (
        <section className="flex flex-col gap-3 rounded-kartu border-2 border-garis-halus bg-kertas p-4 shadow-sm">
          <h2 className="flex items-center gap-2.5 text-lg font-black text-tinta">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-aksi text-sm font-bold text-aksi-teks shadow-xs">
              2
            </span>
            <span>{TEKS.A2_FOTO}</span>
          </h2>
          <KameraFoto
            petunjuk={TEKS.A2_FOTO_PETUNJUK}
            labelAmbil={sibuk ? TEKS.UMUM_MUAT : TEKS.A2_FOTO}
            onFoto={(b) => void kirimFoto(b)}
          />
          {tolak ? (
            <Tombol
              varian="sekunder"
              className="min-h-14 w-full border-2 border-garis text-base font-bold active:scale-[0.98] transition-all"
              onClick={() => setTolak(null)}
            >
              {TEKS.A2_FOTO_ULANG}
            </Tombol>
          ) : null}
        </section>
      ) : null}

      {langkah === "tujuan" ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 rounded-kartu border-2 border-garis-halus bg-kertas p-4 shadow-sm">
            <label htmlFor="kendaraan" className="text-base font-bold text-tinta">
              {TEKS.A2_KENDARAAN}
            </label>
            <select
              id="kendaraan"
              value={kendaraanId}
              onChange={(e) => setKendaraanId(e.target.value)}
              className="min-h-14 rounded-kontrol border-2 border-garis bg-kertas px-3 font-mono text-lg font-bold text-tinta focus:border-aksi focus:ring-2 focus:ring-aksi/20"
            >
              <option value="" />
              {kendaraan.keadaan.status === "siap"
                ? kendaraan.keadaan.data.kendaraan
                    .filter((k) => k.aktif)
                    .map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.plat}
                      </option>
                    ))
                : null}
            </select>
          </div>

          <fieldset className="flex flex-col gap-2.5 rounded-kartu border-2 border-garis-halus bg-kertas p-4 shadow-sm">
            <legend className="text-base font-bold text-tinta">{TEKS.A2_PENERIMA}</legend>
            <p className="text-sm font-semibold text-tinta-redup">{TEKS.A2_PENERIMA_PETUNJUK}</p>
            {penerimaKontrak.map((m) => {
              const terpilih = penerimaId === m.id;
              return (
                <label
                  key={m.id}
                  className={`flex min-h-16 cursor-pointer items-start gap-3.5 rounded-kartu border-2 p-4 transition-all duration-150 active:scale-[0.99] ${
                    terpilih
                      ? "border-aksi bg-aksi-latar shadow-sm ring-2 ring-aksi/30"
                      : "border-garis-halus bg-kertas hover:border-garis"
                  }`}
                >
                  <input
                    type="radio"
                    name="penerima"
                    value={m.id}
                    checked={terpilih}
                    onChange={() => {
                      setPenerimaId(m.id);
                      setTolak(null);
                    }}
                    className="mt-1 h-6 w-6 shrink-0 accent-aksi"
                  />
                  <span className="flex flex-1 flex-col gap-1.5 min-w-0">
                    <span className="text-lg font-bold text-tinta">{m.nama}</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-tinta-redup">
                      {TEKS[KUNCI_KONTRAK[m.status]]}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {[...m.aliran].map((a) => (
                        <LencanaAliran key={a} aliran={a} pendek />
                      ))}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <Tombol
            onClick={() => void kirim()}
            disabled={sibuk || kendaraanId === "" || penerimaId === ""}
            className="min-h-14 w-full text-lg font-black bg-aksi text-aksi-teks hover:bg-aksi-hover shadow-md active:scale-[0.98] transition-all"
          >
            {sibuk ? TEKS.UMUM_MUAT : TEKS.A2_KIRIM}
          </Tombol>
        </section>
      ) : null}

      {langkah === "terkirim" ? (
        <section
          className="flex flex-col items-center gap-4 rounded-kartu border-2 border-status-selesai bg-kertas p-6 text-center shadow-md"
          role="status"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-status-selesai bg-status-selesai-latar text-status-selesai">
            <span className="text-3xl font-black">✓</span>
          </div>
          <p className="text-xl font-black text-tinta">{TEKS.A2_TERKIRIM}</p>
          <Link
            href="/pengangkut"
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-kontrol bg-aksi px-5 text-base font-bold text-aksi-teks shadow-md transition-all hover:bg-aksi-hover active:scale-[0.98]"
          >
            <span>{TEKS.A1_JUDUL}</span>
            <span aria-hidden="true" className="text-xl font-black">
              →
            </span>
          </Link>
        </section>
      ) : null}
    </div>
  );
}
