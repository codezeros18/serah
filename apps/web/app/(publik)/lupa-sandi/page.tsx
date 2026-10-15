"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { panggil } from "@/lib/klien/api";
import {
  KELAS_INPUT,
  KELAS_TOMBOL_UTAMA,
  KerangkaAuth,
} from "@/lib/klien/komponen/kerangka-auth";
import { TumpukanToast, useToast } from "@/lib/klien/komponen/toast";

export default function HalamanLupaSandi() {
  const [email, setEmail] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [terkirim, setTerkirim] = useState(false);
  const { daftar: toast, kirim: kirimToast, tutup: tutupToast } = useToast();

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setMemuat(true);

    let res;
    try {
      res = await panggil("POST", "/api/auth/lupa", { body: { email } });
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

    kirimToast("sukses", TEKS.LUPA_TERKIRIM);
    setTerkirim(true);
  }

  return (
    <KerangkaAuth visualJudul={TEKS.LANDING_MVP_JUDUL} visualSub={TEKS.LANDING_MVP_SUB}>
      <TumpukanToast daftar={toast} tutup={tutupToast} />

      <div className="hero-masuk flex flex-col gap-2">
        <p className="text-sm font-medium text-aksi">{TEKS.LUPA_SAPA}</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-tinta sm:text-4xl">
          {TEKS.LUPA_JUDUL}
        </h1>
        <p className="text-sm leading-relaxed text-tinta-redup">{TEKS.LUPA_SUB}</p>
      </div>

      {terkirim ? (
        <div className="hero-masuk flex flex-col items-center gap-5 rounded-3xl border border-garis-halus bg-latar/60 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-aksi-latar text-2xl text-aksi">
            ✉
          </span>
          <p className="text-base font-medium leading-relaxed text-tinta text-balance">{TEKS.LUPA_TERKIRIM}</p>
          <Link href="/masuk" className={KELAS_TOMBOL_UTAMA}>
            {TEKS.UMUM_KEMBALI}
          </Link>
        </div>
      ) : (
        <form onSubmit={kirim} className="hero-masuk flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="lupa-email" className="text-sm font-medium text-tinta">
              {TEKS.MASUK_EMAIL}
            </label>
            <input
              id="lupa-email"
              type="email"
              required
              autoComplete="email"
              placeholder="nama@kawasan.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={KELAS_INPUT}
            />
          </div>
          <button type="submit" disabled={memuat} className={KELAS_TOMBOL_UTAMA}>
            {memuat ? TEKS.UMUM_MUAT : TEKS.UMUM_KIRIM}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-tinta-redup">
        <Link href="/masuk" className="font-medium text-tinta transition-colors hover:text-aksi hover:underline">
          ← {TEKS.UMUM_KEMBALI}
        </Link>
      </p>
    </KerangkaAuth>
  );
}
