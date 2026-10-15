"use client";

import { useEffect, useState } from "react";
import { qrKeDataUrl } from "../qr";

/** Menampilkan QR sebagai gambar. `label` = teks alternatif (dari TEKS, mis. T2_QR_PETUNJUK). */
export function QrTampil({ isi, label, lebarPx = 320 }: { isi: string; label: string; lebarPx?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let batal = false;
    void qrKeDataUrl(isi, lebarPx).then((u) => {
      if (!batal) setUrl(u);
    });
    return () => {
      batal = true;
    };
  }, [isi, lebarPx]);
  if (!url) return null;
  return (
    // Gambar data: URL; ukuran tetap agar tidak bergeser.
    <img src={url} alt={label} width={lebarPx} height={lebarPx} className="h-auto max-w-full rounded-kontrol bg-white" />
  );
}
