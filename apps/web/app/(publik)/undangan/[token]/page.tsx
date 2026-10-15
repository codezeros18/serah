"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Tombol } from "@serah/ui";
import { MOCK_AKTIF, panggil } from "@/lib/klien/api";
import { aturPeranMock } from "@/lib/klien/mock";
import { rutePeran } from "@/lib/klien/rute-peran";

const VERSI_PDP = "PRIV-2026-10-1";

export default function HalamanUndangan() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [setuju, setSetuju] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function terimaUndangan(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setMemuat(true);

    const body = email
      ? { token, email, sandi, persetujuanVersi: VERSI_PDP }
      : { token };

    const res = await panggil("POST", "/api/undangan/terima", { body });
    setMemuat(false);

    if (!res.ok) {
      setGalat(res.pesan);
      return;
    }

    if (MOCK_AKTIF && res.data.peran) aturPeranMock(res.data.peran);
    router.push(rutePeran(res.data.peran));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block text-2xl font-bold tracking-tight text-tinta">
          {TEKS.APP_NAMA}
        </Link>
      </div>

      <Kartu className="flex flex-col gap-6 p-6">
        <h1 className="text-xl font-bold text-tinta">{TEKS.UND_JUDUL}</h1>

        {galat ? <BannerGalat pesan={galat} /> : null}

        <form onSubmit={terimaUndangan} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="undangan-email" className="text-sm font-medium text-tinta">
              {TEKS.MASUK_EMAIL}
            </label>
            <input
              id="undangan-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-kontrol border border-garis bg-kertas px-3 py-2.5 text-base text-tinta focus:border-aksi focus:outline-none focus:ring-1 focus:ring-aksi"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="undangan-sandi" className="text-sm font-medium text-tinta">
              {TEKS.MASUK_SANDI}
            </label>
            <input
              id="undangan-sandi"
              type="password"
              minLength={10}
              autoComplete="new-password"
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              className="rounded-kontrol border border-garis bg-kertas px-3 py-2.5 text-base text-tinta focus:border-aksi focus:outline-none focus:ring-1 focus:ring-aksi"
            />
            <p className="text-xs text-tinta-redup">{TEKS.DAFTAR_SANDI_ATURAN}</p>
          </div>

          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="undangan-setuju"
              type="checkbox"
              checked={setuju}
              onChange={(e) => setSetuju(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-garis text-aksi focus:ring-aksi"
            />
            <label htmlFor="undangan-setuju" className="text-xs leading-normal text-tinta-redup">
              {TEKS.DAFTAR_SETUJU}
            </label>
          </div>

          <Tombol type="submit" disabled={memuat || !token || (email ? !setuju : false)} className="w-full mt-2">
            {memuat ? TEKS.UMUM_MUAT : TEKS.UND_TERIMA}
          </Tombol>
        </form>

        <div className="text-center text-sm border-t border-garis-halus pt-4">
          <Link href="/masuk" className="text-tinta-redup underline hover:text-tinta">
            {TEKS.MASUK_JUDUL}
          </Link>
        </div>
      </Kartu>
    </main>
  );
}
