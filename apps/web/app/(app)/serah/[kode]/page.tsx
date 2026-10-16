"use client";

import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { JenisEvent, PeranEvent } from "@serah/kontrak/enum";
import { TEKS, isi, type KunciTeks } from "@serah/kontrak/teks";
import { BannerGalat, KUNCI_STATUS, LencanaAliran, LencanaStatus } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg } from "@/lib/klien/angka";
import { IkonNav, type NamaIkonNav } from "@/lib/klien/komponen/ikon-nav";
import { PeriksaRantai } from "@/lib/klien/komponen/periksa-rantai";
import { RangkaHalaman } from "@/lib/klien/komponen/rangka";
import { TombolAjukanKoreksi } from "@/lib/klien/komponen/tombol-ajukan-koreksi";
import { useMuat } from "@/lib/klien/muat";
import { tanggalJamWib } from "@/lib/klien/periode";

// Teks per jenis event hanya bila sudah ada di §M; jenis lain tampil tanpa label (usulan teks: lihat PROGRESS-B S12).
const TEKS_EVENT: Partial<Record<JenisEvent, KunciTeks>> = {
  SERAH_DIBUAT: "STATUS_DRAF",
  SERAH_DIAMBIL: "STATUS_MENUNGGU_SETUJU",
  SERAH_DISETUJUI: "STATUS_DIANGKUT",
  SERAH_DIKEMBALIKAN: "K2_KEMBALIKAN",
  SERAH_DITERIMA: "STATUS_DITERIMA",
  SERAH_DITERIMA_SEBAGIAN: "STATUS_DITERIMA_SEBAGIAN",
  SERAH_DITOLAK: "STATUS_DITOLAK",
  SERAH_MENGGANTUNG: "STATUS_MENGGANTUNG",
};

/** Warna titik timeline menurut jenis event (tanpa merah). */
const WARNA_EVENT: Partial<Record<JenisEvent, string>> = {
  SERAH_DITERIMA: "bg-emerald-500",
  SERAH_DITERIMA_SEBAGIAN: "bg-indigo-500",
  SERAH_DITOLAK: "bg-purple-500",
  SERAH_MENGGANTUNG: "bg-amber-500",
  SERAH_DISETUJUI: "bg-aksi",
  SERAH_DIAMBIL: "bg-sky-500",
};

const TEKS_PERAN: Partial<Record<PeranEvent, KunciTeks>> = {
  PETUGAS: "PERAN_PETUGAS",
  PENGELOLA: "PERAN_PENGELOLA",
  PENGANGKUT: "PERAN_PENGANGKUT",
  PENERIMA: "PERAN_PENERIMA",
  ADMIN: "PERAN_ADMIN",
};

