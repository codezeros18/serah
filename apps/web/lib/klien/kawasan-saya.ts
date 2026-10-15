"use client";

import { useEffect, useState } from "react";
import { panggil } from "./api";

export interface KawasanSaya {
  id: string;
  kode: string;
  nama: string;
}

/** Kawasan pertama milik organisasi pengelola (satu organisasi = satu kawasan pada tahap ini). */
export function useKawasanSaya(): { kawasan: KawasanSaya | null; galat: string | null } {
  const [kawasan, setKawasan] = useState<KawasanSaya | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  useEffect(() => {
    let batal = false;
    void panggil("GET", "/api/kawasan").then((h) => {
      if (batal) return;
      if (!h.ok) setGalat(h.pesan);
      else {
        const k = h.data.kawasan[0];
        if (k) setKawasan({ id: k.id, kode: k.kode, nama: k.nama });
      }
    });
    return () => {
      batal = true;
    };
  }, []);
  return { kawasan, galat };
}
