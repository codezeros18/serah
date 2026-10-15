"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Tps } from "@serah/kontrak";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Dialog, Kartu, Tombol } from "@serah/ui";
import { formatE6, parseKoordinat } from "@/lib/klien/angka";
import { panggil } from "@/lib/klien/api";
import { useKawasanSaya } from "@/lib/klien/kawasan-saya";

export default function HalamanTps() {
  const { kawasan, galat: galatKawasan } = useKawasanSaya();
  const [daftarTps, setDaftarTps] = useState<Tps[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const [nama, setNama] = useState("");
  const [latTeks, setLatTeks] = useState("");
  const [lonTeks, setLonTeks] = useState("");
  const [sedangSimpan, setSedangSimpan] = useState(false);

  const [tpsQrBaru, setTpsQrBaru] = useState<Tps | null>(null);
  const [sedangQrBaru, setSedangQrBaru] = useState(false);

  const muat = useCallback(async () => {
    if (!kawasan) return;
    setSedangMuat(true);
    setGalat(null);
    const r = await panggil("GET", "/api/tps", { kueri: { kawasanId: kawasan.id } });
    setSedangMuat(false);
    if (r.ok) {
      setDaftarTps(r.data.tps);
    } else {
      setGalat(r.pesan);
    }
  }, [kawasan]);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function tanganiTambah(e: FormEvent) {
    e.preventDefault();
    if (!kawasan) return;

    const latE6 = parseKoordinat(latTeks, "lat");
    const lonE6 = parseKoordinat(lonTeks, "lon");
    if (latE6 === null || lonE6 === null) {
      setGalat(TEKS.TPS_KOORDINAT_PETUNJUK);
      return;
    }

    setSedangSimpan(true);
    setGalat(null);
    const res = await panggil("POST", "/api/tps", {
      body: {
        kawasanId: kawasan.id,
        nama,
        latE6,
        lonE6,
      },
    });
    setSedangSimpan(false);

    if (res.ok) {
      setTambahTerbuka(false);
      setNama("");
      setLatTeks("");
      setLonTeks("");
      await muat();
    } else {
      setGalat(res.pesan);
    }
  }

  async function tanganiQrBaru() {
    if (!tpsQrBaru) return;
    setSedangQrBaru(true);
    setGalat(null);
    const res = await panggil("POST", "/api/tps/[id]/qr-baru", {
      params: { id: tpsQrBaru.id },
      body: {},
    });
    setSedangQrBaru(false);

    if (res.ok) {
      setTpsQrBaru(null);
      await muat();
    } else {
      setGalat(res.pesan);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{TEKS.TPS_JUDUL}</h1>
          {kawasan ? <p className="text-sm text-tinta-redup">{kawasan.nama}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/kawasan/tps/cetak"
            className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-kontrol border-2 border-garis bg-kertas px-5 text-base font-semibold text-tinta"
          >
            {TEKS.TPS_CETAK_QR}
          </Link>
          <Tombol onClick={() => setTambahTerbuka(true)}>{TEKS.TPS_TAMBAH}</Tombol>
        </div>
      </div>

      {galatKawasan ? <BannerGalat pesan={galatKawasan} /> : null}
      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {sedangMuat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {!sedangMuat && daftarTps.length === 0 ? (
        <Kartu className="flex flex-col items-center gap-3 p-8 text-center text-tinta-redup">
          <p>{TEKS.K_KOSONG_TPS}</p>
        </Kartu>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {daftarTps.map((tps) => (
          <Kartu key={tps.id} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{tps.nama}</h2>
                <p className="font-mono text-sm text-tinta-redup">{tps.kode}</p>
              </div>
              <span className="rounded-full border border-garis px-3 py-1 text-xs font-semibold">
                {tps.aktif ? TEKS.LGN_STATUS_AKTIF : TEKS.KND_NONAKTIF}
              </span>
            </div>

            <div className="text-sm">
              <span className="text-tinta-redup">{TEKS.TPS_KOORDINAT}: </span>
              <span className="font-mono">
                {formatE6(tps.latE6)}, {formatE6(tps.lonE6)}
              </span>
            </div>

            <div className="flex items-center justify-center rounded-kontrol border border-garis-halus bg-white p-4">
              <img
                src={`/api/tps/${tps.id}/qr?format=svg&v=${tps.qrVersi}`}
                alt={`${tps.nama} - ${tps.kode}`}
                className="h-40 w-40"
              />
            </div>

            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <Link
                href={`/kawasan/tps/cetak?id=${tps.id}`}
                className="inline-flex min-h-12 min-w-12 flex-1 items-center justify-center gap-2 rounded-kontrol border-2 border-garis bg-kertas px-4 text-center text-sm font-semibold text-tinta"
              >
                {TEKS.TPS_CETAK_QR}
              </Link>
              <Tombol
                varian="sekunder"
                className="flex-1 text-sm"
                onClick={() => setTpsQrBaru(tps)}
              >
                {TEKS.TPS_QR_BARU}
              </Tombol>
            </div>
          </Kartu>
        ))}
      </div>

      <Dialog
        terbuka={tambahTerbuka}
        judul={TEKS.TPS_TAMBAH}
        onTutup={() => setTambahTerbuka(false)}
      >
        <form onSubmit={tanganiTambah} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {TEKS.TPS_NAMA}
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 text-base text-tinta"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{TEKS.TPS_KOORDINAT}</span>
            <p className="text-xs text-tinta-redup">{TEKS.TPS_KOORDINAT_PETUNJUK}</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="-6.161234"
                value={latTeks}
                onChange={(e) => setLatTeks(e.target.value)}
                className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 text-base text-tinta"
              />
              <input
                type="text"
                required
                placeholder="106.845678"
                value={lonTeks}
                onChange={(e) => setLonTeks(e.target.value)}
                className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 text-base text-tinta"
              />
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Tombol
              varian="sekunder"
              onClick={() => setTambahTerbuka(false)}
              disabled={sedangSimpan}
            >
              {TEKS.UMUM_BATAL}
            </Tombol>
            <Tombol type="submit" disabled={sedangSimpan}>
              {TEKS.UMUM_SIMPAN}
            </Tombol>
          </div>
        </form>
      </Dialog>

      <Dialog
        terbuka={Boolean(tpsQrBaru)}
        judul={TEKS.TPS_QR_BARU}
        onTutup={() => setTpsQrBaru(null)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-tinta">{TEKS.TPS_QR_BARU_PERINGATAN}</p>
          <div className="flex justify-end gap-2">
            <Tombol
              varian="sekunder"
              onClick={() => setTpsQrBaru(null)}
              disabled={sedangQrBaru}
            >
              {TEKS.UMUM_BATAL}
            </Tombol>
            <Tombol onClick={tanganiQrBaru} disabled={sedangQrBaru}>
              {TEKS.UMUM_KONFIRMASI}
            </Tombol>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
