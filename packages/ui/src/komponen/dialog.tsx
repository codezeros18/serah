"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { Tombol } from "./dasar";

/** Dialog memakai elemen <dialog> asli (fokus terkurung & Esc ditangani peramban). */
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
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-kartu border-2 border-garis bg-kertas p-0 text-tinta backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-4 p-4">
        <h2 id={idJudul} className="text-lg font-bold">
          {judul}
        </h2>
        <div>{children}</div>
        <div className="flex justify-end">
          <Tombol varian="sekunder" onClick={onTutup}>
            {TEKS.UMUM_TUTUP}
          </Tombol>
        </div>
      </div>
    </dialog>
  );
}
