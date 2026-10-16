"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import type { JenisEvent, PeranEvent } from "@serah/kontrak/enum";
import { TEKS, isi, type KunciTeks } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, LencanaAliran, LencanaStatus, KUNCI_STATUS } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg } from "@/lib/klien/angka";
import { useMuat } from "@/lib/klien/muat";
import { tanggalJamWib } from "@/lib/klien/periode";
import { TombolAjukanKoreksi } from "@/lib/klien/komponen/tombol-ajukan-koreksi";

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
      className="inline-flex min-h-12 items-center gap-2 rounded-kontrol border-2 border-garis px-3 font-mono text-base"
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
    <figure className="m-0 overflow-hidden rounded-kartu border border-garis-halus bg-white shadow-sm">
      {tampil ? (
        <img src={url} alt={judul} onError={() => setRusak(true)} className="h-48 w-full bg-latar object-contain" />
      ) : (
        <div className="flex h-48 w-full flex-col items-center justify-center gap-2 bg-latar text-tinta-redup" data-testid="foto-kosong">
          <svg viewBox="0 0 24 24" width="44" height="44" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.500" strokeLinecap="round" strokeLinejoin="round">
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
          <span className="text-sm font-medium">{TEKS.SD_FOTO_KOSONG}</span>
        </div>
      )}
      <figcaption className="border-t border-garis-halus px-3 py-2 text-sm font-semibold text-tinta">{judul}</figcaption>
    </figure>
  );
}

/** /serah/[kode]: detail serah — ringkasan, wadah, foto, tiket, rincian, dan timeline event berantai (sidik). */
export default function DetailSerah() {
  const { kode } = useParams<{ kode: string }>();
  const { keadaan, ulang } = useMuat(() => panggil("GET", "/api/serah/[kode]", { params: { kode } }));
  const d = keadaan.status === "siap" ? keadaan.data : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-mono text-2xl font-bold tracking-tight" data-testid="kode-serah">
        {kode}
      </h1>
      {keadaan.status === "memuat" ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}
      {keadaan.status === "galat" ? <BannerGalat pesan={keadaan.pesan} onCoba={() => void ulang()} /> : null}

      {d ? (
        <>
          <Kartu className="flex flex-col gap-3 shadow-sm">
            <LencanaStatus status={d.status} />
            <div className="flex flex-wrap gap-2">
              {d.aliran.map((a) => (
                <LencanaAliran key={a} aliran={a} />
              ))}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-garis-halus pt-3 text-base [&_dt]:text-tinta-redup [&_dd]:font-medium">
              <dt className="font-semibold">{TEKS.KOL_LOKASI}</dt>
              <dd>{`${d.tps.kode} · ${d.kawasan.nama}`}</dd>
              <dt className="font-semibold">{TEKS.KOL_PENGANGKUT}</dt>
              <dd>{d.pengangkut?.nama ?? "—"}</dd>
              <dt className="font-semibold">{TEKS.KOL_PLAT}</dt>
              <dd>{d.kendaraan?.plat ?? "—"}</dd>
              <dt className="font-semibold">{TEKS.KOL_TUJUAN}</dt>
              <dd>{d.penerima?.nama ?? "—"}</dd>
            </dl>
          </Kartu>

          <section className="flex flex-col gap-2" aria-labelledby="sd-wadah">
            <h2 id="sd-wadah" className="text-lg font-bold">
              {TEKS.K1_DICATAT}
            </h2>
            <ul className="flex flex-col gap-2">
              {d.wadah.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-kartu border border-garis-halus bg-white p-3 shadow-sm">
                  <LencanaAliran aliran={w.aliran} pendek />
                  <span className="text-base font-semibold">
                    {w.beratG !== null
                      ? isi("UMUM_KG", { nilai: formatGramKeKg(w.beratG) })
                      : w.jumlahWadah !== null
                        ? isi("UMUM_WADAH", { jumlah: w.jumlahWadah })
                        : TEKS.UMUM_BERAT_BELUM}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {d.rincian.length > 0 ? (
            <section className="flex flex-col gap-2" aria-labelledby="sd-rincian">
              <h2 id="sd-rincian" className="text-lg font-bold">
                {TEKS.KOL_STATUS}
              </h2>
              <ul className="flex flex-col gap-2" data-testid="rincian">
                {d.rincian.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-kartu border border-garis-halus bg-white p-3 shadow-sm">
                    <LencanaAliran aliran={r.aliran} pendek />
                    <span>{`${TEKS.KOL_BERAT_DITERIMA}: ${isi("UMUM_KG", { nilai: formatGramKeKg(r.diterimaFinalG) })}`}</span>
                    <span>{`${TEKS.KOL_BERAT_DITOLAK}: ${isi("UMUM_KG", { nilai: formatGramKeKg(r.ditolakFinalG) })}`}</span>
                    {r.alasan ? <span>{TEKS[`ALASAN_${r.alasan}`]}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-3" aria-labelledby="sd-foto">
            <h2 id="sd-foto" className="text-lg font-bold">
              {TEKS.A2_FOTO}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <KartuFoto judul={TEKS.A2_FOTO} url={d.foto.find((f) => f.jenis !== "TIKET")?.url} />
              <KartuFoto judul={TEKS.P1_FOTO_TIKET} url={d.foto.find((f) => f.jenis === "TIKET")?.url} tiket />
            </div>
          </section>

          <section className="flex flex-col gap-2" aria-labelledby="sd-timeline">
            <h2 id="sd-timeline" className="text-lg font-bold">
              {TEKS.KOL_SIDIK}
            </h2>
            <ol className="flex flex-col gap-2" data-testid="timeline">
              {d.timeline.map((e) => {
                const kunci = TEKS_EVENT[e.jenis];
                const peran = TEKS_PERAN[e.peran];
                return (
                  <li key={e.urutanRantai} data-event={e.jenis} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-kartu border border-garis-halus bg-white p-3 shadow-sm">
                    <span className="text-sm tabular-nums">{`#${e.urutanRantai}`}</span>
                    {kunci ? <span className="text-base font-semibold">{TEKS[kunci]}</span> : null}
                    {peran ? <span className="text-base">{TEKS[peran]}</span> : null}
                    <span className="text-sm">{tanggalJamWib(e.terjadiPada)}</span>
                    <TombolSidik sidik={e.hash} />
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {d ? <TombolAjukanKoreksi wadah={d.wadah} rincian={d.rincian} onSelesai={() => void ulang()} /> : null}
        <Link href="/rantai" className="inline-flex min-h-12 items-center text-base font-semibold underline">
          {TEKS.RANTAI_JUDUL}
        </Link>
      </div>
      <p className="sr-only">{d ? TEKS[KUNCI_STATUS[d.status]] : ""}</p>
    </div>
  );
}
