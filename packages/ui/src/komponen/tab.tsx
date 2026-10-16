"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export type ItemTab = { kunci: string; judul: string; isi: ReactNode };

/** Tab dengan pola ARIA: panah kiri/kanan berpindah, hanya tab aktif yang bisa difokus. */
export function Tab({
  item,
  aktif,
  onPilih,
}: {
  item: readonly ItemTab[];
  aktif: string;
  onPilih: (kunci: string) => void;
}) {
  const dasar = useId();
  const daftar = useRef<HTMLDivElement>(null);

  function tekan(e: KeyboardEvent<HTMLButtonElement>, indeks: number) {
    const geser = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (geser === 0) return;
    e.preventDefault();
    const tujuan = item[(indeks + geser + item.length) % item.length];
    if (!tujuan) return;
    onPilih(tujuan.kunci);
    daftar.current?.querySelector<HTMLButtonElement>(`[data-kunci="${tujuan.kunci}"]`)?.focus();
  }

  const panel = item.find((t) => t.kunci === aktif) ?? item[0];
  return (
    <div>
      <div ref={daftar} role="tablist" className="gulir-halus flex gap-2 overflow-x-auto pb-1">
        {item.map((t, i) => {
          const dipilih = t.kunci === panel?.kunci;
          return (
            <button
              key={t.kunci}
              id={`${dasar}-tab-${t.kunci}`}
              data-kunci={t.kunci}
              role="tab"
              type="button"
              aria-selected={dipilih}
              aria-controls={`${dasar}-panel-${t.kunci}`}
              tabIndex={dipilih ? 0 : -1}
              onClick={() => onPilih(t.kunci)}
              onKeyDown={(e) => tekan(e, i)}
              className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-all duration-200 ${
                dipilih
                  ? "border-tinta bg-tinta text-white shadow-sm"
                  : "border-garis-halus bg-kertas text-tinta hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
              }`}
            >
              {t.judul}
            </button>
          );
        })}
      </div>
      {panel ? (
        <div
          role="tabpanel"
          id={`${dasar}-panel-${panel.kunci}`}
          aria-labelledby={`${dasar}-tab-${panel.kunci}`}
          className="pt-5"
        >
          {panel.isi}
        </div>
      ) : null}
    </div>
  );
}
