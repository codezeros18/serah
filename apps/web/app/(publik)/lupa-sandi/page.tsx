"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";

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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block text-2xl font-bold tracking-tight text-tinta">
          {TEKS.APP_NAMA}
        </Link>
      </div>

      <Kartu className="flex flex-col gap-6 p-6">
        <h1 className="text-xl font-bold text-tinta">{TEKS.LUPA_JUDUL}</h1>

        {galat ? <BannerGalat pesan={galat} /> : null}

        {terkirim ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-base text-tinta">{TEKS.LUPA_TERKIRIM}</p>
            <Link href="/masuk">
              <Tombol varian="utama" className="w-full">
                {TEKS.UMUM_KEMBALI}
              </Tombol>
            </Link>
          </div>
        ) : (
          <form onSubmit={kirim} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lupa-email" className="text-sm font-medium text-tinta">
                {TEKS.MASUK_EMAIL}
              </label>
              <input
                id="lupa-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-kontrol border border-garis bg-kertas px-3 py-2.5 text-base text-tinta focus:border-aksi focus:outline-none focus:ring-1 focus:ring-aksi"
              />
            </div>

            <Tombol type="submit" disabled={memuat} className="w-full mt-2">
              {memuat ? TEKS.UMUM_MUAT : TEKS.UMUM_KIRIM}
            </Tombol>
          </form>
        )}

        <div className="text-center text-sm border-t border-garis-halus pt-4">
          <Link href="/masuk" className="text-tinta-redup underline hover:text-tinta">
            {TEKS.UMUM_KEMBALI}
          </Link>
        </div>
      </Kartu>
    </main>
  );
}
