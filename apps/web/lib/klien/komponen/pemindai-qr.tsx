"use client";

import { useEffect, useRef, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat } from "@serah/ui";
import { bukaKamera, teksGalatKamera, tutupKamera, type GalatKamera } from "../kamera";
import { buatPemindai } from "../qr";

/**
 * Pemindai QR dari kamera. `onHasil` menerima teks mentah; pemanggil memvalidasi ke server dan
 * menampilkan G_QR_TIDAK_DIKENAL bila tidak dikenal.
 */
export function PemindaiQr({ petunjuk, onHasil }: { petunjuk: string; onHasil: (teks: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [galat, setGalat] = useState<GalatKamera | null>(null);
  const terakhir = useRef<string | null>(null);
  const panggilHasil = useRef(onHasil);
  useEffect(() => {
    panggilHasil.current = onHasil;
  }, [onHasil]);

  useEffect(() => {
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
  }, []);

  if (galat) return <BannerGalat pesan={teksGalatKamera(galat)} />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base">{petunjuk}</p>
      <video ref={video} playsInline muted aria-label={TEKS.T1_PINDAI} className="aspect-square w-full rounded-kartu bg-black object-cover" />
    </div>
  );
}
