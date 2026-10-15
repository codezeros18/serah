"use client";

import { useState, type ReactNode } from "react";
import type { KunciHak } from "@serah/kontrak";
import { TEKS } from "@serah/kontrak/teks";
import { Tombol } from "@serah/ui";
import { useSesi } from "../sesi";

/** True bila paket organisasi aktif memberi hak boolean `kunci`. */
export function useBolehHak(kunci: KunciHak): boolean {
  const { keadaan } = useSesi();
  if (keadaan.status !== "siap") return false;
  return keadaan.sesi.hak.some((h) => h.kunci === kunci && h.nilai === true);
}

/**
 * SEMENTARA (sampai S20 memberi komponen hak bersama): tombol fitur berpaket.
 * Isi tombol selalu terlihat; tanpa hak, menekannya menampilkan G_HAK_PAKET dan tidak memanggil server.
 * Hanya fitur §3 FITUR.md (PDF, Lembar Neraca) yang boleh memakainya — bukan pencatatan, serah, atau CSV.
 */
export function TombolBerhak({
  kunci,
  onLanjut,
  children,
  varian = "sekunder",
}: {
  kunci: KunciHak;
  onLanjut: () => void;
  children: ReactNode;
  varian?: "utama" | "sekunder";
}) {
  const boleh = useBolehHak(kunci);
  const [ditolak, setDitolak] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <Tombol
        varian={varian}
        data-hak={kunci}
        onClick={() => {
          if (boleh) {
            setDitolak(false);
            onLanjut();
          } else setDitolak(true);
        }}
      >
        {children}
      </Tombol>
      {ditolak ? (
        <p role="note" data-testid={`hak-${kunci}`} className="text-sm">
          {TEKS.G_HAK_PAKET}
        </p>
      ) : null}
    </div>
  );
}
