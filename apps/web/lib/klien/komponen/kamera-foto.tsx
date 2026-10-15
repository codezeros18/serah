"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat } from "@serah/ui";
import { ambilFoto, bukaKamera, teksGalatKamera, tutupKamera, type GalatKamera } from "../kamera";

/**
 * Pengambil foto langsung dari kamera (tanpa galeri). `petunjuk` & `labelAmbil` diberikan
 * pemanggil dari TEKS (mis. A2_FOTO_PETUNJUK, A2_FOTO).
 */
export function KameraFoto({
  petunjuk,
  labelAmbil,
  onFoto,
}: {
  petunjuk: string;
  labelAmbil: string;
  onFoto: (blob: Blob) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [galat, setGalat] = useState<GalatKamera | null>(null);
  const [siap, setSiap] = useState(false);

  const mulai = useCallback(async () => {
    setGalat(null);
    const h = await bukaKamera();
    if (!h.ok) {
      setGalat(h.galat);
      return;
    }
    stream.current = h.stream;
    if (video.current) {
      video.current.srcObject = h.stream;
      await video.current.play().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    void mulai();
    return () => tutupKamera(stream.current);
  }, [mulai]);

  async function ambil() {
    if (!video.current) return;
    let blob = await ambilFoto(video.current);
    // Bingkai pertama kadang belum berisi piksel; coba sekali lagi.
    if (!blob) {
      await new Promise((r) => setTimeout(r, 250));
      blob = await ambilFoto(video.current);
    }
    if (blob) onFoto(blob);
  }

  if (galat) return <BannerGalat pesan={teksGalatKamera(galat)} onCoba={() => void mulai()} />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-tinta-redup">{petunjuk}</p>
      <div className="relative overflow-hidden rounded-3xl bg-black">
        <video
          ref={video}
          playsInline
          muted
          onPlaying={() => setSiap(true)}
          aria-label={TEKS.A2_FOTO}
          className="aspect-[4/3] w-full object-cover"
        />
        {/* Sudut bidik */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-4">
          <span className="absolute left-0 top-0 h-7 w-7 rounded-tl-xl border-l-[3px] border-t-[3px] border-white/90" />
          <span className="absolute right-0 top-0 h-7 w-7 rounded-tr-xl border-r-[3px] border-t-[3px] border-white/90" />
          <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-xl border-b-[3px] border-l-[3px] border-white/90" />
          <span className="absolute bottom-0 right-0 h-7 w-7 rounded-br-xl border-b-[3px] border-r-[3px] border-white/90" />
        </div>
        {!siap ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white border-t-transparent" />
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void ambil()}
        disabled={!siap}
        className="group flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-aksi px-5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white">
          <span className="h-4 w-4 rounded-full bg-white transition-transform duration-200 group-active:scale-75" />
        </span>
        {labelAmbil}
      </button>
    </div>
  );
}
