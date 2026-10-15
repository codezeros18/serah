"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Tombol } from "@serah/ui";
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
    <div className="flex flex-col gap-3">
      <p className="text-base">{petunjuk}</p>
      <video ref={video} playsInline muted onPlaying={() => setSiap(true)} aria-label={TEKS.A2_FOTO} className="aspect-[4/3] w-full rounded-kartu bg-black object-cover" />
      <Tombol onClick={() => void ambil()} disabled={!siap}>
        {labelAmbil}
      </Tombol>
    </div>
  );
}
