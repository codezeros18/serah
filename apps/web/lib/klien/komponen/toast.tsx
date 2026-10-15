"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";

export type JenisToast = "galat" | "sukses" | "info";

interface ItemToast {
  id: number;
  jenis: JenisToast;
  judul: string;
  pesan: string;
}

const DURASI_MS = 6500;
const MAKS_TAMPIL = 3;

const JUDUL_BAWAAN: Record<JenisToast, string> = {
  galat: TEKS.TOAST_GALAT_JUDUL,
  sukses: TEKS.TOAST_SUKSES_JUDUL,
  info: TEKS.TOAST_INFO_JUDUL,
};

/** Hook ringan untuk notifikasi pojok kanan atas. Render `<TumpukanToast />` sekali di halaman. */
export function useToast() {
  const [daftar, setDaftar] = useState<ItemToast[]>([]);
  const urut = useRef(0);

  const tutup = useCallback((id: number) => {
    setDaftar((d) => d.filter((t) => t.id !== id));
  }, []);

  const kirim = useCallback((jenis: JenisToast, pesan: string, judul?: string) => {
    urut.current += 1;
    const id = urut.current;
    setDaftar((d) => [...d.slice(-(MAKS_TAMPIL - 1)), { id, jenis, pesan, judul: judul ?? JUDUL_BAWAAN[jenis] }]);
  }, []);

  return { daftar, kirim, tutup };
}

const WARNA: Record<JenisToast, { cincin: string; bulat: string; bar: string }> = {
  galat: { cincin: "ring-peringatan-garis/25", bulat: "bg-peringatan-latar text-peringatan", bar: "bg-peringatan-garis" },
  sukses: { cincin: "ring-status-selesai/25", bulat: "bg-status-selesai-latar text-status-selesai", bar: "bg-status-selesai" },
  info: { cincin: "ring-aksi/25", bulat: "bg-aksi-latar text-aksi", bar: "bg-aksi" },
};

function Ikon({ jenis }: { jenis: JenisToast }) {
  const jalur =
    jenis === "sukses"
      ? "m5 12.5 4.2 4.2L19 7"
      : jenis === "galat"
        ? "M12 7.5v5.5M12 16.5v.01"
        : "M12 11v5.5M12 7.5v.01";
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d={jalur} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Toast({ item, tutup }: { item: ItemToast; tutup: (id: number) => void }) {
  const [disorot, setDisorot] = useState(false);

  useEffect(() => {
    if (disorot) return;
    const t = window.setTimeout(() => tutup(item.id), DURASI_MS);
    return () => window.clearTimeout(t);
  }, [disorot, item.id, tutup]);

  const w = WARNA[item.jenis];
  return (
    <li
      onMouseEnter={() => setDisorot(true)}
      onMouseLeave={() => setDisorot(false)}
      className={`toast-masuk pointer-events-auto relative overflow-hidden rounded-2xl bg-white/90 p-4 pr-11 shadow-[0_16px_48px_rgba(15,23,42,0.18)] ring-1 backdrop-blur-xl ${w.cincin}`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${w.bulat}`}>
          <Ikon jenis={item.jenis} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-tinta">{item.judul}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-tinta-redup">{item.pesan}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => tutup(item.id)}
        aria-label={TEKS.TOAST_TUTUP}
        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-tinta-redup transition-colors hover:bg-latar hover:text-tinta"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <span
        aria-hidden="true"
        className={`toast-progres absolute inset-x-0 bottom-0 h-0.5 origin-left ${w.bar}`}
        style={{ animationDuration: `${DURASI_MS}ms`, animationPlayState: disorot ? "paused" : "running" }}
      />
    </li>
  );
}

export function TumpukanToast({
  daftar,
  tutup,
}: {
  daftar: ItemToast[];
  tutup: (id: number) => void;
}) {
  return (
    <ul
      role="alert"
      aria-live="assertive"
      className="pointer-events-none fixed right-3 top-3 z-[100] flex w-[min(92vw,380px)] flex-col gap-2.5 sm:right-5 sm:top-5"
    >
      {daftar.map((t) => (
        <Toast key={t.id} item={t} tutup={tutup} />
      ))}
    </ul>
  );
}
