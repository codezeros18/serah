"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { panggil } from "@/lib/klien/api";
import { KELAS_TOMBOL_UTAMA, KerangkaAuth } from "@/lib/klien/komponen/kerangka-auth";
import { KolomSandi } from "@/lib/klien/komponen/kolom-sandi";
import { TumpukanToast, useToast } from "@/lib/klien/komponen/toast";

function IsiResetSandi() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [sandi, setSandi] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [berhasil, setBerhasil] = useState(false);
  const { daftar: toast, kirim: kirimToast, tutup: tutupToast } = useToast();

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setMemuat(true);

    let res;
    try {
      res = await panggil("POST", "/api/auth/reset", { body: { token, sandi } });
    } catch {
      setMemuat(false);
      kirimToast("galat", TEKS.G_SERVER);
      return;
    }
    setMemuat(false);

    if (!res.ok) {
      kirimToast("galat", res.pesan);
      return;
    }

    kirimToast("sukses", TEKS.RESET_BERHASIL);
    setBerhasil(true);
  }

  return (
    <>
      <TumpukanToast daftar={toast} tutup={tutupToast} />

      <div className="hero-masuk flex flex-col gap-2">
        <p className="text-sm font-medium text-aksi">{TEKS.RESET_SAPA}</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-tinta sm:text-4xl">
          {TEKS.RESET_JUDUL}
        </h1>
        <p className="text-sm leading-relaxed text-tinta-redup">{TEKS.RESET_SUB}</p>
      </div>

      {berhasil ? (
        <div className="hero-masuk flex flex-col items-center gap-5 rounded-3xl border border-garis-halus bg-latar/60 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-status-selesai-latar text-2xl text-status-selesai">
            ✓
          </span>
          <p className="text-base font-medium text-tinta text-balance">{TEKS.RESET_BERHASIL}</p>
          <Link href="/masuk" className={KELAS_TOMBOL_UTAMA}>
            {TEKS.MASUK_TOMBOL}
          </Link>
        </div>
      ) : (
        <form onSubmit={simpan} className="hero-masuk flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="reset-sandi" className="text-sm font-medium text-tinta">
              {TEKS.MASUK_SANDI}
            </label>
            <KolomSandi
              id="reset-sandi"
              value={sandi}
              onChange={setSandi}
              minLength={10}
              autoComplete="new-password"
            />
            <p className="text-xs text-tinta-redup">{TEKS.DAFTAR_SANDI_ATURAN}</p>
          </div>
          <button type="submit" disabled={memuat || !token} className={KELAS_TOMBOL_UTAMA}>
            {memuat ? TEKS.UMUM_MUAT : TEKS.UMUM_SIMPAN}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-tinta-redup">
        <Link href="/masuk" className="font-medium text-tinta transition-colors hover:text-aksi hover:underline">
          ← {TEKS.UMUM_KEMBALI}
        </Link>
      </p>
    </>
  );
}

export default function HalamanResetSandi() {
  return (
    <KerangkaAuth visualJudul={TEKS.LANDING_MVP_JUDUL} visualSub={TEKS.LANDING_MVP_SUB}>
      <Suspense fallback={<p className="text-center text-sm text-tinta-redup">{TEKS.UMUM_MUAT}</p>}>
        <IsiResetSandi />
      </Suspense>
    </KerangkaAuth>
  );
}
