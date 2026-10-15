"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type { Aliran } from "@serah/kontrak/enum";
import type { BayanganPerbandinganKeluaran } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, LencanaAliran, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg, parseBeratKgKeGram } from "@/lib/klien/angka";
import { useKawasanSaya } from "@/lib/klien/kawasan-saya";
import { PilihPeriode } from "@/lib/klien/komponen/pilih-periode";
import { periodeSekarangWib } from "@/lib/klien/periode";
import { Pilih } from "./pilih";

type Perbandingan = z.infer<typeof BayanganPerbandinganKeluaran>;
type BarisPerbandingan = Perbandingan["baris"][number];

const DAFTAR_ALIRAN: Aliran[] = ["HIJAU", "KUNING", "MERAH", "ABU"];

export function LayarModeBayangan() {
  const { kawasan, galat: galatKawasan } = useKawasanSaya();
  const [periode, setPeriode] = useState(periodeSekarangWib);

  const [dataPerbandingan, setDataPerbandingan] = useState<Perbandingan | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  // Form tambah angka catatan lama
  const [sumberCatatan, setSumberCatatan] = useState("");
  const [beratKgTeks, setBeratKgTeks] = useState("");
  const [aliran, setAliran] = useState<Aliran>("KUNING");
  const [sedangKirim, setSedangKirim] = useState(false);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!kawasan) return;
    setMemuat(true);
    setGalat(null);

    const res = await panggil("GET", "/api/bayangan/perbandingan", {
      kueri: { kawasanId: kawasan.id, periode },
    });

    setMemuat(false);
    if (res.ok) {
      setDataPerbandingan(res.data);
    } else {
      setGalat(res.pesan);
    }
  }, [kawasan, periode]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const beratG = parseBeratKgKeGram(beratKgTeks);
  const formValid = sumberCatatan.trim().length >= 2 && beratG !== null && beratG > 0;

  async function handleTambah() {
    if (!kawasan || !formValid || beratG === null) return;
    setSedangKirim(true);
    setGalat(null);
    setPesanSukses(null);

    const res = await panggil("POST", "/api/bayangan", {
      body: {
        kawasanId: kawasan.id,
        periode,
        aliran,
        beratG,
        sumberCatatan: sumberCatatan.trim(),
      },
    });

    setSedangKirim(false);
    if (res.ok) {
      setPesanSukses(TEKS.UMUM_SIMPAN);
      setSumberCatatan("");
      setBeratKgTeks("");
      void muat();
    } else {
      setGalat(res.pesan);
    }
  }

  function teksSelisih(baris: BarisPerbandingan): string {
    if (baris.selisihG > 0) {
      return isi("BYG_LEBIH", { nilai: formatGramKeKg(baris.selisihG) });
    }
    if (baris.selisihG < 0) {
      return isi("BYG_KURANG", { nilai: formatGramKeKg(-baris.selisihG) });
    }
    return TEKS.BYG_SAMA;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-garis-halus pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">{TEKS.BYG_JUDUL}</h1>
          <p className="text-sm font-medium text-tinta-redup">{TEKS.BYG_PENJELASAN}</p>
        </div>
      </div>

      {galatKawasan ? <BannerGalat pesan={galatKawasan} /> : null}
      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}

      <div className="max-w-xs">
        <PilihPeriode nilai={periode} onUbah={setPeriode} />
      </div>

      <Kartu className="flex flex-col gap-4 shadow-xs">
        <h2 className="text-lg font-bold tracking-tight text-tinta">{TEKS.BYG_TAMBAH}</h2>

        {pesanSukses ? (
          <div className="rounded-kartu border border-emerald-200 bg-emerald-50 p-3">
            <p role="status" className="text-sm font-bold text-emerald-800">
              {`✓ ${pesanSukses}`}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="byg-sumber" className="text-sm font-semibold text-tinta">
            {TEKS.BYG_SUMBER}
          </label>
          <input
            id="byg-sumber"
            type="text"
            value={sumberCatatan}
            onChange={(e) => setSumberCatatan(e.target.value)}
            placeholder="Buku catatan TPS"
            className="min-h-12 rounded-kontrol border border-garis-halus bg-kertas px-3 text-base text-tinta transition-colors focus:border-aksi focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="byg-aliran" className="text-sm font-semibold text-tinta">
              {TEKS.KOL_ALIRAN}
            </label>
            <Pilih
              id="byg-aliran"
              value={aliran}
              onChange={(e) => setAliran(e.target.value as Aliran)}
            >
              {DAFTAR_ALIRAN.map((a) => (
                <option key={a} value={a}>
                  {TEKS[`ALIRAN_${a}`]}
                </option>
              ))}
            </Pilih>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="byg-berat" className="text-sm font-semibold text-tinta">
              {isi("UMUM_KG", { nilai: "" }).trim()}
            </label>
            <input
              id="byg-berat"
              type="text"
              inputMode="decimal"
              placeholder="42,5"
              value={beratKgTeks}
              onChange={(e) => setBeratKgTeks(e.target.value)}
              className="min-h-12 rounded-kontrol border border-garis-halus bg-kertas px-3 text-base text-tinta transition-colors focus:border-aksi focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-start pt-2">
          <Tombol onClick={() => void handleTambah()} disabled={!formValid || sedangKirim}>
            {TEKS.BYG_TAMBAH}
          </Tombol>
        </div>
      </Kartu>

      <section className="flex flex-col gap-3" aria-labelledby="judul-perbandingan">
        <h2 id="judul-perbandingan" className="text-lg font-bold tracking-tight text-tinta">
          {TEKS.BYG_SELISIH}
        </h2>

        {memuat && !dataPerbandingan ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

        {dataPerbandingan ? (
          <div className="overflow-x-auto rounded-kartu border border-garis-halus bg-kertas shadow-xs">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">{TEKS.BYG_SELISIH}</caption>
              <thead>
                <tr className="border-b-2 border-garis-halus bg-latar text-xs font-bold uppercase tracking-wider text-tinta">
                  <th scope="col" className="px-4 py-3">{TEKS.KOL_ALIRAN}</th>
                  <th scope="col" className="px-4 py-3 text-right">{TEKS.APP_NAMA}</th>
                  <th scope="col" className="px-4 py-3 text-right">{TEKS.BYG_SUMBER}</th>
                  <th scope="col" className="px-4 py-3">{TEKS.BYG_SELISIH}</th>
                </tr>
              </thead>
              <tbody>
                {dataPerbandingan.baris.map((b) => (
                  <tr key={b.aliran} className="border-b border-garis-halus last:border-0 hover:bg-aksi-latar/40 transition-colors">
                    <td className="px-4 py-3">
                      <LencanaAliran aliran={b.aliran} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-tinta">
                      {isi("UMUM_KG", { nilai: formatGramKeKg(b.serahG) })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-tinta">
                      {isi("UMUM_KG", { nilai: formatGramKeKg(b.bayanganG) })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-tinta" data-testid={`selisih-${b.aliran}`}>
                      {teksSelisih(b)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
