"use client";

import Link from "next/link";
import { useState } from "react";
import { TEKS, isi } from "@serah/kontrak/teks";
import { AtribusiBMKG, BannerGalat, Kosong, LencanaAliran, PanelAturan } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { InfoTip } from "@/lib/klien/komponen/info-tip";
import { RangkaHalaman } from "@/lib/klien/komponen/rangka";
import { useMuat } from "@/lib/klien/muat";

const SELANG_MUAT_MS = 30_000;

type Saring = "semua" | "prioritas";

/** A1 — daftar serah yang menunggu diambil, prioritas angkut di atas. */
export default function LayarA1() {
  const { keadaan, ulang } = useMuat(() => panggil("GET", "/api/ambil"), SELANG_MUAT_MS);
  const [saring, setSaring] = useState<Saring>("semua");

  // Prioritas angkut dulu, lalu wadah yang paling lama menunggu (A1_URUTAN).
  const urut =
    keadaan.status === "siap"
      ? [...keadaan.data.serah].sort(
          (a, b) => Number(Boolean(b.prioritas)) - Number(Boolean(a.prioritas)) || b.umurJamTertua - a.umurJamTertua,
        )
      : [];
  const jumlahPrioritas = urut.filter((s) => s.prioritas).length;
  const tampil = saring === "prioritas" ? urut.filter((s) => s.prioritas) : urut;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS.A1_JUDUL}</h1>
        <InfoTip judul={TEKS.A1_JUDUL} isi={TEKS.INFO_A1} rata="kanan" />
      </div>
      <p className="sr-only">{TEKS.A1_URUTAN}</p>

      {keadaan.status === "siap" && urut.length > 0 ? (
        <div role="group" aria-label={TEKS.A1_JUDUL} className="flex gap-2">
          {(
            [
              { id: "semua", teks: TEKS.LIST_SEMUA, jumlah: urut.length },
              { id: "prioritas", teks: TEKS.LIST_PRIORITAS, jumlah: jumlahPrioritas },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={saring === f.id}
              onClick={() => setSaring(f.id)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200 ${
                saring === f.id
                  ? "border-tinta bg-tinta text-white shadow-sm"
                  : "border-garis-halus bg-kertas text-tinta hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
              }`}
            >
              <span>{f.teks}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                  saring === f.id ? "bg-white/20 text-white" : "bg-latar text-tinta-redup"
                }`}
              >
                {f.jumlah}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {keadaan.status === "memuat" ? <RangkaHalaman jumlah={2} /> : null}
      {keadaan.status === "galat" ? <BannerGalat pesan={keadaan.pesan} onCoba={() => void ulang()} /> : null}
      {keadaan.status === "siap" && keadaan.data.serah.length === 0 ? <Kosong teks={TEKS.K_KOSONG_AMBIL} /> : null}

      {tampil.map((s, i) => {
        const unggulan = Boolean(s.prioritas) && i === 0 && saring === "semua";
        return (
          <article
            key={s.kode}
            data-kode={s.kode}
            className={`muncul group flex flex-col gap-4 rounded-3xl p-5 transition-all duration-300 ${
              unggulan
                ? "bg-gradient-to-br from-aksi via-[#2f66da] to-[#173a8a] text-white shadow-[0_20px_50px_rgba(36,87,197,0.35)]"
                : s.prioritas
                  ? "border border-peringatan-garis/40 bg-peringatan-latar/50 shadow-[0_8px_30px_rgba(146,64,14,0.10)]"
                  : "border border-garis-halus bg-kertas shadow-[0_8px_30px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.12)]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {s.prioritas ? (
                  <span
                    className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                      unggulan ? "bg-white text-peringatan" : "bg-peringatan-latar text-peringatan ring-1 ring-peringatan-garis/30"
                    }`}
                  >
                    <span aria-hidden="true">▲</span>
                    {TEKS.STATUS_PRIORITAS_ANGKUT}
                  </span>
                ) : null}
                <p className={`truncate text-xl font-semibold tracking-tight ${unggulan ? "text-white" : "text-tinta"}`}>
                  {s.tps.nama}
                </p>
                <p className={`text-sm ${unggulan ? "text-white/75" : "text-tinta-redup"}`}>
                  {s.tps.kode} · {s.kawasan.nama}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-xl px-2.5 py-1 font-mono text-xs font-semibold ${
                  unggulan ? "bg-white/15 text-white" : "bg-latar text-tinta"
                }`}
              >
                {s.kode}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tabular-nums ${
                  unggulan ? "bg-white/15 text-white" : "bg-latar text-tinta"
                }`}
              >
                <span aria-hidden="true">⏱</span>
                {isi("A1_KARTU_UMUR", { jam: s.umurJamTertua })}
              </span>
              {s.aliran.map((a) => (
                <LencanaAliran key={a} aliran={a} pendek />
              ))}
            </div>

            {s.prioritas ? (
              <div
                className="flex flex-col gap-2.5 rounded-2xl bg-white p-3.5 text-tinta"
                data-prioritas={s.prioritas.sumber}
              >
                <PanelAturan aksi="PRIORITAS" kode="R10" teks={s.prioritas.teks} />
                <AtribusiBMKG />
              </div>
            ) : null}

            <Link
              href={`/pengangkut/serah/${s.kode}`}
              className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition-all duration-200 active:scale-[0.98] ${
                unggulan
                  ? "bg-white text-aksi hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.25)]"
                  : "bg-aksi text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] hover:-translate-y-0.5 hover:bg-aksi-hover"
              }`}
            >
              <span>{TEKS.A1_AMBIL}</span>
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
