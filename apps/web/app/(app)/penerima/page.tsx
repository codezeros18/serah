"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kosong, LencanaAliran, LencanaStatus } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import dynamic from "next/dynamic";
import { InfoTip } from "@/lib/klien/komponen/info-tip";
import { Rangka, RangkaHalaman } from "@/lib/klien/komponen/rangka";
import { useMuat } from "@/lib/klien/muat";

const PemindaiQr = dynamic(() => import("@/lib/klien/komponen/pemindai-qr").then((m) => m.PemindaiQr), {
  ssr: false,
  loading: () => <Rangka className="aspect-square w-full" />,
});

const POLA_KODE_SERAH = /^SRH-\d{8}-\d{4}$/;

type Saring = "semua" | "MENGGANTUNG" | "DIANGKUT";

/** P1 — daftar serah yang menuju penerima; pindai QR serah membuka layar tutup. */
export default function LayarP1() {
  const router = useRouter();
  const [pindai, setPindai] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [saring, setSaring] = useState<Saring>("semua");

  const masuk = useMuat(async () => {
    const [angkut, gantung] = await Promise.all([
      panggil("GET", "/api/serah", { kueri: { status: "DIANGKUT" } }),
      panggil("GET", "/api/serah", { kueri: { status: "MENGGANTUNG" } }),
    ]);
    if (!angkut.ok) return angkut;
    if (!gantung.ok) return gantung;
    return { ok: true as const, data: { serah: [...gantung.data.serah, ...angkut.data.serah] } };
  }, 30_000);

  const hasilPindai = useCallback(
    (teks: string) => {
      const kode = teks.trim();
      if (POLA_KODE_SERAH.test(kode)) router.push(`/penerima/serah/${kode}`);
      else setGalat(TEKS.G_QR_TIDAK_DIKENAL);
    },
    [router],
  );

  const semua = masuk.keadaan.status === "siap" ? masuk.keadaan.data.serah : [];
  const jumlahGantung = semua.filter((s) => s.status === "MENGGANTUNG").length;
  const jumlahAngkut = semua.filter((s) => s.status === "DIANGKUT").length;
  const tampil = saring === "semua" ? semua : semua.filter((s) => s.status === saring);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS.P1_JUDUL}</h1>
          <InfoTip judul={TEKS.P1_JUDUL} isi={TEKS.INFO_P1} />
        </div>
        <button
          type="button"
          onClick={() => setPindai((v) => !v)}
          aria-pressed={pindai}
          className={`inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 ${
            pindai
              ? "bg-tinta text-white shadow-[0_8px_20px_rgba(15,23,42,0.2)]"
              : "bg-aksi text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] hover:bg-aksi-hover"
          }`}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path
              d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16"
              stroke="currentColor"
              strokeWidth="1.900"
              strokeLinecap="round"
            />
          </svg>
          {TEKS.P1_PINDAI}
        </button>
      </div>

      {pindai ? (
        <div className="overflow-hidden rounded-3xl border border-garis-halus bg-kertas p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <PemindaiQr petunjuk={TEKS.P1_PINDAI} onHasil={hasilPindai} />
        </div>
      ) : null}

      {galat ? <BannerGalat pesan={galat} /> : null}

      {masuk.keadaan.status === "siap" && semua.length > 0 ? (
        <div role="group" aria-label={TEKS.P1_JUDUL} className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { id: "semua", teks: TEKS.LIST_SEMUA, jumlah: semua.length },
              { id: "MENGGANTUNG", teks: TEKS.LIST_MENGGANTUNG, jumlah: jumlahGantung },
              { id: "DIANGKUT", teks: TEKS.LIST_DIANGKUT, jumlah: jumlahAngkut },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={saring === f.id}
              onClick={() => setSaring(f.id)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200 ${
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

      {masuk.keadaan.status === "memuat" ? <RangkaHalaman jumlah={2} /> : null}
      {masuk.keadaan.status === "galat" ? <BannerGalat pesan={masuk.keadaan.pesan} onCoba={() => void masuk.ulang()} /> : null}
      {masuk.keadaan.status === "siap" && semua.length === 0 ? <Kosong teks={TEKS.K_KOSONG_MASUK} /> : null}

      {masuk.keadaan.status === "siap" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tampil.map((s) => {
            const menggantung = s.status === "MENGGANTUNG";
            return (
              <Link key={s.kode} href={`/penerima/serah/${s.kode}`} className="group block">
                <article
                  data-kode={s.kode}
                  className={`muncul flex h-full flex-col gap-3 rounded-3xl border p-4 transition-all duration-300 group-hover:-translate-y-0.5 group-active:scale-[0.99] ${
                    menggantung
                      ? "border-peringatan-garis/40 bg-peringatan-latar/50 shadow-[0_8px_30px_rgba(146,64,14,0.10)] group-hover:shadow-[0_16px_40px_rgba(146,64,14,0.16)]"
                      : "border-garis-halus bg-kertas shadow-[0_8px_30px_rgba(15,23,42,0.05)] group-hover:border-aksi-garis group-hover:shadow-[0_16px_40px_rgba(36,87,197,0.12)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      aria-hidden="true"
                      className={`flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-semibold ${
                        menggantung ? "bg-peringatan-latar text-peringatan ring-1 ring-peringatan-garis/30" : "bg-aksi-latar text-aksi"
                      }`}
                    >
                      {menggantung ? "▲" : "→"}
                    </span>
                    <span className="inline-flex items-center text-aksi transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">
                      →
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-semibold tracking-tight text-tinta transition-colors group-hover:text-aksi">
                      {isi("P1_TUTUP_JUDUL", { kode_serah: s.kode })}
                    </p>
                    <p className="text-sm text-tinta-redup">{isi("P1_MUATAN", { nama_kawasan: s.kawasan.nama })}</p>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-garis-halus/70 pt-3">
                    <LencanaStatus status={s.status} />
                    {s.aliran.map((a) => (
                      <LencanaAliran key={a} aliran={a} pendek />
                    ))}
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
