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
  | { status: "galat"; pesan: string };

const KonteksSesi = createContext<{ keadaan: KeadaanSesi; muatUlang: () => void } | null>(null);

/** Memuat GET /api/sesi (mock atau nyata) dan membagikannya ke layout & layar. */
export function ProviderSesi({ children }: { children: ReactNode }) {
  const [keadaan, setKeadaan] = useState<KeadaanSesi>({ status: "memuat" });

  const muat = useCallback(() => {
    void panggil("GET", "/api/sesi").then((h) => {
      setKeadaan(h.ok ? { status: "siap", sesi: h.data } : { status: "galat", pesan: h.pesan });
    });
  }, []);

  useEffect(() => {
    muat();
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
