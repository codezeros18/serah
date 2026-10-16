"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Peran } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";
import { MOCK_AKTIF, panggil } from "@/lib/klien/api";
import { aturPeranMock } from "@/lib/klien/mock";
import { rutePeran } from "@/lib/klien/rute-peran";
import { KELAS_INPUT, KerangkaAuth } from "@/lib/klien/komponen/kerangka-auth";
import { TumpukanToast, useToast } from "@/lib/klien/komponen/toast";
import { IkonLanding, type NamaIkon } from "@/lib/klien/komponen/ikon-landing";

const AKUN_DEMO: { peran: Peran; label: string; hint: string; ikon: NamaIkon }[] = [
  { peran: "PETUGAS", label: TEKS.PERAN_PETUGAS, hint: TEKS.T1_JUDUL, ikon: "tps" },
  { peran: "PENGANGKUT", label: TEKS.PERAN_PENGANGKUT, hint: TEKS.A2_FOTO, ikon: "truk" },
  { peran: "PENGELOLA", label: TEKS.PERAN_PENGELOLA, hint: TEKS.K1_JUDUL, ikon: "laporan" },
  { peran: "PENERIMA", label: TEKS.PERAN_PENERIMA, hint: TEKS.P1_JUDUL, ikon: "timbang" },
];

export default function HalamanMasuk() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [lihatSandi, setLihatSandi] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const { daftar: toast, kirim: kirimToast, tutup: tutupToast } = useToast();

  async function kirimMasuk(e: FormEvent) {
    e.preventDefault();
    setMemuat(true);

    let res;
    try {
      res = await panggil("POST", "/api/auth/masuk", { body: { email, sandi } });
    } catch {
      setMemuat(false);
      kirimToast("galat", TEKS.G_SERVER);
      return;
    }
    setMemuat(false);

    if (!res.ok) {
      if (res.galat.kode === "TIDAK_DITEMUKAN" || res.galat.kode === "VALIDASI_GAGAL") {
        kirimToast("galat", TEKS.MASUK_SALAH);
      } else {
        kirimToast("galat", res.pesan);
      }
      return;
    }

    const peran = res.data.sesi.peranAktif;
    if (MOCK_AKTIF && peran) aturPeranMock(peran);
    router.push(rutePeran(peran));
  }

  async function masukDemo(peran: Peran) {
    setMemuat(true);
    let res;
    try {
      res = await panggil("POST", "/api/auth/demo", { body: { peran } });
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

    if (MOCK_AKTIF) aturPeranMock(peran);
    router.push(rutePeran(peran));
  }

  return (
    <KerangkaAuth visualJudul={TEKS.LANDING_MVP_JUDUL} visualSub={TEKS.LANDING_MVP_SUB}>
      <TumpukanToast daftar={toast} tutup={tutupToast} />
            <div className="hero-masuk flex flex-col gap-2">
              <p className="text-sm font-medium text-aksi">{TEKS.MASUK_SAPA}</p>
              <h1 className="text-3xl font-semibold leading-tight tracking-[-0.025em] text-tinta sm:text-4xl">
                {TEKS.MASUK_JUDUL}
              </h1>
              <p className="text-sm leading-relaxed text-tinta-redup">{TEKS.MASUK_SUB}</p>
            </div>

            <form onSubmit={kirimMasuk} className="hero-masuk flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="masuk-email" className="text-sm font-medium text-tinta">
                  {TEKS.MASUK_EMAIL}
                </label>
                <input
                  id="masuk-email"
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
                <div className="flex items-center justify-between">
                  <label htmlFor="masuk-sandi" className="text-sm font-medium text-tinta">
                    {TEKS.MASUK_SANDI}
                  </label>
                  <Link
                    href="/lupa-sandi"
                    className="text-xs font-medium text-aksi transition-colors hover:text-aksi-hover hover:underline"
                  >
                    {TEKS.MASUK_LUPA}
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="masuk-sandi"
                    type={lihatSandi ? "text" : "password"}
                    required
                    autoComplete="current-password"
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
              </div>

              <button
                type="submit"
                disabled={memuat}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-aksi text-sm font-medium text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover hover:shadow-[0_12px_28px_rgba(36,87,197,0.38)] active:translate-y-0 active:scale-[0.99] disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {memuat ? TEKS.UMUM_MUAT : TEKS.MASUK_TOMBOL}
              </button>

              <p className="text-center text-sm text-tinta-redup">
                <Link
                  href="/daftar"
                  className="font-medium text-tinta transition-colors hover:text-aksi hover:underline"
                >
                  {TEKS.MASUK_DAFTAR}
                </Link>
              </p>
            </form>

            {/* Akun demo */}
            <section aria-label={TEKS.DEMO_LABEL} className="hero-masuk flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-garis-halus" />
                <span className="text-xs font-medium text-tinta-redup">{TEKS.MASUK_DEMO_JUDUL}</span>
                <span className="h-px flex-1 bg-garis-halus" />
              </div>
              <p className="text-center text-xs text-tinta-redup">{TEKS.MASUK_DEMO_SUB}</p>
              <div className="grid grid-cols-2 gap-2.5">
                {AKUN_DEMO.map((a, i) => (
                  <button
                    key={a.peran}
                    type="button"
                    disabled={memuat}
                    aria-label={isi("MASUK_DEMO", { peran: a.label })}
                    onClick={() => masukDemo(a.peran)}
                    className="group flex items-center gap-3 rounded-2xl border border-garis-halus bg-kertas p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-aksi-garis hover:bg-aksi-latar/50 hover:shadow-[0_10px_24px_rgba(36,87,197,0.12)] active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-latar transition-colors duration-200 group-hover:bg-white">
                      <IkonLanding
                        nama={a.ikon}
                        className="h-6 w-6 transition-transform duration-300 group-hover:scale-110"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-tinta">
                        <span aria-hidden="true" className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-aksi-latar text-[11px] font-semibold text-aksi">{i + 1}</span>
                        {a.label}
                      </span>
                      <span className="block truncate text-[11px] text-tinta-redup">{a.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
    </KerangkaAuth>
  );
}
