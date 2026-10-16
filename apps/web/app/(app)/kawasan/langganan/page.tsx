"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type { LanggananKeluaran, TagihanDaftarKeluaran } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { IkonLanding } from "@/lib/klien/komponen/ikon-landing";
import { IkonNav } from "@/lib/klien/komponen/ikon-nav";
import { useModalHasil } from "@/lib/klien/komponen/modal-hasil";
import { RangkaHalaman } from "@/lib/klien/komponen/rangka";

type Langganan = z.infer<typeof LanggananKeluaran>;
type ItemTagihan = z.infer<typeof TagihanDaftarKeluaran>["tagihan"][number];

export default function HalamanLangganan() {
  const [langganan, setLangganan] = useState<Langganan | null>(null);
  const [daftarTagihan, setDaftarTagihan] = useState<ItemTagihan[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  // State transfer manual
  const [tagihanTransfer, setTagihanTransfer] = useState<string | null>(null);
  const [sedangUnggah, setSedangUnggah] = useState(false);
  const [berkasDipilih, setBerkasDipilih] = useState<File | null>(null);
  const [tersalin, setTersalin] = useState(false);
  const { sukses, galat: tampilGalat, modal } = useModalHasil();

  // State Modal Sandbox (S20-2)
  const [infoStatus, setInfoStatus] = useState<string | null>(null);
  const [modalBayar, setModalBayar] = useState<{ nomor: string; token: string; url: string } | null>(null);

  const muat = useCallback(async () => {
    setSedangMuat(true);
    setGalat(null);

    const [resLgn, resTgh] = await Promise.all([
      panggil("GET", "/api/langganan"),
      panggil("GET", "/api/tagihan"),
    ]);

    setSedangMuat(false);

    if (resLgn.ok) {
      setLangganan(resLgn.data);
    } else {
      setGalat(resLgn.pesan);
    }

    if (resTgh.ok) {
      setDaftarTagihan(resTgh.data.tagihan);
    } else if (resLgn.ok) {
      setGalat(resTgh.pesan);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function periksaStatus(nomor: string) {
    setInfoStatus(null);
    const res = await panggil("GET", "/api/tagihan/[nomor]/status", { params: { nomor } });
    if (!res.ok) {
      setInfoStatus(res.pesan);
      return;
    }
    await muat();
    if (res.data.tagihan.status === "LUNAS") setModalBayar(null);
    else setInfoStatus(TEKS.TGH_BELUM_LUNAS);
  }

  async function bayarOnline(nomor: string) {
    setGalat(null);
    setInfoStatus(null);
    const res = await panggil("POST", "/api/tagihan/[nomor]/bayar", {
      params: { nomor },
    });

    if (res.ok) {
      setModalBayar({
        nomor,
        token: res.data.snapToken,
        url: res.data.redirectUrl,
      });
    } else {
      tampilGalat(res.pesan, () => void bayarOnline(nomor));
    }
  }

  async function kirimBuktiTransfer(nomor: string) {
    setSedangUnggah(true);
    setGalat(null);

    const res = await panggil("POST", "/api/tagihan/[nomor]/transfer", {
      params: { nomor },
      body: { fotoBuktiId: "fto-bukti-transfer-mock" },
    });

    setSedangUnggah(false);

    if (res.ok) {
      setTagihanTransfer(null);
      setBerkasDipilih(null);
      setDaftarTagihan((prev) =>
        prev.map((t) => (t.nomor === nomor ? { ...t, status: "MENUNGGU_KONFIRMASI" } : t)),
      );
      sukses(TEKS.TGH_MENUNGGU_KONFIRMASI);
    } else {
      tampilGalat(res.pesan, () => void kirimBuktiTransfer(nomor));
    }
  }

  function teksStatusLangganan(lgn: Langganan): string {
    switch (lgn.status) {
      case "UJI_COBA":
        return isi("LGN_STATUS_UJI_COBA", { tanggal: lgn.ujiCobaSelesai ?? "" });
      case "AKTIF":
        return TEKS.LGN_STATUS_AKTIF;
      case "MENUNGGAK":
        return TEKS.LGN_STATUS_MENUNGGAK;
      case "BERAKHIR":
        return TEKS.LGN_STATUS_BERAKHIR;
      default:
        return lgn.status;
    }
  }

  const ikonStatus: Record<string, string> = {
    UJI_COBA: "bg-aksi-latar text-aksi ring-aksi/20",
    AKTIF: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    MENUNGGAK: "bg-amber-50 text-amber-700 ring-amber-500/25",
    BERAKHIR: "bg-slate-100 text-slate-600 ring-slate-500/20",
  };

  async function salinRekening() {
    try {
      await navigator.clipboard.writeText("1230098765432");
      setTersalin(true);
      setTimeout(() => setTersalin(false), 1800);
    } catch {
      setTersalin(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS.LGN_JUDUL}</h1>
      {modal}

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {sedangMuat ? <RangkaHalaman jumlah={2} /> : null}

      {langganan ? (
        <section className="muncul flex flex-col gap-5 rounded-3xl border border-white/70 bg-gradient-to-br from-white via-white to-aksi-latar/60 p-5 shadow-[0_12px_40px_rgba(36,87,197,0.08)] ring-1 ring-garis-halus/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-[0_2px_10px_rgba(15,23,42,0.08)]">
                <IkonLanding nama="aturan" className="h-6 w-6" />
              </span>
              <span className="text-sm font-medium text-tinta-redup">{TEKS.KOL_STATUS}</span>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${ikonStatus[langganan.status] ?? ikonStatus.AKTIF}`}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              {teksStatusLangganan(langganan)}
            </span>
          </div>

          <p className="text-2xl font-semibold tracking-tight text-tinta tabular-nums">
            {isi("LGN_TPS_DITAGIH", {
              jumlah: langganan.tpsDitagih,
              harga: new Intl.NumberFormat("id-ID").format(langganan.hargaDibekukanPerTpsIdr ?? 350_000),
            })}
          </p>
        </section>
      ) : null}

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-tinta">{TEKS.TGH_JUDUL}</h2>

        {!sedangMuat && daftarTagihan.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-garis-halus bg-latar/50 px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_2px_10px_rgba(15,23,42,0.06)] text-garis">
              <IkonNav nama="laporan" className="h-7 w-7" />
            </span>
            <p className="text-sm text-tinta-redup">{TEKS.K_KOSONG_BULAN}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          {daftarTagihan.map((t) => {
            const jatuhTempo = isi("TGH_JATUH_TEMPO", { tanggal: t.jatuhTempo });
            const total = `Rp${new Intl.NumberFormat("id-ID").format(t.totalIdr)}`;
            const adalahTransferTerbuka = tagihanTransfer === t.nomor;

            return (
              <article
                key={t.id}
                className="muncul flex flex-col gap-5 rounded-3xl border border-garis-halus bg-kertas p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-latar text-tinta-redup">
                      <IkonNav nama="laporan" className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs text-tinta-redup">{TEKS.TGH_NOMOR}</p>
                      <p className="font-mono text-sm font-semibold tracking-wide text-tinta">{t.nomor}</p>
                      <p className="text-xs text-tinta-redup">{t.periode}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tracking-tight text-tinta tabular-nums">{total}</p>
                    <p className="text-xs text-tinta-redup">{jatuhTempo}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-garis-halus/70 pt-4">
                  {t.status === "LUNAS" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      <span aria-hidden="true">✓</span>
                      {TEKS.TGH_LUNAS}
                    </span>
                  ) : t.status === "MENUNGGU_KONFIRMASI" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-500/25">
                      <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      {TEKS.TGH_MENUNGGU_KONFIRMASI}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-aksi-latar px-3 py-1 text-xs font-semibold text-aksi ring-1 ring-inset ring-aksi/20">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                      {t.status === "TERBIT" ? "Terbit" : t.status}
                    </span>
                  )}

                  {t.status === "TERBIT" ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void bayarOnline(t.nomor)}
                        className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-aksi px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover active:translate-y-0 active:scale-[0.98]"
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                          <rect x="3" y="6" width="18" height="12.500" rx="3" stroke="currentColor" strokeWidth="1.900" />
                          <path d="M3 10.500h18M7 15h3" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" />
                        </svg>
                        {TEKS.TGH_BAYAR_ONLINE}
                      </button>
                      <button
                        type="button"
                        aria-label={TEKS.TGH_TRANSFER}
                        title={TEKS.TGH_TRANSFER}
                        aria-expanded={adalahTransferTerbuka}
                        onClick={() => setTagihanTransfer(adalahTransferTerbuka ? null : t.nomor)}
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 active:scale-95 ${
                          adalahTransferTerbuka ? "bg-tinta text-white" : "border border-garis-halus bg-kertas text-tinta hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                          <path d="M3.500 10 12 4.500 20.500 10M5.500 10v7.500M10 10v7.500M14 10v7.500M18.500 10v7.500M3.500 20h17" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  ) : null}
                </div>

                {adalahTransferTerbuka ? (
                  <div className="dropdown-masuk flex flex-col gap-4 rounded-3xl bg-latar/70 p-4 ring-1 ring-garis-halus/70">
                    <p className="text-sm leading-relaxed text-tinta-redup">{TEKS.TGH_TRANSFER_PETUNJUK}</p>

                    <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.05)] ring-1 ring-garis-halus/70">
                      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aksi-latar text-aksi">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                          <path d="M3.500 10 12 4.500 20.500 10M5.500 10v7.500M10 10v7.500M14 10v7.500M18.500 10v7.500M3.500 20h17" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-tinta">Bank Mandiri</p>
                        <p className="font-mono text-base font-semibold tracking-wide text-aksi">123-00-9876543-2</p>
                        <p className="truncate text-xs text-tinta-redup">a.n. PT SERAH LESTARI INDONESIA</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void salinRekening()}
                        aria-label={tersalin ? TEKS.UMUM_TERSIMPAN : "Salin nomor rekening"}
                        title="Salin nomor rekening"
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95 ${
                          tersalin ? "bg-emerald-50 text-emerald-600" : "bg-latar text-tinta-redup hover:bg-aksi-latar hover:text-aksi"
                        }`}
                      >
                        {tersalin ? "✓" : "⧉"}
                      </button>
                    </div>

                    <label
                      htmlFor={`bukti-${t.nomor}`}
                      className={`group flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-4 transition-all duration-200 hover:border-aksi-garis hover:bg-aksi-latar/40 ${
                        berkasDipilih ? "border-emerald-300 bg-emerald-50/50" : "border-garis-halus bg-white"
                      }`}
                    >
                      <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${berkasDipilih ? "bg-emerald-100 text-emerald-600" : "bg-latar text-tinta-redup group-hover:bg-white group-hover:text-aksi"}`}>
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                          <path d="M12 16V5m0 0-4 4m4-4 4 4M5 15v3.500A1.500 1.500 0 0 0 6.500 20h11a1.500 1.500 0 0 0 1.500-1.500V15" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-tinta">{berkasDipilih ? berkasDipilih.name : "Foto bukti transfer"}</span>
                        <span className="block text-xs text-tinta-redup">{berkasDipilih ? `${Math.max(1, Math.round(berkasDipilih.size / 1024))} KB` : "PNG / JPG"}</span>
                      </span>
                      <input
                        id={`bukti-${t.nomor}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => setBerkasDipilih(e.target.files?.[0] ?? null)}
                        className="sr-only"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => void kirimBuktiTransfer(t.nomor)}
                      disabled={sedangUnggah || !berkasDipilih}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-aksi px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0"
                    >
                      {sedangUnggah ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
                      {TEKS.TGH_UNGGAH_BUKTI}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      {/* Sandbox pembayaran (S20-2) */}
      {modalBayar ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="judul-modal-bayar"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-tinta/40 p-4 backdrop-blur-sm"
        >
          <div className="dropdown-masuk relative flex w-full max-w-sm flex-col items-center gap-5 rounded-[2rem] bg-kertas px-6 pb-6 pt-9 text-center shadow-[0_30px_90px_rgba(15,23,42,0.30)]">
            <button
              type="button"
              onClick={() => setModalBayar(null)}
              aria-label={TEKS.UMUM_TUTUP}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-latar text-tinta-redup transition-colors hover:bg-aksi-latar hover:text-aksi active:scale-95"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <span aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full bg-aksi-latar text-aksi">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none">
                <rect x="3" y="6" width="18" height="12.500" rx="3" stroke="currentColor" strokeWidth="1.800" />
                <path d="M3 10.500h18M7 15h3" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" />
              </svg>
            </span>
            <h3 id="judul-modal-bayar" className="text-xl font-semibold tracking-tight text-tinta">
              {TEKS.TGH_BAYAR_ONLINE}
            </h3>
            <p className="rounded-2xl bg-amber-50 p-3.5 text-sm font-medium leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-500/25">
              {TEKS.TGH_SANDBOX}
            </p>
            <p className="text-sm text-tinta-redup">{TEKS.TGH_LANJUT_PETUNJUK}</p>
            <p className="font-mono text-xs text-tinta-redup">{modalBayar.nomor}</p>
            {infoStatus ? <p role="status" className="rounded-xl bg-latar px-3 py-2 text-sm font-medium text-tinta">{infoStatus}</p> : null}

            <div className="grid w-full gap-2">
              <a
                href={modalBayar.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-aksi text-sm font-semibold text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all hover:-translate-y-0.5 hover:bg-aksi-hover"
              >
                {TEKS.TGH_LANJUT_BAYAR}
              </a>
              <button
                type="button"
                onClick={() => void periksaStatus(modalBayar.nomor)}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-garis-halus bg-kertas text-sm font-medium text-tinta transition-all hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
              >
                {TEKS.TGH_PERIKSA_STATUS}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
