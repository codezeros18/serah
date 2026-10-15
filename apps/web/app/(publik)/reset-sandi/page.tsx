"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";

function IsiResetSandi() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [sandi, setSandi] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [berhasil, setBerhasil] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setMemuat(true);

    const res = await panggil("POST", "/api/auth/reset", { body: { token, sandi } });
    setMemuat(false);

    if (!res.ok) {
      setGalat(res.pesan);
      return;
    }

    setBerhasil(true);
  }

  return (
    <Kartu className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-bold text-tinta">{TEKS.RESET_JUDUL}</h1>

      {galat ? <BannerGalat pesan={galat} /> : null}

      {berhasil ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-base text-tinta font-semibold">{TEKS.RESET_BERHASIL}</p>
          <Link href="/masuk">
            <Tombol varian="utama" className="w-full">
              {TEKS.MASUK_TOMBOL}
            </Tombol>
          </Link>
        </div>
      ) : (
        <form onSubmit={simpan} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reset-sandi" className="text-sm font-medium text-tinta">
              {TEKS.MASUK_SANDI}
            </label>
            <input
              id="reset-sandi"
              type="password"
              required
              minLength={10}
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              className="rounded-kontrol border border-garis bg-kertas px-3 py-2.5 text-base text-tinta focus:border-aksi focus:outline-none focus:ring-1 focus:ring-aksi"
            />
            <p className="text-xs text-tinta-redup">{TEKS.DAFTAR_SANDI_ATURAN}</p>
          </div>

          <Tombol type="submit" disabled={memuat || !token} className="w-full mt-2">
            {memuat ? TEKS.UMUM_MUAT : TEKS.UMUM_SIMPAN}
          </Tombol>
        </form>
      )}

      <div className="text-center text-sm border-t border-garis-halus pt-4">
        <Link href="/masuk" className="text-tinta-redup underline hover:text-tinta">
          {TEKS.UMUM_KEMBALI}
        </Link>
      </div>
    </Kartu>
  );
}

export default function HalamanResetSandi() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block text-2xl font-bold tracking-tight text-tinta">
          {TEKS.APP_NAMA}
        </Link>
      </div>
      <Suspense fallback={<Kartu className="p-6 text-center">{TEKS.UMUM_MUAT}</Kartu>}>
        <IsiResetSandi />
      </Suspense>
    </main>
  );
}
