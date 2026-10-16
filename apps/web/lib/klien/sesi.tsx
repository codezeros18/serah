"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Peran } from "@serah/kontrak/enum";
import type { z } from "zod";
import type { SesiKeluaran } from "@serah/kontrak";
import { panggil } from "./api";

type Sesi = z.infer<typeof SesiKeluaran>;

type KeadaanSesi =
  | { status: "memuat" }
  | { status: "siap"; sesi: Sesi }
  | { status: "galat"; pesan: string; habis: boolean };

const KonteksSesi = createContext<{ keadaan: KeadaanSesi; muatUlang: () => void } | null>(null);

/** Memuat GET /api/sesi (mock atau nyata) dan membagikannya ke layout & layar. */
export function ProviderSesi({ children }: { children: ReactNode }) {
  const [keadaan, setKeadaan] = useState<KeadaanSesi>({ status: "memuat" });

  const muat = useCallback(() => {
    void panggil("GET", "/api/sesi").then((h) => {
      setKeadaan(h.ok ? { status: "siap", sesi: h.data } : { status: "galat", pesan: h.pesan, habis: h.galat.kode === "SESI_HABIS" });
    });
  }, []);

  useEffect(() => {
    muat();
    // Kembali lewat riwayat (gestur geser/bfcache) menampilkan halaman lama: periksa ulang sesinya.
    const saatTampil = (e: PageTransitionEvent) => {
      if (e.persisted) muat();
    };
    window.addEventListener("pageshow", saatTampil);
    return () => window.removeEventListener("pageshow", saatTampil);
  }, [muat]);

  const nilai = useMemo(() => ({ keadaan, muatUlang: muat }), [keadaan, muat]);
  return <KonteksSesi.Provider value={nilai}>{children}</KonteksSesi.Provider>;
}

export function useSesi() {
  const k = useContext(KonteksSesi);
  if (!k) throw new Error("useSesi dipakai di luar ProviderSesi");
  return k;
}

export type { Sesi, Peran };
