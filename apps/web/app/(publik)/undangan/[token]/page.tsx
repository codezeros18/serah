"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { MOCK_AKTIF, panggil } from "@/lib/klien/api";
import { aturPeranMock } from "@/lib/klien/mock";
import { rutePeran } from "@/lib/klien/rute-peran";
import { KELAS_INPUT, KELAS_TOMBOL_UTAMA, KerangkaAuth } from "@/lib/klien/komponen/kerangka-auth";
import { KolomSandi } from "@/lib/klien/komponen/kolom-sandi";
import { TumpukanToast, useToast } from "@/lib/klien/komponen/toast";

const VERSI_PDP = "PRIV-2026-10-1";

export default function HalamanUndangan() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [setuju, setSetuju] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const { daftar: toast, kirim: kirimToast, tutup: tutupToast } = useToast();

  async function terimaUndangan(e: FormEvent) {
    e.preventDefault();
    setMemuat(true);

    const body = email ? { token, email, sandi, persetujuanVersi: VERSI_PDP } : { token };

    let res;
    try {
      res = await panggil("POST", "/api/undangan/terima", { body });
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

    if (MOCK_AKTIF && res.data.peran) aturPeranMock(res.data.peran);
    router.push(rutePeran(res.data.peran));
  }

  return (
    <KerangkaAuth visualJudul={TEKS.LANDING_MVP_JUDUL} visualSub={TEKS.LANDING_MVP_SUB}>
      <TumpukanToast daftar={toast} tutup={tutupToast} />

      <div className="hero-masuk flex flex-col gap-2">
        <p className="text-sm font-medium text-aksi">{TEKS.UND_SAPA}</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-tinta sm:text-4xl">
          {TEKS.UND_JUDUL}
        </h1>
        <p className="text-sm leading-relaxed text-tinta-redup">{TEKS.UND_SUB}</p>
      </div>

      <form onSubmit={terimaUndangan} className="hero-masuk flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="undangan-email" className="text-sm font-medium text-tinta">
            {TEKS.MASUK_EMAIL}
          </label>
          <input
            id="undangan-email"
            type="email"
            autoComplete="email"
            placeholder="nama@kawasan.id"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={KELAS_INPUT}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="undangan-sandi" className="text-sm font-medium text-tinta">
            {TEKS.MASUK_SANDI}
          </label>
          <KolomSandi
            id="undangan-sandi"
            value={sandi}
            onChange={setSandi}
            minLength={10}
            autoComplete="new-password"
            required={false}
          />
          <p className="text-xs text-tinta-redup">{TEKS.DAFTAR_SANDI_ATURAN}</p>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-garis-halus bg-latar/60 p-4 transition-all duration-200 hover:border-aksi-garis has-[:checked]:border-aksi-garis has-[:checked]:bg-aksi-latar/60">
          <input
            id="undangan-setuju"
            type="checkbox"
            checked={setuju}
            onChange={(e) => setSetuju(e.target.checked)}
            className="kotak-centang"
          />
          <label htmlFor="undangan-setuju" className="cursor-pointer select-none text-xs leading-relaxed text-tinta-redup">
            {TEKS.DAFTAR_SETUJU}
          </label>
        </div>

        <button
          type="submit"
          disabled={memuat || !token || (email ? !setuju : false)}
          className={KELAS_TOMBOL_UTAMA}
        >
          {memuat ? TEKS.UMUM_MUAT : TEKS.UND_TERIMA}
        </button>
      </form>

      <p className="text-center text-sm text-tinta-redup">
        <Link href="/masuk" className="font-medium text-tinta transition-colors hover:text-aksi hover:underline">
          {TEKS.MASUK_JUDUL}
        </Link>
      </p>
    </KerangkaAuth>
  );
}