function TombolSidik({ sidik }: { sidik: string }) {
  const [tersalin, setTersalin] = useState(false);
  return (
    <button
      type="button"
      data-sidik-penuh={sidik}
      aria-label={`${TEKS.KOL_SIDIK}: ${sidik}`}
      title={sidik}
      onClick={() => {
        void navigator.clipboard
          .writeText(sidik)
          .then(() => setTersalin(true))
          .catch(() => setTersalin(false));
      }}
      className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 font-mono text-xs transition-all duration-200 active:scale-95 ${
        tersalin ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20" : "bg-latar text-tinta-redup hover:bg-aksi-latar hover:text-aksi"
      }`}
    >
      <span>{sidik.slice(0, 8)}</span>
      <span aria-hidden="true">{tersalin ? "✓" : "⧉"}</span>
    </button>
  );
}

function KartuFoto({ judul, url, tiket = false }: { judul: string; url?: string; tiket?: boolean }) {
  const [rusak, setRusak] = useState(false);
  const tampil = url && !rusak;
  return (
    <figure className="m-0 overflow-hidden rounded-2xl bg-latar/60 ring-1 ring-garis-halus/70">
      {tampil ? (
        <img src={url} alt={judul} onError={() => setRusak(true)} className="aspect-[4/3] w-full bg-white object-contain" />
      ) : (
        <div
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 border-b border-dashed border-garis-halus bg-gradient-to-b from-white to-latar/70 px-4 text-center"
          data-testid="foto-kosong"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-garis shadow-[0_4px_14px_rgba(15,23,42,0.07)]">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round" strokeLinejoin="round">
              {tiket ? (
                <>
                  <path d="M7 3h10a1 1 0 0 1 1 1v17l-2-1.500-2 1.500-2-1.500-2 1.500-2-1.500L6 21V4a1 1 0 0 1 1-1Z" />
                  <path d="M9 8h6M9 12h6" />
                </>
              ) : (
                <>
                  <rect x="3" y="5" width="18" height="14" rx="2.500" />
                  <circle cx="9" cy="10.500" r="1.500" />
                  <path d="m21 16-5-5-8 8" />
                </>
              )}
            </svg>
          </span>
          <span className="text-sm font-medium text-tinta-redup">{TEKS.SD_FOTO_KOSONG}</span>
        </div>
      )}
      <figcaption className="px-4 py-2.5 text-xs font-medium text-tinta-redup">{judul}</figcaption>
    </figure>
  );
}

function Info({ ikon, label, nilai, mono = false }: { ikon: NamaIkonNav; label: string; nilai: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/80 p-3.5 ring-1 ring-garis-halus/70 backdrop-blur">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aksi-latar text-aksi">
        <IkonNav nama={ikon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-tinta-redup">{label}</dt>
        <dd className={`truncate text-sm font-medium text-tinta ${mono ? "font-mono tracking-wider" : ""}`}>{nilai}</dd>
      </div>
    </div>
  );
}

function Metrik({ label, nilai, nada }: { label: string; nilai: string; nada: "baik" | "waspada" | "netral" }) {
  const kelas = { baik: "bg-emerald-50 text-emerald-700", waspada: "bg-amber-50 text-amber-700", netral: "bg-latar text-tinta" }[nada];
  return (
    <div className={`flex flex-col gap-0.5 rounded-xl px-3 py-2 ${kelas}`}>
      <span className="text-[11px] opacity-80">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums">{nilai}</span>
    </div>
  );
}

function Seksi({ id, judul, children }: { id: string; judul: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="muncul flex flex-col gap-4 rounded-3xl border border-garis-halus bg-kertas p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <h2 id={id} className="text-base font-semibold tracking-tight text-tinta">
        {judul}
      </h2>
      {children}
    </section>
  );
}

/** /serah/[kode]: detail serah — ringkasan, wadah, foto, tiket, rincian, dan timeline event berantai (sidik). */
export default function DetailSerah() {
  const { kode } = useParams<{ kode: string }>();
  const { keadaan, ulang } = useMuat(() => panggil("GET", "/api/serah/[kode]", { params: { kode } }));
  const d = keadaan.status === "siap" ? keadaan.data : null;

  const totalBerat = d ? d.wadah.reduce((j, w) => j + (w.beratG ?? 0), 0) : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Kepala */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            aria-label={TEKS.UMUM_KEMBALI}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-garis-halus bg-white text-tinta shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all duration-200 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi active:scale-95"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
              <path d="m14.500 6-6 6 6 6" stroke="currentColor" strokeWidth="2.100" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="font-mono text-xl font-semibold tracking-tight text-tinta sm:text-2xl" data-testid="kode-serah">
            {kode}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d ? <TombolAjukanKoreksi wadah={d.wadah} rincian={d.rincian} onSelesai={() => void ulang()} /> : null}
          {d ? <PeriksaRantai kawasanId={d.kawasan.id} ringkas /> : null}
        </div>
      </div>

      {keadaan.status === "memuat" ? <RangkaHalaman jumlah={2} /> : null}
      {keadaan.status === "galat" ? <BannerGalat pesan={keadaan.pesan} onCoba={() => void ulang()} /> : null}

      {d ? (
        <>
          {/* Ringkasan */}
          <section className="muncul flex flex-col gap-5 rounded-3xl border border-white/70 bg-gradient-to-br from-white via-white to-aksi-latar/60 p-5 shadow-[0_12px_40px_rgba(36,87,197,0.08)] ring-1 ring-garis-halus/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <LencanaStatus status={d.status} />
              <div className="flex flex-wrap gap-2">
                {d.aliran.map((a) => (
                  <LencanaAliran key={a} aliran={a} />
                ))}
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Info ikon="tps" label={TEKS.KOL_LOKASI} nilai={`${d.tps.kode} · ${d.kawasan.nama}`} />
              <Info ikon="akun" label={TEKS.KOL_PENGANGKUT} nilai={d.pengangkut?.nama ?? "—"} />
              <Info ikon="truk" label={TEKS.KOL_PLAT} nilai={d.kendaraan?.plat ?? "—"} mono />
              <Info ikon="kontrak" label={TEKS.KOL_TUJUAN} nilai={d.penerima?.nama ?? "—"} />
            </dl>
          </section>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="flex flex-col gap-5 lg:col-span-2">
              {/* Dicatat di TPS */}
              <Seksi id="sd-wadah" judul={TEKS.K1_DICATAT}>
                <ul className="flex flex-col gap-2">
                  {d.wadah.map((w) => (
                    <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-latar/60 px-3.5 py-3">
                      <LencanaAliran aliran={w.aliran} pendek />
                      <span className="font-mono text-sm font-semibold tabular-nums text-tinta">
                        {w.beratG !== null
                          ? isi("UMUM_KG", { nilai: formatGramKeKg(w.beratG) })
                          : w.jumlahWadah !== null
                            ? isi("UMUM_WADAH", { jumlah: w.jumlahWadah })
                            : TEKS.UMUM_BERAT_BELUM}
                      </span>
                    </li>
                  ))}
                </ul>
                {d.wadah.length > 1 && totalBerat > 0 ? (
                  <p className="flex items-center justify-between border-t border-garis-halus/70 pt-3 text-sm">
                    <span className="text-tinta-redup">{TEKS.LAPORAN_TOTAL}</span>
                    <span className="font-mono font-semibold tabular-nums text-tinta">{isi("UMUM_KG", { nilai: formatGramKeKg(totalBerat) })}</span>
                  </p>
                ) : null}
              </Seksi>

              {/* Diterima & ditolak */}
              {d.rincian.length > 0 ? (
                <Seksi id="sd-rincian" judul={TEKS.KOL_STATUS}>
                  <ul className="flex flex-col gap-3" data-testid="rincian">
                    {d.rincian.map((r) => {
                      const total = r.diterimaFinalG + r.ditolakFinalG;
                      const persenTerima = total > 0 ? (r.diterimaFinalG / total) * 100 : 0;
                      return (
                        <li key={r.id} className="flex flex-col gap-3 rounded-2xl bg-latar/60 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <LencanaAliran aliran={r.aliran} pendek />
                            {r.alasan ? (
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-tinta-redup ring-1 ring-garis-halus">
                                {TEKS[`ALASAN_${r.alasan}`]}
                              </span>
                            ) : null}
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-white ring-1 ring-garis-halus/60" aria-hidden="true">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${persenTerima}%` }} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Metrik label={TEKS.K1_DITERIMA} nilai={isi("UMUM_KG", { nilai: formatGramKeKg(r.diterimaFinalG) })} nada="baik" />
                            <Metrik label={TEKS.K1_DITOLAK} nilai={isi("UMUM_KG", { nilai: formatGramKeKg(r.ditolakFinalG) })} nada={r.ditolakFinalG > 0 ? "waspada" : "netral"} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Seksi>
              ) : null}

              {/* Riwayat berantai */}
              <Seksi id="sd-timeline" judul={TEKS.KOL_SIDIK}>
                <ol className="relative flex flex-col gap-4" data-testid="timeline">
                  <span aria-hidden="true" className="absolute bottom-3 left-[7px] top-3 w-px bg-garis-halus" />
                  {d.timeline.map((e) => {
                    const kunci = TEKS_EVENT[e.jenis];
                    const peran = TEKS_PERAN[e.peran];
                    return (
                      <li key={e.urutanRantai} data-event={e.jenis} className="relative flex gap-4 pl-6">
                        <span
                          aria-hidden="true"
                          className={`absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(148,163,184,0.5)] ${WARNA_EVENT[e.jenis] ?? "bg-garis"}`}
                        />
                        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-tinta">
                              <span className="font-mono text-xs tabular-nums text-tinta-redup">{`#${e.urutanRantai}`}</span>
                              {kunci ? <span>{TEKS[kunci]}</span> : null}
                              {peran ? <span className="rounded-full bg-latar px-2 py-0.5 text-[11px] font-medium text-tinta-redup">{TEKS[peran]}</span> : null}
                            </p>
                            <p className="mt-0.5 text-xs text-tinta-redup">{tanggalJamWib(e.terjadiPada)}</p>
                          </div>
                          <TombolSidik sidik={e.hash} />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Seksi>
            </div>

            {/* Foto */}
            <div className="flex flex-col gap-5 lg:col-span-1">
              <Seksi id="sd-foto" judul={TEKS.A2_FOTO}>
                <div className="flex flex-col gap-4">
                  <KartuFoto judul={TEKS.A2_FOTO} url={d.foto.find((f) => f.jenis !== "TIKET")?.url} />
                  <KartuFoto judul={TEKS.P1_FOTO_TIKET} url={d.foto.find((f) => f.jenis === "TIKET")?.url} tiket />
                </div>
              </Seksi>
            </div>
          </div>
        </>
      ) : null}

      <p className="sr-only">{d ? TEKS[KUNCI_STATUS[d.status]] : ""}</p>
    </div>
  );
}
