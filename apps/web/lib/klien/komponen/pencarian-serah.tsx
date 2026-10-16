"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { TEKS } from "@serah/kontrak/teks";

const POLA_KODE_SERAH = /^SRH-\d{8}-\d{4}$/;

/** Kotak cari cepat di bilah atas desktop: ketik kode serah (SRH-…) lalu Enter. Pintasan: tombol "/". */
export function PencarianSerah() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [nilai, setNilai] = useState("");
  const [salah, setSalah] = useState(false);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const sedangMengetik = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "/" && !sedangMengetik) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, []);

  function kirim(e: FormEvent) {
    e.preventDefault();
    const kode = nilai.trim().toUpperCase();
    if (POLA_KODE_SERAH.test(kode)) {
      setSalah(false);
      setNilai("");
      ref.current?.blur();
      router.push(`/serah/${kode}`);
    } else {
      setSalah(true);
    }
  }

  return (
    <form onSubmit={kirim} role="search" className="relative w-full max-w-md">
      <label htmlFor="cari-serah" className="sr-only">
        {TEKS.NAV_CARI}
      </label>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-redup">
        <circle cx="11" cy="11" r="6.500" stroke="currentColor" strokeWidth="1.900" />
        <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" />
      </svg>
      <input
        id="cari-serah"
        ref={ref}
        type="text"
        autoComplete="off"
        value={nilai}
        onChange={(e) => {
          setNilai(e.target.value);
          setSalah(false);
        }}
        placeholder={`${TEKS.NAV_CARI} (SRH-…)`}
        className={`h-10 w-full rounded-xl border bg-latar pl-10 pr-10 text-sm text-tinta transition-all duration-200 placeholder:text-tinta-redup hover:border-garis focus:border-aksi focus:bg-white focus:outline-none focus:ring-4 focus:ring-aksi/15 ${
          salah ? "border-rose-300" : "border-transparent"
        }`}
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-garis-halus bg-white px-1.5 py-0.5 font-mono text-[11px] text-tinta-redup"
      >
        /
      </kbd>
      {salah ? (
        <p role="alert" className="absolute left-0 top-full z-10 mt-1.5 rounded-lg bg-tinta px-3 py-1.5 text-xs text-white shadow-lg">
          {TEKS.G_QR_TIDAK_DIKENAL}
        </p>
      ) : null}
    </form>
  );
}
