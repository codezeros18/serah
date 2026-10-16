"use client";

import { useState } from "react";
import type { Aliran, StatusSerah } from "@serah/kontrak/enum";
import { TEKS, type KunciTeks } from "@serah/kontrak/teks";
import { Dialog, LencanaAliran, LencanaStatus } from "@serah/ui";

const URUTAN_STATUS: readonly { status: StatusSerah; kunci: KunciTeks }[] = [
  { status: "DRAF", kunci: "LEGENDA_S_DRAF" },
  { status: "MENUNGGU_SETUJU", kunci: "LEGENDA_S_MENUNGGU_SETUJU" },
  { status: "DIANGKUT", kunci: "LEGENDA_S_DIANGKUT" },
  { status: "DITERIMA", kunci: "LEGENDA_S_DITERIMA" },
  { status: "DITERIMA_SEBAGIAN", kunci: "LEGENDA_S_DITERIMA_SEBAGIAN" },
  { status: "DITOLAK", kunci: "LEGENDA_S_DITOLAK" },
  { status: "MENGGANTUNG", kunci: "LEGENDA_S_MENGGANTUNG" },
];

const URUTAN_ALIRAN: readonly { aliran: Aliran; kunci: KunciTeks }[] = [
  { aliran: "HIJAU", kunci: "LEGENDA_A_HIJAU" },
  { aliran: "KUNING", kunci: "LEGENDA_A_KUNING" },
  { aliran: "MERAH", kunci: "LEGENDA_A_MERAH" },
  { aliran: "ABU", kunci: "LEGENDA_A_ABU" },
];

/** Tombol "i" yang membuka kamus ikon: arti ikon status serah dan jenis sampah (aliran). */
export function LegendaIkon({ bagian = "semua", varian = "pil" }: { bagian?: "status" | "aliran" | "semua"; varian?: "pil" | "baris" }) {
  const [buka, setBuka] = useState(false);
  return (
    <>
      {varian === "baris" ? (
        <button
          type="button"
          onClick={() => setBuka(true)}
          className="group flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors duration-200 hover:bg-aksi-latar/40"
        >
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-latar font-serif text-lg italic text-aksi transition-colors group-hover:bg-white">
            i
          </span>
          <span className="flex-1 text-sm font-medium text-tinta">{TEKS.LEGENDA_JUDUL}</span>
          <span aria-hidden="true" className="text-tinta-redup transition-transform duration-200 group-hover:translate-x-0.5">›</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setBuka(true)}
          aria-label={`${TEKS.UMUM_INFO}: ${TEKS.LEGENDA_JUDUL}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-garis-halus bg-latar pl-1.5 pr-3 text-xs font-medium text-tinta-redup transition-all duration-200 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
        >
          <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-white font-serif text-sm italic text-aksi shadow-[0_1px_2px_rgba(15,23,42,0.1)]">
            i
          </span>
          {TEKS.LEGENDA_JUDUL}
        </button>
      )}

      <Dialog terbuka={buka} judul={TEKS.LEGENDA_JUDUL} onTutup={() => setBuka(false)}>
        <div className="flex flex-col gap-6">
          {bagian !== "aliran" ? (
            <section aria-labelledby="legenda-status" className="flex flex-col gap-3">
              <h3 id="legenda-status" className="text-sm font-semibold text-tinta">
                {TEKS.LEGENDA_STATUS}
              </h3>
              <ul className="flex flex-col gap-2">
                {URUTAN_STATUS.map((s) => (
                  <li key={s.status} className="flex items-center gap-3 rounded-2xl bg-latar/70 p-3">
                    <LencanaStatus status={s.status} ikon />
                    <p className="text-sm leading-snug text-tinta">{TEKS[s.kunci]}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {bagian !== "status" ? (
            <section aria-labelledby="legenda-aliran" className="flex flex-col gap-3">
              <h3 id="legenda-aliran" className="text-sm font-semibold text-tinta">
                {TEKS.LEGENDA_ALIRAN}
              </h3>
              <ul className="flex flex-col gap-2">
                {URUTAN_ALIRAN.map((a) => (
                  <li key={a.aliran} className="flex flex-col gap-2 rounded-2xl bg-latar/70 p-3">
                    <LencanaAliran aliran={a.aliran} pendek />
                    <p className="text-sm leading-snug text-tinta-redup">{TEKS[a.kunci]}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
