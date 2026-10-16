"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { TEKS } from "@serah/kontrak/teks";

/**
 * Dialog memakai elemen <dialog> asli (fokus terkurung & Esc ditangani peramban).
 * Di HP tampil sebagai lembar dari bawah; tombol tutup berupa ikon X di kanan atas.
 */
export function Dialog({
  terbuka,
  judul,
  onTutup,
  children,
}: {
  terbuka: boolean;
  judul: string;
  onTutup: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idJudul = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (terbuka && !d.open) d.showModal();
    if (!terbuka && d.open) d.close();
  }, [terbuka]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idJudul}
      onClose={onTutup}
      className="lembar gulir-halus max-h-[92dvh] overflow-y-auto m-0 mt-auto w-full max-w-none rounded-t-[2rem] border-0 bg-kertas p-0 text-tinta shadow-[0_-20px_60px_rgba(15,23,42,0.25)] backdrop:bg-tinta/40 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-lg sm:rounded-[2rem]"
    >
      <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-garis-halus sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <h2 id={idJudul} className="text-xl font-semibold tracking-tight">
            {judul}
          </h2>
          <button
            type="button"
            onClick={onTutup}
            aria-label={TEKS.UMUM_TUTUP}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-latar text-tinta-redup transition-colors duration-200 hover:bg-aksi-latar hover:text-aksi active:scale-95"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div>{children}</div>
      </div>
    </dialog>
  );
}
