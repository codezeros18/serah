"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { z } from "zod";
import { ALIRAN, type Aliran, type DirektoriMitraKeluaran, type Kontrak } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Dialog, Kartu, Kosong, LencanaAliran, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { KonfirmasiAksi } from "@/lib/klien/komponen/konfirmasi-aksi";
import { useKawasanSaya } from "@/lib/klien/kawasan-saya";
import { Pilih } from "@/lib/klien/komponen/pilih";

type ItemMitra = z.infer<typeof DirektoriMitraKeluaran>["mitra"][number];

export default function HalamanKontrak() {
  const { kawasan, galat: galatKawasan } = useKawasanSaya();
  const [daftarKontrak, setDaftarKontrak] = useState<Kontrak[]>([]);
  const [daftarPengangkut, setDaftarPengangkut] = useState<ItemMitra[]>([]);
  const [daftarPenerima, setDaftarPenerima] = useState<ItemMitra[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const [pengangkutId, setPengangkutId] = useState("");
  const [penerimaId, setPenerimaId] = useState("");
  const [aliranTerpilih, setAliranTerpilih] = useState<Aliran[]>(["HIJAU", "KUNING", "MERAH", "ABU"]);
  const [berlakuDari, setBerlakuDari] = useState(new Date().toISOString().slice(0, 10));
  const [berlakuSampai, setBerlakuSampai] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [tarifRit, setTarifRit] = useState("");
  const [tarifKg, setTarifKg] = useState("");
  const [sedangSimpan, setSedangSimpan] = useState(false);

  const muat = useCallback(async () => {
    setSedangMuat(true);
    setGalat(null);

    const [rKontrak, rPengangkut, rPenerima] = await Promise.all([
      panggil("GET", "/api/kontrak", {}),
      panggil("GET", "/api/direktori/mitra", { kueri: { jenis: "PENGANGKUT" } }),
      panggil("GET", "/api/direktori/mitra", { kueri: { jenis: "PENERIMA" } }),
    ]);

    setSedangMuat(false);

    if (rKontrak.ok) setDaftarKontrak(rKontrak.data.kontrak);
    else setGalat(rKontrak.pesan);

    if (rPengangkut.ok) {
      setDaftarPengangkut(rPengangkut.data.mitra);
      if (rPengangkut.data.mitra[0]) setPengangkutId(rPengangkut.data.mitra[0].id);
    }

    if (rPenerima.ok) {
      setDaftarPenerima(rPenerima.data.mitra);
      if (rPenerima.data.mitra[0]) setPenerimaId(rPenerima.data.mitra[0].id);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  function ubahAliran(aliran: Aliran) {
    if (aliranTerpilih.includes(aliran)) {
      if (aliranTerpilih.length > 1) {
        setAliranTerpilih(aliranTerpilih.filter((a) => a !== aliran));
      }
    } else {
      setAliranTerpilih([...aliranTerpilih, aliran]);
    }
  }

  async function tanganiTambah(e: FormEvent) {
    e.preventDefault();
    if (!kawasan) return;

    setSedangSimpan(true);
    setGalat(null);

    const rit = tarifRit ? parseInt(tarifRit, 10) : undefined;
    const kg = tarifKg ? parseInt(tarifKg, 10) : undefined;

    const res = await panggil("POST", "/api/kontrak", {
      body: {
        kawasanId: kawasan.id,
        pengangkutId,
        penerimaId,
        aliran: aliranTerpilih,
        berlakuDari,
        berlakuSampai,
        tarifPerRitIdr: isNaN(rit as number) ? undefined : rit,
        tarifPerKgIdr: isNaN(kg as number) ? undefined : kg,
      },
    });

    setSedangSimpan(false);

    if (res.ok) {
      setTambahTerbuka(false);
      await muat();
    } else {
      setGalat(res.pesan);
    }
  }

  const [akhiriId, setAkhiriId] = useState<string | null>(null);
  const [konfirmasiId, setKonfirmasiId] = useState<string | null>(null);
  const [sedangAksi, setSedangAksi] = useState(false);

  async function tanganiAkhiri(id: string) {
    setGalat(null);
    const res = await panggil("POST", "/api/kontrak/[id]/akhiri", {
      params: { id },
      body: {},
    });
    if (res.ok) {
      await muat();
    } else {
      setGalat(res.pesan);
    }
  }

  async function tanganiKonfirmasi(id: string) {
    setGalat(null);
    const res = await panggil("POST", "/api/kontrak/[id]/konfirmasi", {
      params: { id },
      body: {},
    });
    if (res.ok) {
      await muat();
    } else {
      setGalat(res.pesan);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-garis-halus pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">{TEKS.KTR_JUDUL}</h1>
          {kawasan ? <p className="text-sm font-medium text-tinta-redup">{kawasan.nama}</p> : null}
        </div>
        <Tombol onClick={() => setTambahTerbuka(true)}>{TEKS.KTR_TAMBAH}</Tombol>
      </div>

      {galatKawasan ? <BannerGalat pesan={galatKawasan} /> : null}
      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {sedangMuat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {!sedangMuat && daftarKontrak.length === 0 ? (
        <Kosong
          teks={TEKS.K_KOSONG_KONTRAK}
          aksi={<Tombol onClick={() => setTambahTerbuka(true)}>{TEKS.KTR_TAMBAH}</Tombol>}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {daftarKontrak.map((k) => (
          <Kartu key={k.id} className="flex flex-col gap-4 shadow-xs transition-shadow duration-150 hover:shadow-md">
            <div className="flex items-start justify-between gap-4 border-b border-garis-halus/60 pb-3">
              <div className="flex flex-col gap-1.5">
                <div>
                  <span className="text-xs font-semibold text-tinta-redup">{TEKS.KTR_PENGANGKUT}</span>
                  <p className="text-base font-bold text-tinta">{k.pengangkut.nama}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-tinta-redup">{TEKS.KTR_PENERIMA}</span>
                  <p className="text-base font-bold text-tinta">{k.penerima.nama}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                  k.status === "USULAN"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : k.status === "AKTIF"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : k.status === "BERAKHIR"
                        ? "bg-gray-100 text-gray-700 border-gray-300"
                        : "bg-purple-50 text-purple-800 border-purple-200"
                }`}
              >
                {k.status === "USULAN"
                  ? TEKS.KONTRAK_USULAN
                  : k.status === "AKTIF"
                    ? TEKS.KONTRAK_AKTIF
                    : k.status === "BERAKHIR"
                      ? TEKS.KONTRAK_BERAKHIR
                      : TEKS.KONTRAK_DIBATALKAN}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-tinta-redup">{TEKS.KTR_ALIRAN}</span>
              <div className="flex flex-wrap gap-1.5">
                {k.aliran.map((a) => (
                  <LencanaAliran key={a} aliran={a} pendek />
                ))}
              </div>
            </div>

            <div className="text-xs font-medium text-tinta-redup">
              {isi("KTR_BERLAKU", { dari: k.berlakuDari, sampai: k.berlakuSampai })}
            </div>

            {k.tarifPerRitIdr || k.tarifPerKgIdr ? (
              <div className="rounded-kontrol border border-garis-halus bg-latar/50 p-3 text-xs font-semibold text-tinta tabular-nums">
                {k.tarifPerRitIdr ? <div>{TEKS.KTR_TARIF_RIT}: Rp{k.tarifPerRitIdr.toLocaleString("id-ID")}</div> : null}
                {k.tarifPerKgIdr ? <div>{TEKS.KTR_TARIF_KG}: Rp{k.tarifPerKgIdr.toLocaleString("id-ID")}</div> : null}
              </div>
            ) : null}

            <div className="mt-auto flex flex-wrap gap-2 pt-2 border-t border-garis-halus/60">
              {k.status === "USULAN" ? (
                <Tombol className="min-h-10 flex-1 text-sm" onClick={() => setKonfirmasiId(k.id)}>
                  {TEKS.KTR_KONFIRMASI}
                </Tombol>
              ) : null}
              {k.status === "USULAN" || k.status === "AKTIF" ? (
                <Tombol varian="sekunder" className="min-h-10 flex-1 text-sm" onClick={() => setAkhiriId(k.id)}>
                  {TEKS.KTR_AKHIRI}
                </Tombol>
              ) : null}
            </div>
          </Kartu>
        ))}
      </div>

      <Dialog terbuka={tambahTerbuka} judul={TEKS.KTR_TAMBAH} onTutup={() => setTambahTerbuka(false)}>
        <form onSubmit={tanganiTambah} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {TEKS.KTR_PENGANGKUT}
            <Pilih
              value={pengangkutId}
              onChange={(e) => setPengangkutId(e.target.value)}
              required
            >
              {daftarPengangkut.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama}
                </option>
              ))}
            </Pilih>
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold">
            {TEKS.KTR_PENERIMA}
            <Pilih
              value={penerimaId}
              onChange={(e) => setPenerimaId(e.target.value)}
              required
            >
              {daftarPenerima.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama}
                </option>
              ))}
            </Pilih>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{TEKS.KTR_ALIRAN}</span>
            <div className="grid grid-cols-2 gap-2">
              {ALIRAN.map((aliran) => (
                <label key={aliran} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={aliranTerpilih.includes(aliran)}
                    onChange={() => ubahAliran(aliran)}
                    className="kotak-centang kotak-bulat"
                  />
                  <LencanaAliran aliran={aliran} pendek />
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Dari
              <input
                type="date"
                required
                value={berlakuDari}
                onChange={(e) => setBerlakuDari(e.target.value)}
                className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 text-base text-tinta"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Sampai
              <input
                type="date"
                required
                value={berlakuSampai}
                onChange={(e) => setBerlakuSampai(e.target.value)}
                className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 text-base text-tinta"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-tinta-redup">{TEKS.KTR_TARIF_PETUNJUK}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold">
                {TEKS.KTR_TARIF_RIT}
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={tarifRit}
                  onChange={(e) => setTarifRit(e.target.value)}
                  className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 text-base text-tinta"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                {TEKS.KTR_TARIF_KG}
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={tarifKg}
                  onChange={(e) => setTarifKg(e.target.value)}
                  className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 text-base text-tinta"
                />
              </label>
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Tombol varian="sekunder" onClick={() => setTambahTerbuka(false)} disabled={sedangSimpan}>
              {TEKS.UMUM_BATAL}
            </Tombol>
            <Tombol type="submit" disabled={sedangSimpan}>
              {TEKS.UMUM_SIMPAN}
            </Tombol>
          </div>
        </form>
      </Dialog>

      <KonfirmasiAksi
        terbuka={konfirmasiId !== null}
        judul={TEKS.KTR_KONFIRMASI}
        labelKonfirmasi={TEKS.KTR_KONFIRMASI}
        sibuk={sedangAksi}
        onKonfirmasi={async () => {
          if (!konfirmasiId) return;
          setSedangAksi(true);
          await tanganiKonfirmasi(konfirmasiId);
          setSedangAksi(false);
          setKonfirmasiId(null);
        }}
        onTutup={() => setKonfirmasiId(null)}
      />

      <KonfirmasiAksi
        terbuka={akhiriId !== null}
        judul={TEKS.KTR_AKHIRI}
        tingkat="tahan"
        bahaya
        labelKonfirmasi={TEKS.KTR_AKHIRI}
        sibuk={sedangAksi}
        onKonfirmasi={async () => {
          if (!akhiriId) return;
          setSedangAksi(true);
          await tanganiAkhiri(akhiriId);
          setSedangAksi(false);
          setAkhiriId(null);
        }}
        onTutup={() => setAkhiriId(null)}
      >
        <p className="text-xs text-tinta-redup">{TEKS.KONF_AKHIRI_KTR}</p>
      </KonfirmasiAksi>
    </div>
  );
}
