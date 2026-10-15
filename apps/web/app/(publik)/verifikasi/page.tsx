"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { panggil } from "@/lib/klien/api";
import {
  KELAS_TOMBOL_TEPI,
  KELAS_TOMBOL_UTAMA,
  KerangkaAuth,
} from "@/lib/klien/komponen/kerangka-auth";
import { TumpukanToast, useToast } from "@/lib/klien/komponen/toast";

function IsiVerifikasi() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"memuat" | "berhasil" | "gagal">("memuat");
  const { daftar: toast, kirim: kirimToast, tutup: tutupToast } = useToast();

  useEffect(() => {
    if (!token) {
      setStatus("gagal");
      kirimToast("galat", TEKS.VERIF_GAGAL);
      return;
    }

    let batal = false;
    void panggil("POST", "/api/auth/verifikasi", { body: { token } })
      .then((res) => {
        if (batal) return;
        if (res.ok) {
          setStatus("berhasil");
          kirimToast("sukses", TEKS.VERIF_BERHASIL);
        } else {
          setStatus("gagal");
          kirimToast("galat", TEKS.VERIF_GAGAL);
        }
      })
      .catch(() => {
        if (batal) return;
        setStatus("gagal");
        kirimToast("galat", TEKS.G_SERVER);
      });

    return () => {
      batal = true;
    };
  }, [token, kirimToast]);

  return (
    <>
      <TumpukanToast daftar={toast} tutup={tutupToast} />

      <div className="hero-masuk flex flex-col gap-2">
        <p className="text-sm font-medium text-aksi">{TEKS.VERIF_SAPA}</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-tinta sm:text-4xl">
          {TEKS.VERIF_JUDUL}
        </h1>
      </div>

      <div className="hero-masuk flex flex-col items-center gap-5 rounded-3xl border border-garis-halus bg-latar/60 p-8 text-center">
        {status === "memuat" ? (
          <>
            <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-aksi border-t-transparent" />
            <p className="text-base font-medium text-tinta">{TEKS.UMUM_MUAT}</p>
          </>
        ) : status === "berhasil" ? (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-status-selesai-latar text-2xl text-status-selesai">
              ✓
            </span>
            <p className="text-base font-medium text-tinta text-balance">{TEKS.VERIF_BERHASIL}</p>
            <Link href="/masuk" className={KELAS_TOMBOL_UTAMA}>
              {TEKS.MASUK_TOMBOL}
            </Link>
          </>
        ) : (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-peringatan-latar text-2xl text-peringatan">
              !
            </span>
            <p className="text-base font-medium text-tinta text-balance">{TEKS.VERIF_GAGAL}</p>
            <Link href="/masuk" className={KELAS_TOMBOL_TEPI}>
              {TEKS.MASUK_TOMBOL}
            </Link>
          </>
        )}
      </div>
    </>
  );
}

export default function HalamanVerifikasi() {
  return (
    <KerangkaAuth visualJudul={TEKS.LANDING_MVP_JUDUL} visualSub={TEKS.LANDING_MVP_SUB}>
      <Suspense fallback={<p className="text-center text-sm text-tinta-redup">{TEKS.UMUM_MUAT}</p>}>
        <IsiVerifikasi />
      </Suspense>
    </KerangkaAuth>
  );
}
