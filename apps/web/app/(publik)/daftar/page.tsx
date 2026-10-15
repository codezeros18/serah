"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";

const VERSI_PDP = "PRIV-2026-10-1";

export default function HalamanDaftar() {
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [setuju, setSetuju] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [terkirim, setTerkirim] = useState(false);

  async function kirimDaftar(e: FormEvent) {
    e.preventDefault();
    if (!setuju) return;
    setGalat(null);
    setMemuat(true);

    const res = await panggil("POST", "/api/auth/daftar", {
      body: {
        email,
        sandi,
        persetujuanVersi: VERSI_PDP,
      },
    });
    setMemuat(false);

    if (!res.ok) {
      setGalat(res.pesan);
      return;
    }

    setTerkirim(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block text-2xl font-bold tracking-tight text-tinta">
          {TEKS.APP_NAMA}
        </Link>
        <p className="mt-1 text-sm text-tinta-redup">{TEKS.APP_TAGLINE}</p>
      </div>

      <Kartu className="flex flex-col gap-6 p-6">
        <h1 className="text-xl font-bold text-tinta">{TEKS.DAFTAR_JUDUL}</h1>

        {galat ? <BannerGalat pesan={galat} /> : null}

        {terkirim ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-base text-tinta">{TEKS.DAFTAR_CEK_EMAIL}</p>
            <Link href="/masuk">
              <Tombol varian="utama" className="w-full">
                {TEKS.MASUK_TOMBOL}
              </Tombol>
            </Link>
          </div>
        ) : (
          <form onSubmit={kirimDaftar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="daftar-email" className="text-sm font-medium text-tinta">
                {TEKS.MASUK_EMAIL}
              </label>
              <input
                id="daftar-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-kontrol border border-garis bg-kertas px-3 py-2.5 text-base text-tinta focus:border-aksi focus:outline-none focus:ring-1 focus:ring-aksi"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="daftar-sandi" className="text-sm font-medium text-tinta">
                {TEKS.MASUK_SANDI}
              </label>
              <input
                id="daftar-sandi"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={sandi}
                onChange={(e) => setSandi(e.target.value)}
                className="rounded-kontrol border border-garis bg-kertas px-3 py-2.5 text-base text-tinta focus:border-aksi focus:outline-none focus:ring-1 focus:ring-aksi"
              />
              <p className="text-xs text-tinta-redup">{TEKS.DAFTAR_SANDI_ATURAN}</p>
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="daftar-setuju"
                type="checkbox"
                required
                checked={setuju}
                onChange={(e) => setSetuju(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-garis text-aksi focus:ring-aksi"
              />
              <label htmlFor="daftar-setuju" className="text-xs leading-normal text-tinta-redup">
                {TEKS.DAFTAR_SETUJU}
              </label>
            </div>

            <Tombol type="submit" disabled={memuat || !setuju} className="w-full mt-2">
              {memuat ? TEKS.UMUM_MUAT : TEKS.DAFTAR_TOMBOL}
            </Tombol>
          </form>
        )}

        <div className="text-center text-sm border-t border-garis-halus pt-4">
          <Link href="/masuk" className="text-tinta-redup underline hover:text-tinta">
            {TEKS.MASUK_JUDUL}
          </Link>
        </div>
      </Kartu>
    </main>
  );
}
