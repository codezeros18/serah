"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Tps } from "@serah/kontrak";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Dialog, Kartu, Tombol } from "@serah/ui";
import { formatE6, parseKoordinat } from "@/lib/klien/angka";
import { panggil } from "@/lib/klien/api";
import { GambarAman } from "@/lib/klien/komponen/gambar-aman";
import { KonfirmasiAksi } from "@/lib/klien/komponen/konfirmasi-aksi";
import { useKawasanSaya } from "@/lib/klien/kawasan-saya";

const PetaPilihTitik = dynamic(() => import("@/lib/klien/komponen/peta-tps").then((m) => m.PetaPilihTitik), { ssr: false });
const PetaDaftarTps = dynamic(() => import("@/lib/klien/komponen/peta-tps").then((m) => m.PetaDaftarTps), { ssr: false });

export default function HalamanTps() {
  const { kawasan, galat: galatKawasan } = useKawasanSaya();
  const [daftarTps, setDaftarTps] = useState<Tps[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const [ubahId, setUbahId] = useState<string | null>(null);
  const [kataCari, setKataCari] = useState("");
  const [infoCari, setInfoCari] = useState<string | null>(null);
  const [sedangCari, setSedangCari] = useState(false);
  const [nama, setNama] = useState("");
  const [latTeks, setLatTeks] = useState("");
  const [lonTeks, setLonTeks] = useState("");
  const [sedangSimpan, setSedangSimpan] = useState(false);

  const titikPeta = useMemo(
    () => daftarTps.map((t) => ({ id: t.id, nama: t.nama, kode: t.kode, lat: t.latE6 / 1e6, lon: t.lonE6 / 1e6, aktif: t.aktif })),
    [daftarTps],
  );
  const latE6Peta = parseKoordinat(latTeks, "lat");
  const lonE6Peta = parseKoordinat(lonTeks, "lon");

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

  async function cariAlamat() {
    const q = kataCari.trim();
    if (q.length < 3) return;
    setSedangCari(true);
    setInfoCari(null);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("gagal");
      const h = (await r.json()) as { lat: string; lon: string }[];
      if (h.length === 0) setInfoCari(TEKS.PETA_CARI_KOSONG);
      else {
        setLatTeks(Number(h[0]!.lat).toFixed(6));
        setLonTeks(Number(h[0]!.lon).toFixed(6));
      }
    } catch {
      setInfoCari(TEKS.PETA_CARI_GAGAL);
    }
    setSedangCari(false);
  }

  function bukaTambah() {
    setUbahId(null);
    setNama("");
    setLatTeks("");
    setLonTeks("");
    setTambahTerbuka(true);
  }

  function bukaUbah(t: Tps) {
    setUbahId(t.id);
    setNama(t.nama);
    setLatTeks((t.latE6 / 1e6).toFixed(6));
    setLonTeks((t.lonE6 / 1e6).toFixed(6));
    setTambahTerbuka(true);
  }

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
    const res = ubahId
      ? await panggil("PATCH", "/api/tps/[id]", { params: { id: ubahId }, body: { nama, latE6, lonE6 } })
      : await panggil("POST", "/api/tps", { body: { kawasanId: kawasan.id, nama, latE6, lonE6 } });
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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-garis-halus pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">{TEKS.TPS_JUDUL}</h1>
          {kawasan ? <p className="text-sm font-medium text-tinta-redup">{kawasan.nama}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/kawasan/tps/cetak"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-kontrol border border-garis-halus bg-kertas px-4 text-sm font-semibold text-tinta transition-colors hover:bg-latar active:scale-[0.98]"
          >
            {TEKS.TPS_CETAK_QR}
          </Link>
          <Tombol onClick={bukaTambah}>{TEKS.TPS_TAMBAH}</Tombol>
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

      {titikPeta.length > 0 ? (
        <section aria-label={TEKS.PETA_JUDUL} className="h-64 sm:h-80">
          <PetaDaftarTps titik={titikPeta} />
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {daftarTps.map((tps) => (
          <Kartu key={tps.id} className="flex flex-col gap-4 border border-garis-halus shadow-xs transition-shadow duration-150 hover:shadow-md">
            <div className="flex items-start justify-between gap-4 border-b border-garis-halus/60 pb-3">
              <div>
                <h2 className="text-lg font-bold text-tinta">{tps.nama}</h2>
                <p className="font-mono text-xs font-semibold text-tinta-redup">{tps.kode}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                  tps.aktif
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-gray-100 text-gray-700 border-gray-300"
                }`}
              >
                {tps.aktif ? TEKS.LGN_STATUS_AKTIF : TEKS.KND_NONAKTIF}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-tinta-redup font-medium">{TEKS.TPS_KOORDINAT}:</span>
              <span className="font-mono text-xs font-bold text-tinta bg-latar px-2 py-0.5 rounded-kontrol">
                {formatE6(tps.latE6)}, {formatE6(tps.lonE6)}
              </span>
            </div>

            <div className="flex items-center justify-center rounded-2xl bg-latar/70 p-4">
              <div className="rounded-2xl bg-white p-2 shadow-[0_2px_10px_rgba(15,23,42,0.06)] ring-1 ring-garis-halus">
                <GambarAman
                  src={`/api/tps/${tps.id}/qr?format=svg&v=${tps.qrVersi}`}
                  alt={`${tps.nama} - ${tps.kode}`}
                  teksKosong={TEKS.QR_TPS_TIDAK_ADA}
                  ikon="tps"
                  className="h-40 w-40"
                  kelasKosong="h-40 w-40"
                />
              </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-2 pt-2 border-t border-garis-halus/60">
              <Link
                href={`/kawasan/tps/cetak?id=${tps.id}`}
                className="inline-flex min-h-10 min-w-10 flex-1 items-center justify-center gap-1.5 rounded-kontrol border border-garis-halus bg-kertas px-3 text-center text-sm font-semibold text-tinta transition-colors hover:bg-latar active:scale-[0.98]"
              >
                {TEKS.TPS_CETAK_QR}
              </Link>
              <Tombol
                varian="sekunder"
                className="min-h-10 flex-1 text-sm"
                onClick={() => setTpsQrBaru(tps)}
              >
                {TEKS.TPS_QR_BARU}
              </Tombol>
              <Tombol varian="sekunder" className="min-h-10 flex-1 text-sm" onClick={() => bukaUbah(tps)}>
                {TEKS.TPS_UBAH_LOKASI}
              </Tombol>
            </div>
          </Kartu>
        ))}
      </div>

      <Dialog
        terbuka={tambahTerbuka}
        judul={ubahId ? TEKS.TPS_UBAH_JUDUL : TEKS.TPS_TAMBAH}
        onTutup={() => setTambahTerbuka(false)}
      >
        <form onSubmit={tanganiTambah} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-tinta">
            {TEKS.TPS_NAMA}
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="min-h-12 rounded-kontrol border border-garis-halus bg-kertas px-3 text-base text-tinta transition-colors focus:border-aksi focus:outline-none"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-tinta">{TEKS.TPS_KOORDINAT}</span>
            <p className="text-xs text-tinta-redup">{TEKS.TPS_KOORDINAT_PETUNJUK}</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="-6.161234"
                value={latTeks}
                onChange={(e) => setLatTeks(e.target.value)}
                className="min-h-12 rounded-kontrol border border-garis-halus bg-kertas px-3 text-base font-mono text-tinta transition-colors focus:border-aksi focus:outline-none"
              />
              <input
                type="text"
                required
                placeholder="106.845678"
                value={lonTeks}
                onChange={(e) => setLonTeks(e.target.value)}
                className="min-h-12 rounded-kontrol border border-garis-halus bg-kertas px-3 text-base font-mono text-tinta transition-colors focus:border-aksi focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="search"
                aria-label={TEKS.PETA_CARI_LABEL}
                placeholder={TEKS.PETA_CARI_LABEL}
                value={kataCari}
                onChange={(e) => setKataCari(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void cariAlamat();
                  }
                }}
                className="min-h-12 min-w-0 flex-1 rounded-kontrol border border-garis-halus bg-kertas px-3 text-base text-tinta focus:border-aksi focus:outline-none"
              />
              <Tombol varian="sekunder" onClick={() => void cariAlamat()} disabled={sedangCari || kataCari.trim().length < 3}>
                {TEKS.PETA_CARI_TOMBOL}
              </Tombol>
            </div>
            {infoCari ? <p role="status" className="text-xs text-tinta-redup">{infoCari}</p> : null}
            <p className="text-xs text-tinta-redup">{TEKS.PETA_PILIH_PETUNJUK}</p>
            <div className="h-60 sm:h-72">
              <PetaPilihTitik
                lat={latE6Peta === null ? null : latE6Peta / 1e6}
                lon={lonE6Peta === null ? null : lonE6Peta / 1e6}
                onPilih={(la, lo) => {
                  setLatTeks(la.toFixed(6));
                  setLonTeks(lo.toFixed(6));
                }}
              />
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2 border-t border-garis-halus pt-3">
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

      <KonfirmasiAksi
        terbuka={Boolean(tpsQrBaru)}
        judul={TEKS.TPS_QR_BARU}
        tingkat="tahan"
        bahaya
        labelKonfirmasi={TEKS.TPS_QR_BARU}
        sibuk={sedangQrBaru}
        onKonfirmasi={() => void tanganiQrBaru()}
        onTutup={() => setTpsQrBaru(null)}
      >
        <p className="text-sm text-tinta">{TEKS.TPS_QR_BARU_PERINGATAN}</p>
      </KonfirmasiAksi>
    </div>
  );
}
