"use client";

import { useEffect, useRef, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { bukaKamera, tutupKamera, type GalatKamera } from "../kamera";
import { buatPemindai, pindaiGambar } from "../qr";

type Mode = "kamera" | "unggah";

function IkonKamera() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M4 8.500A1.500 1.500 0 0 1 5.500 7h2l1.200-2h6.600l1.200 2h2A1.500 1.500 0 0 1 20 8.500v9a1.500 1.500 0 0 1-1.500 1.500h-13A1.500 1.500 0 0 1 4 17.500v-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.200" stroke="currentColor" strokeWidth="1.800" />
    </svg>
  );
}

function IkonGambar() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2.500" stroke="currentColor" strokeWidth="1.800" />
      <circle cx="9" cy="10" r="1.500" stroke="currentColor" strokeWidth="1.800" />
      <path d="m5 17 4.500-4.500 3 3 2.500-2.500L19 16.500" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Pemindai QR: pilih kamera atau unggah gambar. Kamera aktif langsung sebagai bawaan.
 * `onHasil` menerima teks mentah; pemanggil memvalidasi ke server dan menampilkan
 * G_QR_TIDAK_DIKENAL bila tidak dikenal.
 */
export function PemindaiQr({ petunjuk, onHasil }: { petunjuk: string; onHasil: (teks: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<Mode>("kamera");
  const [galat, setGalat] = useState<GalatKamera | null>(null);
  const [galatGambar, setGalatGambar] = useState(false);
  const [percobaan, setPercobaan] = useState(0);
  const terakhir = useRef<string | null>(null);
  const panggilHasil = useRef(onHasil);
  useEffect(() => {
    panggilHasil.current = onHasil;
  }, [onHasil]);

  useEffect(() => {
    if (mode !== "kamera") return;
    setGalat(null);
    let aktif = true;
    let stream: MediaStream | null = null;
    let waktu: ReturnType<typeof setTimeout> | undefined;
    const pindai = buatPemindai();

    async function mulai() {
      const h = await bukaKamera();
      if (!aktif) {
        if (h.ok) tutupKamera(h.stream);
        return;
      }
      if (!h.ok) {
        setGalat(h.galat);
        return;
      }
      stream = h.stream;
      const v = video.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play().catch(() => undefined);
      const putar = async () => {
        if (!aktif) return;
        const teks = await pindai(v);
        if (teks && teks !== terakhir.current) {
          terakhir.current = teks;
          panggilHasil.current(teks);
        }
        waktu = setTimeout(() => void putar(), 150);
      };
      void putar();
    }
    void mulai();
    return () => {
      aktif = false;
      if (waktu) clearTimeout(waktu);
      tutupKamera(stream);
    };
  }, [mode, percobaan]);

  async function tanganiBerkas(berkas: File | undefined) {
    if (!berkas) return;
    setGalatGambar(false);
    const teks = await pindaiGambar(berkas);
    if (!teks) {
      setGalatGambar(true);
      return;
    }
    panggilHasil.current(teks);
  }

  const kelasPilihan = (aktif: boolean) =>
    `flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-medium transition-all duration-200 ${
      aktif
        ? "bg-tinta text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
        : "bg-latar text-tinta hover:bg-aksi-latar hover:text-aksi"
    }`;

  return (
    <div className="flex flex-col gap-4">
      {/* Pilihan cara memindai */}
      <div role="group" aria-label={TEKS.T1_PINDAI} className="flex gap-2">
        <button type="button" aria-pressed={mode === "kamera"} onClick={() => setMode("kamera")} className={kelasPilihan(mode === "kamera")}>
          <IkonKamera />
          <span>{TEKS.QR_MODE_KAMERA}</span>
        </button>
        <button type="button" aria-pressed={mode === "unggah"} onClick={() => setMode("unggah")} className={kelasPilihan(mode === "unggah")}>
          <IkonGambar />
          <span>{TEKS.QR_MODE_UNGGAH}</span>
        </button>
      </div>

      <p className="text-sm leading-relaxed text-tinta-redup">{mode === "kamera" ? petunjuk : TEKS.QR_UNGGAH_PETUNJUK}</p>

      {mode === "kamera" ? (
        galat ? (
          <div role="alert" className="flex flex-col items-center gap-4 rounded-3xl bg-latar p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-aksi-latar text-aksi">
              <IkonKamera />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold text-tinta">{TEKS.QR_IZIN_JUDUL}</p>
              <p className="text-sm text-tinta-redup">
                {galat === "G_KAMERA_DITOLAK" ? TEKS.G_KAMERA_DITOLAK : TEKS.G_KAMERA_TIDAK_ADA}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setPercobaan((n) => n + 1)}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-aksi px-4 text-sm font-medium text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all hover:-translate-y-0.5 hover:bg-aksi-hover"
              >
                {TEKS.UMUM_COBA_LAGI}
              </button>
              <button
                type="button"
                onClick={() => setMode("unggah")}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-garis-halus bg-kertas px-4 text-sm font-medium text-tinta transition-all hover:-translate-y-0.5 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
              >
                {TEKS.QR_MODE_UNGGAH}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl bg-black">
            <video
              ref={video}
              playsInline
              muted
              aria-label={TEKS.T1_PINDAI}
              className="aspect-square w-full object-cover"
            />
            {/* Bingkai pemindaian + garis yang menyapu */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[68%] w-[68%]">
                <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-[3px] border-t-[3px] border-white" />
                <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-[3px] border-t-[3px] border-white" />
                <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-[3px] border-l-[3px] border-white" />
                <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-[3px] border-r-[3px] border-white" />
                <span className="qr-garis absolute inset-x-2 top-0 h-0.5 rounded-full bg-emerald-400 shadow-[0_0_14px_3px_rgba(52,211,153,0.7)]" />
              </div>
            </div>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              {TEKS.QR_MEMINDAI}
            </span>
          </div>
        )
      ) : (
        <label className="group flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-garis-halus bg-latar/60 p-8 text-center transition-all duration-200 hover:border-aksi-garis hover:bg-aksi-latar/50">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-aksi shadow-[0_4px_14px_rgba(15,23,42,0.08)] transition-transform duration-200 group-hover:scale-105">
            <IkonGambar />
          </span>
          <span className="text-sm font-medium text-tinta">{TEKS.QR_MODE_UNGGAH}</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              void tanganiBerkas(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {galatGambar ? (
        <p role="alert" className="rounded-2xl bg-peringatan-latar px-4 py-3 text-sm font-medium text-peringatan">
          {TEKS.QR_UNGGAH_TIDAK_TERBACA}
        </p>
      ) : null}
    </div>
  );
}
