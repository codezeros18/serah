"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, LencanaAliran, LencanaStatus } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { IkonNav, type NamaIkonNav } from "@/lib/klien/komponen/ikon-nav";
import { KonfirmasiAksi } from "@/lib/klien/komponen/konfirmasi-aksi";
import { GambarAman } from "@/lib/klien/komponen/gambar-aman";
import { useModalHasil } from "@/lib/klien/komponen/modal-hasil";
import { Rangka } from "@/lib/klien/komponen/rangka";
import { useMuat } from "@/lib/klien/muat";

function BarisInfo({ ikon, label, nilai, mono = false }: { ikon: NamaIkonNav; label: string; nilai: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-latar/70 p-3.5">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-aksi shadow-[0_1px_4px_rgba(15,23,42,0.08)]">
        <IkonNav nama={ikon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-tinta-redup">{label}</dt>
        <dd className={`truncate text-sm font-medium text-tinta ${mono ? "font-mono tracking-wider" : ""}`}>{nilai}</dd>
      </div>
    </div>
  );
}

function FotoMuatan({ url }: { url: string }) {
  return (
    <GambarAman
      src={url}
      alt={TEKS.A2_FOTO}
      teksKosong={TEKS.FOTO_TIDAK_ADA}
      className="max-h-80 w-full rounded-2xl bg-latar object-contain"
    />
  );
}

/** K2 — pengelola menyetujui atau mengembalikan serah (alasan wajib saat mengembalikan). */
export default function LayarK2() {
  const { kode } = useParams<{ kode: string }>();
  const { keadaan, ulang } = useMuat(() => panggil("GET", "/api/serah/[kode]", { params: { kode } }));
  const [kembalikan, setKembalikan] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<"disetujui" | "dikembalikan" | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [konfirmasiSetuju, setKonfirmasiSetuju] = useState(false);
  const { galat: tampilGalat, modal } = useModalHasil();

  async function setujui() {
    setSibuk(true);
    setGalat(null);
    const h = await panggil("POST", "/api/serah/[kode]/setujui", { params: { kode }, body: {}, idempotencyKey: crypto.randomUUID() });
    setSibuk(false);
    setKonfirmasiSetuju(false);
    if (h.ok) setHasil("disetujui");
    else if (h.galat.kode === "KONFLIK_VERSI") {
      tampilGalat(h.pesan);
      void ulang();
    } else tampilGalat(h.pesan, () => setKonfirmasiSetuju(true));
  }

  async function kirimKembalikan() {
    if (alasan.trim() === "") {
      setGalat(TEKS.UMUM_ALASAN_WAJIB);
      return;
    }
    setSibuk(true);
    setGalat(null);
    const h = await panggil("POST", "/api/serah/[kode]/kembalikan", {
      params: { kode },
      body: { alasan: alasan.trim() },
      idempotencyKey: crypto.randomUUID(),
    });
    setSibuk(false);
    if (h.ok) setHasil("dikembalikan");
    else tampilGalat(h.pesan, () => void kirimKembalikan());
  }

  const d = keadaan.status === "siap" ? keadaan.data : null;
  const muatanFoto = d?.foto.find((f) => f.jenis === "MUATAN");

  return (
    <div className="flex flex-col gap-5">
      {modal}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-garis-halus pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/kawasan/setujui"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-garis-halus bg-kertas px-3.5 text-sm font-medium text-tinta transition-all duration-200 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi active:scale-[0.98]"
          >
            ← {TEKS.UMUM_KEMBALI}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">{isi("K2_JUDUL", { kode_serah: kode })}</h1>
        </div>
      </div>

      {keadaan.status === "memuat" ? (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">{TEKS.UMUM_MUAT}</span>
          <Rangka className="h-40 w-full rounded-3xl" />
        </div>
      ) : null}
      {keadaan.status === "galat" ? <BannerGalat pesan={keadaan.pesan} onCoba={() => void ulang()} /> : null}

      {d ? (
        <section className="muncul flex flex-col gap-5 rounded-3xl border border-garis-halus bg-kertas p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <LencanaStatus status={d.status} />
            <div className="flex flex-wrap gap-2">
              {d.aliran.map((a) => (
                <LencanaAliran key={a} aliran={a} />
              ))}
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-3">
            <BarisInfo ikon="truk" label={TEKS.A2_KENDARAAN} nilai={d.kendaraan?.plat ?? "-"} mono />
            <BarisInfo ikon="kontrak" label={TEKS.A2_PENERIMA} nilai={d.penerima?.nama ?? "-"} />
            <BarisInfo ikon="akun" label={TEKS.KOL_PENGANGKUT} nilai={d.pengangkut?.nama ?? "-"} />
          </dl>

          {muatanFoto ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-tinta-redup">{TEKS.A2_FOTO}</span>
              <FotoMuatan url={muatanFoto.url} />
            </div>
          ) : null}
        </section>
      ) : null}

      {galat ? <BannerGalat pesan={galat} /> : null}

      {hasil === "disetujui" ? (
        <div className="rounded-kartu border border-status-selesai/30 bg-status-selesai-latar p-5 text-center">
          <p role="status" className="text-lg font-bold text-status-selesai">
            {`✓ ${isi("K2_DISETUJUI", { kode_serah: kode })}`}
          </p>
        </div>
      ) : null}
      {hasil === "dikembalikan" ? (
        <div className="rounded-kartu border border-status-tolak/30 bg-status-tolak-latar p-5 text-center">
          <p role="status" className="text-lg font-bold text-status-tolak">
            {TEKS.K2_KEMBALIKAN}
          </p>
        </div>
      ) : null}

      {d && hasil === null ? (
        <section className="muncul flex flex-col gap-5 rounded-3xl border border-garis-halus bg-kertas p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aksi-latar text-aksi">
              <IkonNav nama="perisai" className="h-5 w-5" />
            </span>
            <p className="pt-1 text-sm leading-relaxed text-tinta-redup">{TEKS.K2_PENJELASAN}</p>
          </div>
          {d.status !== "MENUNGGU_SETUJU" ? null : (
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setKonfirmasiSetuju(true)}
                  disabled={sibuk}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-aksi text-base font-semibold text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover active:translate-y-0 active:scale-[0.99] disabled:opacity-60"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
                    <path d="m5 12.500 4.500 4.500L19 7" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {TEKS.K2_SETUJUI}
                </button>
                {!kembalikan ? (
                  <button
                    type="button"
                    onClick={() => setKembalikan(true)}
                    className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-garis-halus bg-kertas text-base font-medium text-tinta transition-all duration-200 hover:-translate-y-0.5 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
                  >
                    {TEKS.K2_KEMBALIKAN}
                  </button>
                ) : null}
              </div>
              {kembalikan ? (
                <div className="flex flex-col gap-3 rounded-2xl bg-latar/70 p-4">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="alasan" className="text-sm font-medium text-tinta">
                      {TEKS.UMUM_ALASAN}
                    </label>
                    <p className="text-xs text-tinta-redup">{TEKS.K2_KEMBALIKAN_PETUNJUK}</p>
                  </div>
                  <textarea
                    id="alasan"
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    rows={3}
                    className="min-h-24 rounded-2xl border border-garis-halus bg-kertas p-3 text-sm text-tinta transition-all hover:border-garis focus:border-aksi focus:outline-none focus:ring-4 focus:ring-aksi/15"
                  />
                  <button
                    type="button"
                    onClick={() => void kirimKembalikan()}
                    disabled={sibuk}
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-tinta text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-60"
                  >
                    {TEKS.K2_KEMBALIKAN}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
      <KonfirmasiAksi
        terbuka={konfirmasiSetuju}
        judul={TEKS.K2_SETUJUI}
        labelKonfirmasi={TEKS.UMUM_KONFIRMASI}
        sibuk={sibuk}
        onKonfirmasi={() => void setujui()}
        onTutup={() => setKonfirmasiSetuju(false)}
      >
        <p className="font-mono text-base font-semibold text-tinta">{kode}</p>
        <p className="mt-1 text-xs text-tinta-redup">{TEKS.KONF_SETUJUI}</p>
      </KonfirmasiAksi>
    </div>
  );
}
