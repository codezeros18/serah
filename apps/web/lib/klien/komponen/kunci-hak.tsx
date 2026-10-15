"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { KunciHak as TipeKunciHak } from "@serah/kontrak";
import { TEKS } from "@serah/kontrak/teks";
import { useSesi } from "../sesi";

/** True bila paket organisasi aktif memberi hak boolean `kunci`. */
export function useBolehHak(kunci: TipeKunciHak): boolean {
  const { keadaan } = useSesi();
  if (keadaan.status !== "siap") return false;
  return keadaan.sesi.hak.some((h) => h.kunci === kunci && h.nilai === true);
}

/**
 * Komponen KunciHak (S20-3).
 * Menampilkan isi anak terlebih dahulu (tidak memblokir sebelum terlihat),
 * lalu bila organisasi tidak memiliki hak yang bersangkutan, menampilkan pesan G_HAK_PAKET
 * beserta tautan ke halaman langganan.
 */
export function KunciHak({
  kunci,
  children,
}: {
  kunci: TipeKunciHak;
  children: ReactNode;
}) {
  const boleh = useBolehHak(kunci);

  return (
    <div className="flex flex-col gap-2">
      <div className={!boleh ? "pointer-events-none select-none opacity-60" : undefined}>
        {children}
      </div>
      {!boleh ? (
        <aside
          role="note"
          aria-label={TEKS.G_HAK_PAKET}
          data-testid={`kunci-hak-${kunci}`}
          className="flex flex-col gap-2 rounded-kartu border-2 border-garis bg-latar p-4 text-tinta"
        >
          <p className="text-sm font-medium">{TEKS.G_HAK_PAKET}</p>
          <div>
            <Link
              href="/kawasan/langganan"
              className="inline-flex min-h-10 items-center justify-center rounded-kontrol bg-aksi px-4 py-2 text-sm font-semibold text-aksi-teks"
            >
              {TEKS.LGN_JUDUL}
            </Link>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
