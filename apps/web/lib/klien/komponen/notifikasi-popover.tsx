"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { panggil } from "../api";
import { type ItemNotifikasi, susunPesanNotifikasi, tautanObjek } from "../notifikasi-teks";
import { useLangsung } from "../sse";
import { IkonNav } from "./ikon-nav";

/**
 * Lonceng di navbar: lencana jumlah belum dibaca + popover daftar notifikasi
 * (bottom sheet di HP, dropdown di desktop). Menggantikan halaman notifikasi di menu.
 */
export function NotifikasiPopover() {
  const akar = useRef<HTMLDivElement>(null);
  const [buka, setBuka] = useState(false);
  const [daftar, setDaftar] = useState<ItemNotifikasi[]>([]);
  const [muatAwal, setMuatAwal] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    const res = await panggil("GET", "/api/notifikasi", { kueri: {} });
    setMuatAwal(false);
    if (res.ok) {
      setDaftar(res.data.notifikasi);
      setGalat(null);
    } else setGalat(res.pesan);
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  useLangsung(
    useCallback(
      (event) => {
        if (event.tipe === "notifikasi" || event.tipe === "serah") void muat();
      },
      [muat],
    ),
  );

  useEffect(() => {
    if (!buka) return;
    const luar = (e: PointerEvent) => {
      if (akar.current && !akar.current.contains(e.target as Node)) setBuka(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuka(false);
    };
    document.addEventListener("pointerdown", luar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", luar);
      document.removeEventListener("keydown", esc);
    };
  }, [buka]);

  const belum = daftar.filter((n) => !n.dibaca).length;

  async function bacaSemua() {
    const res = await panggil("POST", "/api/notifikasi/baca-semua", { body: {} });
    if (res.ok) setDaftar((p) => p.map((n) => ({ ...n, dibaca: true })));
  }

  async function bacaSatu(id: string) {
    setDaftar((p) => p.map((n) => (n.id === id ? { ...n, dibaca: true } : n)));
    await panggil("POST", "/api/notifikasi/[id]/baca", { params: { id }, body: {} });
  }

  return (
    <div ref={akar} className="relative">
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        aria-label={belum > 0 ? `${TEKS.NTF_JUDUL} (${belum})` : TEKS.NTF_JUDUL}
        aria-expanded={buka}
        aria-haspopup="dialog"
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 active:scale-95 ${
          buka ? "bg-tinta text-white" : "bg-latar text-tinta hover:bg-aksi-latar hover:text-aksi"
        }`}
      >
        <IkonNav nama="lonceng" className="h-5 w-5" />
        {belum > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-aksi px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-white"
          >
            {belum > 9 ? "9+" : belum}
          </span>
        ) : null}
      </button>

      {buka ? <div aria-hidden="true" onClick={() => setBuka(false)} className="fixed inset-0 z-40 bg-tinta/30 backdrop-blur-sm sm:hidden" /> : null}

      {buka ? (
        <section
          role="dialog"
          aria-label={TEKS.NTF_JUDUL}
          className="dropdown-masuk z-50 flex max-h-[70dvh] flex-col overflow-hidden border border-garis-halus bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:rounded-3xl sm:absolute sm:right-0 sm:top-full sm:mt-3 sm:w-[24rem] sm:origin-top-right sm:rounded-3xl"
        >
          <header className="flex items-center justify-between gap-3 border-b border-garis-halus/70 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-tinta">{TEKS.NTF_JUDUL}</h2>
              {belum > 0 ? (
                <span className="rounded-full bg-aksi px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">{belum}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              {belum > 0 ? (
                <button
                  type="button"
                  onClick={() => void bacaSemua()}
                  aria-label={TEKS.NTF_BACA_SEMUA}
                  title={TEKS.NTF_BACA_SEMUA}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-tinta-redup transition-colors hover:bg-aksi-latar hover:text-aksi active:scale-95"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                    <path d="m4 12.500 4 4L16 8m-3 8.500 1 1L21 8" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setBuka(false)}
                aria-label={TEKS.UMUM_TUTUP}
                className="flex h-9 w-9 items-center justify-center rounded-full text-tinta-redup transition-colors hover:bg-latar hover:text-tinta active:scale-95 sm:hidden"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>

          <div className="gulir-halus min-h-0 flex-1 overflow-y-auto">
            {galat ? <p role="alert" className="px-4 py-6 text-center text-sm text-tinta-redup">{galat}</p> : null}
            {muatAwal ? (
              <div role="status" className="flex flex-col gap-2 p-4">
                <span className="sr-only">{TEKS.UMUM_MUAT}</span>
                <span className="h-14 animate-pulse rounded-2xl bg-latar" />
                <span className="h-14 animate-pulse rounded-2xl bg-latar" />
              </div>
            ) : null}
            {!muatAwal && !galat && daftar.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-latar text-garis">
                  <IkonNav nama="lonceng" className="h-7 w-7" />
                </span>
                <p className="text-sm text-tinta-redup">{TEKS.K_KOSONG_NOTIFIKASI}</p>
              </div>
            ) : null}

            <ul className="flex flex-col">
              {daftar.map((n) => {
                const tautan = tautanObjek(n);
                const isi = (
                  <>
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.dibaca ? "bg-latar text-tinta-redup" : "bg-aksi text-white"}`}
                    >
                      <IkonNav nama="lonceng" className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm leading-snug ${n.dibaca ? "text-tinta-redup" : "font-medium text-tinta"}`}>
                        {susunPesanNotifikasi(n)}
                      </span>
                      <span className="mt-1 block font-mono text-[11px] text-tinta-redup">
                        {n.dibuatPada.slice(0, 16).replace("T", " ")}
                      </span>
                    </span>
                    {!n.dibaca ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-aksi" aria-label="Belum dibaca" /> : null}
                  </>
                );
                const kelas = "flex items-start gap-3 border-b border-garis-halus/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-aksi-latar/40";
                return (
                  <li key={n.id}>
                    {tautan ? (
                      <Link
                        href={tautan}
                        onClick={() => {
                          if (!n.dibaca) void bacaSatu(n.id);
                          setBuka(false);
                        }}
                        className={kelas}
                      >
                        {isi}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => !n.dibaca && void bacaSatu(n.id)} className={`${kelas} w-full`}>
                        {isi}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <footer className="border-t border-garis-halus/70 p-2">
            <Link
              href="/notifikasi"
              onClick={() => setBuka(false)}
              className="flex min-h-10 items-center justify-center rounded-xl text-sm font-medium text-aksi transition-colors hover:bg-aksi-latar"
            >
              {TEKS.UMUM_SEMUA}
            </Link>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
