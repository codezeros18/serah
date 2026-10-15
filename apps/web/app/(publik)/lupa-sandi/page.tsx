"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";

export default function HalamanLupaSandi() {
  const [email, setEmail] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [terkirim, setTerkirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setMemuat(true);

    const res = await panggil("POST", "/api/auth/lupa", { body: { email } });
    setMemuat(false);

    if (!res.ok) {
      setGalat(res.pesan);
      return;
    }

    setTerkirim(true);
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
          <h1 className="text-xl font-black text-tinta">{TEKS.LUPA_JUDUL}</h1>
        </div>

        {galat ? <BannerGalat pesan={galat} /> : null}

        {terkirim ? (
          <div className="flex flex-col gap-5 py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-aksi-latar text-aksi text-2xl font-bold border border-aksi/25">
              ✉
            </div>
            <p className="text-base font-medium text-tinta leading-relaxed [text-wrap:balance]">
              {TEKS.LUPA_TERKIRIM}
            </p>
            <Link href="/masuk" className="mt-2">
              <Tombol varian="utama" className="w-full bg-aksi hover:bg-aksi-hover text-white shadow-sm">
                {TEKS.UMUM_KEMBALI}
              </Tombol>
            </Link>
          </div>
        ) : (
          <form onSubmit={kirim} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lupa-email" className="text-sm font-semibold text-tinta">
                {TEKS.MASUK_EMAIL}
              </label>
              <input
                id="lupa-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
              />
            </div>

            <Tombol
              type="submit"
              disabled={memuat}
              className="w-full mt-2 bg-aksi hover:bg-aksi-hover text-white shadow-sm"
            >
              {memuat ? TEKS.UMUM_MUAT : TEKS.UMUM_KIRIM}
            </Tombol>
          </form>
        )}

        <div className="text-center text-sm border-t border-garis-halus pt-4">
          <Link
            href="/masuk"
            className="font-semibold text-tinta-redup hover:text-aksi transition-colors"
          >
            ← {TEKS.UMUM_KEMBALI}
          </Link>
        </div>
      </Kartu>
    </main>
  );
}
