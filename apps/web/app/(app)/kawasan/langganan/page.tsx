"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type { LanggananKeluaran, TagihanDaftarKeluaran } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Kosong, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";

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
      setGalat(res.pesan);
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
    } else {
      setGalat(res.pesan);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-garis-halus pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">{TEKS.LGN_JUDUL}</h1>
        </div>
      </div>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {sedangMuat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {langganan ? (
        <Kartu className="flex flex-col gap-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-tinta-redup">{TEKS.KOL_STATUS}</span>
            <span className="rounded-full border border-aksi-garis bg-aksi-latar px-3 py-0.5 text-xs font-bold text-aksi">
              {teksStatusLangganan(langganan)}
            </span>
          </div>

          <div className="border-t border-garis-halus/60 pt-3">
            <p className="text-base font-semibold text-tinta tabular-nums">
              {isi("LGN_TPS_DITAGIH", {
                jumlah: langganan.tpsDitagih,
                harga: new Intl.NumberFormat("id-ID").format(
                  langganan.hargaDibekukanPerTpsIdr ?? 350_000,
                ),
              })}
            </p>
          </div>
        </Kartu>
      ) : null}

      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight text-tinta">{TEKS.TGH_JUDUL}</h2>

        {!sedangMuat && daftarTagihan.length === 0 ? (
          <Kosong teks={TEKS.K_KOSONG_BULAN} />
        ) : null}

        <div className="flex flex-col gap-4">
          {daftarTagihan.map((t) => {
            const jatuhTempo = isi("TGH_JATUH_TEMPO", { tanggal: t.jatuhTempo });
            const total = `Rp${new Intl.NumberFormat("id-ID").format(t.totalIdr)}`;
            const adalahTransferTerbuka = tagihanTransfer === t.nomor;

            return (
              <Kartu
                key={t.id}
                className="flex flex-col gap-4 shadow-xs transition-shadow duration-150 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-tinta-redup">
                      {TEKS.TGH_NOMOR}
                    </p>
                    <p className="font-mono text-base font-bold text-tinta">{t.nomor}</p>
                    <p className="text-xs font-medium text-tinta-redup">{t.periode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-extrabold text-tinta tabular-nums">{total}</p>
                    <p className="text-xs font-medium text-tinta-redup">{jatuhTempo}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-garis-halus/60 pt-3">
                  <div>
                    {t.status === "LUNAS" ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5 text-xs font-bold text-emerald-800">
                        {TEKS.TGH_LUNAS}
                      </span>
                    ) : t.status === "MENUNGGU_KONFIRMASI" ? (
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-0.5 text-xs font-bold text-amber-800">
                        {TEKS.TGH_MENUNGGU_KONFIRMASI}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-status-menunggu-garis bg-status-menunggu-latar px-3 py-0.5 text-xs font-bold text-status-menunggu">
                        {t.status}
                      </span>
                    )}
                  </div>

                  {t.status === "TERBIT" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Tombol onClick={() => void bayarOnline(t.nomor)}>
                        {TEKS.TGH_BAYAR_ONLINE}
                      </Tombol>
                      <Tombol
                        varian="sekunder"
                        onClick={() =>
                          setTagihanTransfer(adalahTransferTerbuka ? null : t.nomor)
                        }
                      >
                        {TEKS.TGH_TRANSFER}
                      </Tombol>
                    </div>
                  ) : null}
                </div>

                {adalahTransferTerbuka ? (
                  <div className="flex flex-col gap-3 rounded-kontrol border border-garis-halus bg-latar/50 p-4">
                    <p className="text-sm font-medium text-tinta">{TEKS.TGH_TRANSFER_PETUNJUK}</p>
                    <div className="rounded-kontrol border border-garis-halus bg-kertas p-3 text-sm shadow-2xs">
                      <p className="font-bold text-tinta">Bank Mandiri</p>
                      <p className="font-mono text-base font-bold text-aksi">123-00-9876543-2</p>
                      <p className="text-xs text-tinta-redup">a.n. PT SERAH LESTARI INDONESIA</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`bukti-${t.nomor}`} className="text-xs font-semibold text-tinta">
                        Foto bukti transfer
                      </label>
                      <input
                        id={`bukti-${t.nomor}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => setBerkasDipilih(e.target.files?.[0] ?? null)}
                        className="text-sm text-tinta file:mr-3 file:rounded-kontrol file:border file:border-garis-halus file:bg-kertas file:px-3 file:py-1 file:text-xs file:font-semibold file:text-tinta hover:file:bg-latar"
                      />
                    </div>

                    <div className="pt-1">
                      <Tombol
                        onClick={() => void kirimBuktiTransfer(t.nomor)}
                        disabled={sedangUnggah || !berkasDipilih}
                      >
                        {TEKS.TGH_UNGGAH_BUKTI}
                      </Tombol>
                    </div>
                  </div>
                ) : null}
              </Kartu>
            );
          })}
        </div>
      </div>

      {/* Sandbox Modal (S20-2) */}
      {modalBayar ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="judul-modal-bayar"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="flex max-w-lg flex-col gap-4 rounded-kartu border-2 border-garis bg-kertas p-6 shadow-xl">
            <h3 id="judul-modal-bayar" className="text-xl font-bold text-tinta">
              {TEKS.TGH_BAYAR_ONLINE}
            </h3>

            <div className="rounded-kontrol border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              {TEKS.TGH_SANDBOX}
            </div>

            <p className="text-sm text-tinta-redup">{TEKS.TGH_LANJUT_PETUNJUK}</p>
            <p className="font-mono text-xs text-tinta-redup">{modalBayar.nomor}</p>
            {infoStatus ? <p role="status" className="text-sm font-medium text-tinta">{infoStatus}</p> : null}

            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-garis-halus">
              <a
                href={modalBayar.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-kontrol bg-aksi px-5 text-base font-semibold text-white transition hover:opacity-90"
              >
                {TEKS.TGH_LANJUT_BAYAR}
              </a>
              <Tombol varian="sekunder" onClick={() => void periksaStatus(modalBayar.nomor)}>
                {TEKS.TGH_PERIKSA_STATUS}
              </Tombol>
              <Tombol
                varian="sekunder"
                onClick={() => setModalBayar(null)}
              >
                {TEKS.UMUM_TUTUP}
              </Tombol>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
