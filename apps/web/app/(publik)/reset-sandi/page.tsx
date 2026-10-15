"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";

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
    <Kartu className="flex flex-col gap-6 p-6 sm:p-8 border border-garis-halus bg-kertas shadow-md">
      <div className="border-b border-garis-halus pb-3">
        <h1 className="text-xl font-black text-tinta">{TEKS.RESET_JUDUL}</h1>
      </div>

      {galat ? <BannerGalat pesan={galat} /> : null}

      {berhasil ? (
        <div className="flex flex-col gap-5 py-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-2xl font-bold">
            ✓
          </div>
          <p className="text-base font-bold text-tinta [text-wrap:balance]">{TEKS.RESET_BERHASIL}</p>
          <Link href="/masuk" className="mt-2">
            <Tombol varian="utama" className="w-full bg-aksi hover:bg-aksi-hover text-white shadow-sm">
              {TEKS.MASUK_TOMBOL}
            </Tombol>
          </Link>
        </div>
      ) : (
        <form onSubmit={simpan} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reset-sandi" className="text-sm font-semibold text-tinta">
              {TEKS.MASUK_SANDI}
            </label>
            <input
              id="reset-sandi"
              type="password"
              required
              minLength={10}
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
            />
            <p className="text-xs text-tinta-redup">{TEKS.DAFTAR_SANDI_ATURAN}</p>
          </div>

          <Tombol
            type="submit"
            disabled={memuat || !token}
            className="w-full mt-2 bg-aksi hover:bg-aksi-hover text-white shadow-sm"
          >
            {memuat ? TEKS.UMUM_MUAT : TEKS.UMUM_SIMPAN}
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
  );
}

export default function HalamanResetSandi() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 text-tinta">
      {/* Brand Header */}
      <div className="mb-8 text-center flex flex-col items-center">
        <Link href="/" className="inline-block group" aria-label={TEKS.APP_NAMA}>
          <LogoSerah ukuran="md" denganTagline />
        </Link>
      </div>
      <Suspense fallback={<Kartu className="p-8 text-center">{TEKS.UMUM_MUAT}</Kartu>}>
        <IsiResetSandi />
      </Suspense>
    </main>
  );
}
