"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { panggil } from "@/lib/klien/api";
import { KELAS_INPUT, KerangkaAuth } from "@/lib/klien/komponen/kerangka-auth";
import { TumpukanToast, useToast } from "@/lib/klien/komponen/toast";

const VERSI_PDP = "PRIV-2026-10-1";

export default function HalamanDaftar() {
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [lihatSandi, setLihatSandi] = useState(false);
  const [setuju, setSetuju] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [terkirim, setTerkirim] = useState(false);
  const { daftar: toast, kirim: kirimToast, tutup: tutupToast } = useToast();

  async function kirimDaftar(e: FormEvent) {
    e.preventDefault();
    if (!setuju) return;
    setMemuat(true);

    let res;
    try {
      res = await panggil("POST", "/api/auth/daftar", {
        body: { email, sandi, persetujuanVersi: VERSI_PDP },
      });
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

    kirimToast("sukses", TEKS.DAFTAR_CEK_EMAIL);
    setTerkirim(true);
  }

  return (
    <KerangkaAuth visualJudul={TEKS.DAFTAR_VISUAL_JUDUL} visualSub={TEKS.DAFTAR_VISUAL_SUB}>
      <TumpukanToast daftar={toast} tutup={tutupToast} />

      <div className="hero-masuk flex flex-col gap-2">
        <p className="text-sm font-medium text-aksi">{TEKS.DAFTAR_SAPA}</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-[-0.025em] text-tinta sm:text-4xl">
          {TEKS.DAFTAR_JUDUL}
        </h1>
        <p className="text-sm leading-relaxed text-tinta-redup">{TEKS.DAFTAR_SUB}</p>
      </div>

      {terkirim ? (
        <div className="hero-masuk flex flex-col items-center gap-5 rounded-3xl border border-garis-halus bg-latar/60 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-aksi-latar text-2xl text-aksi">
            ✉
          </span>
          <p className="text-base font-medium leading-relaxed text-tinta [text-wrap:balance]">
            {TEKS.DAFTAR_CEK_EMAIL}
          </p>
          <Link
            href="/masuk"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-aksi text-sm font-medium text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover"
          >
            {TEKS.MASUK_TOMBOL}
          </Link>
        </div>
      ) : (
        <form onSubmit={kirimDaftar} className="hero-masuk flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="daftar-email" className="text-sm font-medium text-tinta">
              {TEKS.MASUK_EMAIL}
            </label>
            <input
              id="daftar-email"
              type="email"
              required
              autoComplete="email"
              placeholder="nama@kawasan.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={KELAS_INPUT}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="daftar-sandi" className="text-sm font-medium text-tinta">
              {TEKS.MASUK_SANDI}
            </label>
            <div className="relative">
              <input
                id="daftar-sandi"
                type={lihatSandi ? "text" : "password"}
                required
                minLength={10}
                autoComplete="new-password"
                value={sandi}
                onChange={(e) => setSandi(e.target.value)}
                className={`${KELAS_INPUT} pr-12`}
              />
              <button
                type="button"
                onClick={() => setLihatSandi((v) => !v)}
                aria-label={lihatSandi ? TEKS.MASUK_SEMBUNYI_SANDI : TEKS.MASUK_LIHAT_SANDI}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-tinta-redup transition-colors hover:bg-latar hover:text-aksi"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                  <path
                    d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                  {lihatSandi ? null : (
                    <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  )}
                </svg>
              </button>
            </div>
            <p className="text-xs text-tinta-redup">{TEKS.DAFTAR_SANDI_ATURAN}</p>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-garis-halus bg-latar/60 p-4 transition-colors duration-200 hover:border-aksi-garis">
            <input
              id="daftar-setuju"
              type="checkbox"
              required
              checked={setuju}
              onChange={(e) => setSetuju(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-garis accent-[#2457c5]"
            />
            <label htmlFor="daftar-setuju" className="cursor-pointer text-xs leading-relaxed text-tinta-redup">
              {TEKS.DAFTAR_SETUJU}
            </label>
          </div>

          <button
            type="submit"
            disabled={memuat || !setuju}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-aksi text-sm font-medium text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover hover:shadow-[0_12px_28px_rgba(36,87,197,0.38)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {memuat ? TEKS.UMUM_MUAT : TEKS.DAFTAR_TOMBOL}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-tinta-redup">
        <Link
          href="/masuk"
          className="font-medium text-tinta transition-colors hover:text-aksi hover:underline"
        >
          {TEKS.MASUK_JUDUL}
        </Link>
      </p>
    </KerangkaAuth>
  );
}
