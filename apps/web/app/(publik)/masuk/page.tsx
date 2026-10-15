"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Peran } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Tombol } from "@serah/ui";
import { MOCK_AKTIF, panggil } from "@/lib/klien/api";
import { aturPeranMock } from "@/lib/klien/mock";
import { rutePeran } from "@/lib/klien/rute-peran";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";

const PERAN_DEMO: readonly Peran[] = ["PETUGAS", "PENGANGKUT", "PENGELOLA", "PENERIMA"];

export default function HalamanMasuk() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function kirimMasuk(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setMemuat(true);

    const res = await panggil("POST", "/api/auth/masuk", { body: { email, sandi } });
    setMemuat(false);

    if (!res.ok) {
      if (res.galat.kode === "TIDAK_DITEMUKAN" || res.galat.kode === "VALIDASI_GAGAL") {
        setGalat(TEKS.MASUK_SALAH);
      } else {
        setGalat(res.pesan);
      }
      return;
    }

    const peran = res.data.sesi.peranAktif;
    if (MOCK_AKTIF && peran) aturPeranMock(peran);
    router.push(rutePeran(peran));
  }

  async function masukDemo(peran: Peran) {
    setGalat(null);
    setMemuat(true);
    const res = await panggil("POST", "/api/auth/demo", { body: { peran } });
    setMemuat(false);

    if (!res.ok) {
      setGalat(res.pesan);
      return;
    }

    if (MOCK_AKTIF) aturPeranMock(peran);
    router.push(rutePeran(peran));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 text-tinta">
      {/* Brand Header */}
      <div className="mb-8 text-center flex flex-col items-center">
        <Link href="/" className="inline-block group" aria-label={TEKS.APP_NAMA}>
          <LogoSerah ukuran="md" denganTagline />
        </Link>
      </div>

      <Kartu className="flex flex-col gap-6 p-6 sm:p-8 border border-garis-halus bg-kertas shadow-md">
        <div className="border-b border-garis-halus pb-3">
          <h1 className="text-xl font-black text-tinta">{TEKS.MASUK_JUDUL}</h1>
        </div>

        {galat ? <BannerGalat pesan={galat} /> : null}

        <form onSubmit={kirimMasuk} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="masuk-email" className="text-sm font-semibold text-tinta">
              {TEKS.MASUK_EMAIL}
            </label>
            <input
              id="masuk-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="masuk-sandi" className="text-sm font-semibold text-tinta">
                {TEKS.MASUK_SANDI}
              </label>
              <Link
                href="/lupa-sandi"
                className="text-xs font-semibold text-aksi hover:underline transition-colors"
              >
                {TEKS.MASUK_LUPA}
              </Link>
            </div>
            <input
              id="masuk-sandi"
              type="password"
              required
              autoComplete="current-password"
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
            />
          </div>

          <Tombol
            type="submit"
            disabled={memuat}
            className="w-full mt-2 bg-aksi hover:bg-aksi-hover text-white shadow-sm"
          >
            {memuat ? TEKS.UMUM_MUAT : TEKS.MASUK_TOMBOL}
          </Tombol>
        </form>

        <div className="text-center text-sm border-t border-garis-halus pt-4">
          <Link
            href="/daftar"
            className="font-semibold text-tinta-redup hover:text-aksi transition-colors"
          >
            {TEKS.MASUK_DAFTAR}
          </Link>
        </div>

        {/* Demo Fast Login */}
        <div className="rounded-kartu border border-garis-halus bg-latar/70 p-4">
          <p className="mb-3 text-center text-xs font-bold tracking-wide text-tinta-redup">
            {TEKS.DEMO_LABEL}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PERAN_DEMO.map((p) => {
              const label =
                p === "PETUGAS"
                  ? TEKS.PERAN_PETUGAS
                  : p === "PENGANGKUT"
                    ? TEKS.PERAN_PENGANGKUT
                    : p === "PENGELOLA"
                      ? TEKS.PERAN_PENGELOLA
                      : TEKS.PERAN_PENERIMA;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={memuat}
                  onClick={() => masukDemo(p)}
                  className="inline-flex min-h-10 items-center justify-center rounded-kontrol border border-garis-halus bg-kertas px-2.5 py-2 text-xs font-bold text-tinta hover:border-aksi hover:text-aksi hover:bg-aksi-latar/50 transition-all active:scale-[0.98] shadow-2xs disabled:opacity-50"
                >
                  {isi("MASUK_DEMO", { peran: label })}
                </button>
              );
            })}
          </div>
        </div>
      </Kartu>
    </main>
  );
}
