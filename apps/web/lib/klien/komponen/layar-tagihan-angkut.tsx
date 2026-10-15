"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type { Kontrak, PratinjauTagihanAngkut, TagihanAngkut } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg } from "@/lib/klien/angka";
import { PilihPeriode } from "@/lib/klien/komponen/pilih-periode";
import { periodeSekarangWib, tanggalJamWib } from "@/lib/klien/periode";

type ItemKontrak = z.infer<typeof Kontrak>;
type TipePratinjau = z.infer<typeof PratinjauTagihanAngkut>;
type TipeTagihan = z.infer<typeof TagihanAngkut>;

const rupiah = (n: number) => `Rp${new Intl.NumberFormat("id-ID").format(n)}`;

export function LayarTagihanAngkut({ peran }: { peran: "PENGANGKUT" | "KAWASAN" }) {
  const [periode, setPeriode] = useState(periodeSekarangWib);
  const [kontrakList, setKontrakList] = useState<ItemKontrak[]>([]);
  const [kontrakId, setKontrakId] = useState<string>("");

  const [pratinjau, setPratinjau] = useState<TipePratinjau | null>(null);
  const [daftarTagihan, setDaftarTagihan] = useState<TipeTagihan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const [sedangTerbit, setSedangTerbit] = useState(false);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  // Muat daftar kontrak
  useEffect(() => {
    async function muatKontrak() {
      const res = await panggil("GET", "/api/kontrak", {});
      if (res.ok) {
        setKontrakList(res.data.kontrak);
        if (res.data.kontrak.length > 0) {
          setKontrakId(res.data.kontrak[0]!.id);
        }
      }
    }
    void muatKontrak();
  }, []);

  // Muat tagihan & pratinjau
  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);

    const kueri: { kontrakId?: string; periode?: string } = { periode };
    if (kontrakId) {
      kueri.kontrakId = kontrakId;
    }

    const res = await panggil("GET", "/api/tagihan-angkut", { kueri });
    setMemuat(false);
    if (res.ok) {
      setPratinjau(res.data.pratinjau);
      setDaftarTagihan(res.data.tagihan);
    } else {
      setGalat(res.pesan);
    }
  }, [kontrakId, periode]);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function handleTerbitkan() {
    if (!kontrakId) return;
    setSedangTerbit(true);
    setGalat(null);
    setPesanSukses(null);

    const res = await panggil("POST", "/api/tagihan-angkut/terbitkan", {
      body: { kontrakId, periode },
    });

    setSedangTerbit(false);
    if (res.ok) {
      setPesanSukses(res.data.tagihan.kode);
      void muat();
    } else {
      setGalat(res.pesan);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{TEKS.TGA_JUDUL}</h1>
      <p className="text-base text-tinta-redup">{TEKS.TGA_PENJELASAN}</p>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}

      {pesanSukses ? (
        <p role="status" className="rounded-kontrol bg-status-sukses/10 p-3 text-sm font-semibold text-status-sukses">
          {pesanSukses}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="pilih-kontrak" className="text-base font-semibold">
            {TEKS.KTR_JUDUL}
          </label>
          <select
            id="pilih-kontrak"
            value={kontrakId}
            onChange={(e) => setKontrakId(e.target.value)}
            className="min-h-12 rounded-kontrol border-2 border-garis bg-kertas px-3 text-base"
          >
            {kontrakList.length === 0 ? (
              <option value="">{TEKS.UMUM_MUAT}</option>
            ) : (
              kontrakList.map((k) => (
                <option key={k.id} value={k.id}>
                  {`${k.kawasan.nama} ↔ ${k.pengangkut.nama}`}
                </option>
              ))
            )}
          </select>
        </div>

        <PilihPeriode nilai={periode} onUbah={setPeriode} />
      </div>

      {memuat && !pratinjau ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {pratinjau ? (
        <Kartu className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{TEKS.TGA_JUDUL}</h2>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
            <dt className="font-semibold">{TEKS.TGA_RIT}</dt>
            <dd className="tabular-nums">{pratinjau.ritTertutup}</dd>

            <dt className="font-semibold">{TEKS.TGA_KG}</dt>
            <dd className="tabular-nums">
              {isi("UMUM_KG", { nilai: formatGramKeKg(pratinjau.kgDiterimaG) })}
            </dd>

            <dt className="font-semibold">{TEKS.TGA_TOTAL}</dt>
            <dd className="text-lg font-bold text-aksi tabular-nums">
              {rupiah(pratinjau.totalIdr)}
            </dd>
          </dl>

          <p className="text-sm text-tinta-redup">
            {isi("TGA_TIDAK_TERMASUK", { jumlah: pratinjau.tidakTermasuk })}
          </p>

          {peran === "PENGANGKUT" ? (
            <div className="flex justify-start pt-2">
              <Tombol onClick={() => void handleTerbitkan()} disabled={sedangTerbit || !kontrakId}>
                {TEKS.TGA_TERBITKAN}
              </Tombol>
            </div>
          ) : null}
        </Kartu>
      ) : null}

      {daftarTagihan.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="judul-daftar-tagihan">
          <h2 id="judul-daftar-tagihan" className="text-lg font-bold">
            {TEKS.TGA_JUDUL}
          </h2>
          <ul className="flex flex-col gap-3">
            {daftarTagihan.map((t) => (
              <li key={t.id}>
                <Kartu className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-bold">{t.kode}</span>
                    <span className="text-sm font-bold text-aksi">{rupiah(t.totalIdr)}</span>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="font-semibold">{TEKS.UMUM_PERIODE}</dt>
                    <dd>{t.periode}</dd>
                    <dt className="font-semibold">{TEKS.TGA_RIT}</dt>
                    <dd>{t.ritTertutup}</dd>
                    <dt className="font-semibold">{TEKS.TGA_KG}</dt>
                    <dd>{isi("UMUM_KG", { nilai: formatGramKeKg(t.kgDiterimaG) })}</dd>
                    <dt className="font-semibold">{TEKS.KOL_TANGGAL}</dt>
                    <dd>{tanggalJamWib(t.diterbitkanPada)}</dd>
                  </dl>
                </Kartu>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
