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
import { Pilih } from "./pilih";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-garis-halus pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">{TEKS.TGA_JUDUL}</h1>
          <p className="text-sm font-medium text-tinta-redup">{TEKS.TGA_PENJELASAN}</p>
        </div>
      </div>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}

      {pesanSukses ? (
        <div className="rounded-kartu border border-emerald-200 bg-emerald-50 p-4">
          <p role="status" className="text-sm font-bold text-emerald-800">
            {`✓ ${pesanSukses}`}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pilih-kontrak" className="text-sm font-semibold text-tinta">
            {TEKS.KTR_JUDUL}
          </label>
          <Pilih
            id="pilih-kontrak"
            value={kontrakId}
            onChange={(e) => setKontrakId(e.target.value)}
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
          </Pilih>
        </div>

        <PilihPeriode nilai={periode} onUbah={setPeriode} />
      </div>

      {memuat && !pratinjau ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {pratinjau ? (
        <Kartu className="flex flex-col gap-4 border-l-4 border-l-aksi shadow-xs">
          <h2 className="text-lg font-bold tracking-tight text-tinta">{TEKS.TGA_JUDUL}</h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-kontrol border border-garis-halus bg-latar/50 p-3">
              <span className="text-xs font-semibold text-tinta-redup">{TEKS.TGA_RIT}</span>
              <p className="text-2xl font-bold tracking-tight text-tinta tabular-nums">{pratinjau.ritTertutup}</p>
            </div>
            <div className="rounded-kontrol border border-garis-halus bg-latar/50 p-3">
              <span className="text-xs font-semibold text-tinta-redup">{TEKS.TGA_KG}</span>
              <p className="text-2xl font-bold tracking-tight text-tinta tabular-nums">
                {isi("UMUM_KG", { nilai: formatGramKeKg(pratinjau.kgDiterimaG) })}
              </p>
            </div>
            <div className="rounded-kontrol border border-aksi-garis bg-aksi-latar/50 p-3">
              <span className="text-xs font-semibold text-aksi">{TEKS.TGA_TOTAL}</span>
              <p className="text-2xl font-extrabold tracking-tight text-aksi tabular-nums">
                {rupiah(pratinjau.totalIdr)}
              </p>
            </div>
          </div>

          <p className="text-xs font-medium text-tinta-redup">
            {isi("TGA_TIDAK_TERMASUK", { jumlah: pratinjau.tidakTermasuk })}
          </p>

          {peran === "PENGANGKUT" ? (
            <div className="flex justify-start pt-1 border-t border-garis-halus/60">
              <Tombol onClick={() => void handleTerbitkan()} disabled={sedangTerbit || !kontrakId}>
                {TEKS.TGA_TERBITKAN}
              </Tombol>
            </div>
          ) : null}
        </Kartu>
      ) : null}

      {daftarTagihan.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="judul-daftar-tagihan">
          <h2 id="judul-daftar-tagihan" className="text-lg font-bold tracking-tight text-tinta">
            {TEKS.TGA_JUDUL}
          </h2>
          <ul className="flex flex-col gap-3">
            {daftarTagihan.map((t) => (
              <li key={t.id}>
                <Kartu className="flex flex-col gap-3 shadow-xs transition-shadow duration-150 hover:shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-garis-halus/60 pb-2">
                    <span className="font-mono text-base font-bold text-tinta">{t.kode}</span>
                    <span className="text-lg font-extrabold text-aksi tabular-nums">{rupiah(t.totalIdr)}</span>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs sm:text-sm">
                    <dt className="font-semibold text-tinta-redup">{TEKS.UMUM_PERIODE}</dt>
                    <dd className="font-medium text-tinta">{t.periode}</dd>
                    <dt className="font-semibold text-tinta-redup">{TEKS.TGA_RIT}</dt>
                    <dd className="font-mono font-bold text-tinta tabular-nums">{t.ritTertutup}</dd>
                    <dt className="font-semibold text-tinta-redup">{TEKS.TGA_KG}</dt>
                    <dd className="font-mono font-bold text-tinta tabular-nums">{isi("UMUM_KG", { nilai: formatGramKeKg(t.kgDiterimaG) })}</dd>
                    <dt className="font-semibold text-tinta-redup">{TEKS.KOL_TANGGAL}</dt>
                    <dd className="font-medium text-tinta-redup">{tanggalJamWib(t.diterbitkanPada)}</dd>
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
