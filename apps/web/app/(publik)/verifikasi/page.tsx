"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";

function IsiVerifikasi() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"memuat" | "berhasil" | "gagal">("memuat");
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("gagal");
      setPesan(TEKS.VERIF_GAGAL);
      return;
    }

    let batal = false;
    void panggil("POST", "/api/auth/verifikasi", { body: { token } }).then((res) => {
      if (batal) return;
      if (res.ok) {
        setStatus("berhasil");
      } else {
        setStatus("gagal");
        setPesan(TEKS.VERIF_GAGAL);
      }
    });

    return () => {
      batal = true;
    };
  }, [token]);

  return (
    <Kartu className="flex flex-col gap-6 p-8 text-center border border-garis-halus bg-kertas shadow-md">
      {status === "memuat" ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-aksi border-t-transparent" />
          <p className="text-base text-tinta font-semibold">{TEKS.UMUM_MUAT}</p>
        </div>
      ) : status === "berhasil" ? (
        <div className="flex flex-col gap-5 py-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-2xl font-bold">
            ✓
          </div>
          <p className="text-lg text-tinta font-bold [text-wrap:balance]">{TEKS.VERIF_BERHASIL}</p>
          <Link href="/masuk">
            <Tombol varian="utama" className="w-full">
              {TEKS.MASUK_TOMBOL}
            </Tombol>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5 py-4">
          <BannerGalat pesan={pesan ?? TEKS.VERIF_GAGAL} />
          <Link href="/masuk">
            <Tombol varian="sekunder" className="w-full">
              {TEKS.MASUK_TOMBOL}
            </Tombol>
          </Link>
        </div>
      )}
    </Kartu>
  );
}

export default function HalamanVerifikasi() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block group">
          <LogoSerah ukuran="md" denganTagline />
        </Link>
      </div>
      <Suspense fallback={<Kartu className="p-8 text-center">{TEKS.UMUM_MUAT}</Kartu>}>
        <IsiVerifikasi />
      </Suspense>
    </main>
  );
}
