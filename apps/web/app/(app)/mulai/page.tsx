"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Aliran, JenisPenerima, Peran } from "@serah/kontrak/enum";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Tombol } from "@serah/ui";
import { parseKoordinat } from "@/lib/klien/angka";
import { MOCK_AKTIF, panggil } from "@/lib/klien/api";
import { aturPeranMock } from "@/lib/klien/mock";
import { rutePeran } from "@/lib/klien/rute-peran";
import { useSesi } from "@/lib/klien/sesi";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";

const ALIRAN_OPSI: readonly Aliran[] = ["HIJAU", "KUNING", "MERAH", "ABU"];
const ALAMAT_DEFAULT = "Jl. Kebon Kosong No. 1";
const KOTA_DEFAULT = "Jakarta Pusat";

export default function HalamanMulai() {
  const router = useRouter();
  const { muatUlang } = useSesi();

  const [langkah, setLangkah] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [jenis, setJenis] = useState<"KAWASAN" | "PENGANGKUT" | "PENERIMA">("KAWASAN");
  const [namaOrg, setNamaOrg] = useState("");
  const [jenisPenerima, setJenisPenerima] = useState<JenisPenerima>("TPS3R");
  const [nomorIzin, setNomorIzin] = useState("");

  // Step 3 Kawasan
  const [namaKawasan, setNamaKawasan] = useState("");
  const [adm4, setAdm4] = useState("31.71.03.1001");
  const [namaTps, setNamaTps] = useState("TPS 01");
  const [latTeks, setLatTeks] = useState("-6.161234");
  const [lonTeks, setLonTeks] = useState("106.845678");

  // Step 3 Mitra
  const [aliranPilihan, setAliranPilihan] = useState<Aliran[]>(["HIJAU", "KUNING", "MERAH", "ABU"]);
  const [platNomor, setPlatNomor] = useState("B 1234 ABC");

  // Step 4 Anggota
  const [emailUndang, setEmailUndang] = useState("");
  const [peranUndang, setPeranUndang] = useState<"PETUGAS" | "PENGELOLA" | "PENGANGKUT" | "PENERIMA">("PETUGAS");

  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  function toggleAliran(a: Aliran) {
    setAliranPilihan((prev) =>
      prev.includes(a) ? (prev.length > 1 ? prev.filter((x) => x !== a) : prev) : [...prev, a],
    );
  }

  async function selesaikanOnboarding() {
    setGalat(null);
    setMemuat(true);

    // 1. Buat organisasi
    const orgRes = await panggil("POST", "/api/organisasi", {
      body: {
        jenis,
        nama: namaOrg,
        yurisdiksi: "DKI",
        jenisPenerima: jenis === "PENERIMA" ? jenisPenerima : undefined,
        aliranDiterima: jenis !== "KAWASAN" ? aliranPilihan : undefined,
        nomorIzin: nomorIzin.trim() || undefined,
      },
    });

    if (!orgRes.ok) {
      setMemuat(false);
      setGalat(orgRes.pesan);
      return;
    }

    // 2. Jika kawasan: buat kawasan dan TPS
    if (jenis === "KAWASAN") {
      const kwsRes = await panggil("POST", "/api/kawasan", {
        body: {
          nama: namaKawasan || namaOrg,
          jenis: "KOMERSIAL",
          alamat: ALAMAT_DEFAULT,
          adm4,
          kota: KOTA_DEFAULT,
        },
      });

      if (!kwsRes.ok) {
        setMemuat(false);
        setGalat(kwsRes.pesan);
        return;
      }

      const kawasanId = kwsRes.data.kawasan.id;
      const latE6 = parseKoordinat(latTeks, "lat") ?? -6161234;
      const lonE6 = parseKoordinat(lonTeks, "lon") ?? 106845678;

      const tpsRes = await panggil("POST", "/api/tps", {
        body: {
          kawasanId,
          nama: namaTps,
          latE6,
          lonE6,
        },
      });

      if (!tpsRes.ok) {
        setMemuat(false);
        setGalat(tpsRes.pesan);
        return;
      }
    }

    // 3. Jika pengangkut dan ada plat nomor
    if (jenis === "PENGANGKUT" && platNomor.trim()) {
      await panggil("POST", "/api/kendaraan", { body: { plat: platNomor.trim().toUpperCase() } });
    }

    // 4. Undangan anggota opsional
    if (emailUndang.trim()) {
      await panggil("POST", "/api/undangan", {
        body: { email: emailUndang.trim(), peran: peranUndang },
      });
    }

    setMemuat(false);
    setLangkah(5);
    muatUlang();
  }

  function masukAplikasi() {
    const peranBaru: Peran =
      jenis === "KAWASAN" ? "PENGELOLA" : jenis === "PENGANGKUT" ? "PENGANGKUT" : "PENERIMA";
    if (MOCK_AKTIF) aturPeranMock(peranBaru);
    router.push(rutePeran(peranBaru));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-12 text-tinta">
      {/* Brand Header */}
      <div className="mb-6 text-center flex flex-col items-center">
        <Link href="/" className="inline-block group mb-3" aria-label={TEKS.APP_NAMA}>
          <LogoSerah ukuran="sm" />
        </Link>
        <h1 className="text-2xl font-black tracking-tight text-tinta sm:text-3xl">
          {TEKS.MULAI_JUDUL}
        </h1>
        <p className="mt-1 text-sm text-tinta-redup">
          {langkah === 1
            ? TEKS.MULAI_L1
            : langkah === 2
              ? TEKS.MULAI_L2
              : langkah === 3
                ? jenis === "KAWASAN"
                  ? TEKS.MULAI_L3_KAWASAN
                  : TEKS.MULAI_L3_MITRA
                : langkah === 4
                  ? TEKS.MULAI_L4
                  : TEKS.MULAI_SELESAI}
        </p>
      </div>

      {/* Step Progress Bar */}
      <div className="flex items-center justify-between max-w-xs mx-auto mb-6 w-full px-2" aria-label="Progress">
        {[1, 2, 3, 4, 5].map((step) => {
          const selesai = langkah > step;
          const aktif = langkah === step;
          return (
            <div key={step} className="flex items-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  selesai
                    ? "bg-aksi text-aksi-teks"
                    : aktif
                      ? "border-2 border-aksi bg-aksi-latar text-aksi font-black"
                      : "border border-garis-halus bg-latar text-tinta-redup"
                }`}
              >
                {selesai ? "✓" : step}
              </span>
              {step < 5 ? (
                <span
                  className={`h-0.5 w-6 sm:w-10 transition-colors ${
                    selesai ? "bg-aksi" : "bg-garis-halus"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <Kartu className="flex flex-col gap-6 p-6 sm:p-8 border border-garis-halus bg-kertas shadow-md">
        {galat ? <BannerGalat pesan={galat} /> : null}

        {/* Langkah 1: Jenis Organisasi */}
        {langkah === 1 ? (
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-bold text-tinta">{TEKS.MULAI_L1}</h2>
            <div className="flex flex-col gap-3">
              {(
                [
                  { id: "KAWASAN", label: TEKS.MULAI_L1_KAWASAN },
                  { id: "PENGANGKUT", label: TEKS.MULAI_L1_PENGANGKUT },
                  { id: "PENERIMA", label: TEKS.MULAI_L1_PENERIMA },
                ] as const
              ).map((p) => {
                const dipilih = jenis === p.id;
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-start gap-3.5 rounded-kartu border p-4 transition-all ${
                      dipilih
                        ? "border-2 border-aksi bg-aksi-latar/50 shadow-xs ring-1 ring-aksi/15 font-semibold"
                        : "border-garis-halus bg-kertas hover:border-garis hover:bg-latar/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="jenis-organisasi"
                      value={p.id}
                      checked={dipilih}
                      onChange={() => setJenis(p.id)}
                      className="mt-1 h-4 w-4 text-aksi accent-[#2457c5] focus:ring-aksi"
                    />
                    <span className="text-base text-tinta leading-relaxed">{p.label}</span>
                  </label>
                );
              })}
            </div>
            <Tombol
              onClick={() => setLangkah(2)}
              className="mt-2 bg-aksi hover:bg-aksi-hover text-white shadow-sm"
            >
              {TEKS.UMUM_LANJUT}
            </Tombol>
          </div>
        ) : null}

        {/* Langkah 2: Data Organisasi */}
        {langkah === 2 ? (
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-bold text-tinta">{TEKS.MULAI_L2}</h2>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mulai-nama-org" className="text-sm font-semibold text-tinta">
                {TEKS.MULAI_L2_NAMA}
              </label>
              <input
                id="mulai-nama-org"
                type="text"
                required
                minLength={2}
                value={namaOrg}
                onChange={(e) => setNamaOrg(e.target.value)}
                className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
              />
            </div>

            {jenis === "PENERIMA" ? (
              <div className="flex flex-col gap-4 border-t border-garis-halus pt-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mulai-jenis-penerima" className="text-sm font-semibold text-tinta">
                    {TEKS.IZN_JUDUL}
                  </label>
                  <select
                    id="mulai-jenis-penerima"
                    value={jenisPenerima}
                    onChange={(e) => setJenisPenerima(e.target.value as JenisPenerima)}
                    className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
                  >
                    <option value="TPS3R">TPS 3R</option>
                    <option value="BANK_SAMPAH_INDUK">Bank Sampah Induk</option>
                    <option value="PELAPAK_BERIZIN">Pelapak Berizin</option>
                    <option value="FASILITAS_BERIZIN">Fasilitas Berizin</option>
                    <option value="TPA_TPST">TPA / TPST</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mulai-nomor-izin" className="text-sm font-semibold text-tinta">
                    {TEKS.IZN_NOMOR}
                  </label>
                  <input
                    id="mulai-nomor-izin"
                    type="text"
                    value={nomorIzin}
                    onChange={(e) => setNomorIzin(e.target.value)}
                    className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex gap-3 mt-3">
              <Tombol varian="sekunder" onClick={() => setLangkah(1)} className="flex-1">
                {TEKS.UMUM_KEMBALI}
              </Tombol>
              <Tombol
                disabled={namaOrg.trim().length < 2}
                onClick={() => setLangkah(3)}
                className="flex-1 bg-aksi hover:bg-aksi-hover text-white shadow-sm"
              >
                {TEKS.UMUM_LANJUT}
              </Tombol>
            </div>
          </div>
        ) : null}

        {/* Langkah 3: Kawasan & TPS / Mitra */}
        {langkah === 3 ? (
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-bold text-tinta">
              {jenis === "KAWASAN" ? TEKS.MULAI_L3_KAWASAN : TEKS.MULAI_L3_MITRA}
            </h2>

            {jenis === "KAWASAN" ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mulai-kws-nama" className="text-sm font-semibold text-tinta">
                    {TEKS.MULAI_L2_NAMA}
                  </label>
                  <input
                    id="mulai-kws-nama"
                    type="text"
                    required
                    value={namaKawasan || namaOrg}
                    onChange={(e) => setNamaKawasan(e.target.value)}
                    className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mulai-adm4" className="text-sm font-semibold text-tinta">
                    {TEKS.MULAI_L3_ADM4}
                  </label>
                  <input
                    id="mulai-adm4"
                    type="text"
                    required
                    value={adm4}
                    onChange={(e) => setAdm4(e.target.value)}
                    className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
                  />
                  <p className="text-xs text-tinta-redup">{TEKS.MULAI_L3_ADM4_PETUNJUK}</p>
                </div>

                <div className="border-t border-garis-halus pt-4 flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="mulai-tps-nama" className="text-sm font-semibold text-tinta">
                      {TEKS.TPS_NAMA}
                    </label>
                    <input
                      id="mulai-tps-nama"
                      type="text"
                      required
                      value={namaTps}
                      onChange={(e) => setNamaTps(e.target.value)}
                      className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="mulai-tps-lat" className="text-sm font-semibold text-tinta">
                        Lintang (lat)
                      </label>
                      <input
                        id="mulai-tps-lat"
                        type="text"
                        required
                        value={latTeks}
                        onChange={(e) => setLatTeks(e.target.value)}
                        className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="mulai-tps-lon" className="text-sm font-semibold text-tinta">
                        Bujur (lon)
                      </label>
                      <input
                        id="mulai-tps-lon"
                        type="text"
                        required
                        value={lonTeks}
                        onChange={(e) => setLonTeks(e.target.value)}
                        className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-tinta-redup">{TEKS.TPS_KOORDINAT_PETUNJUK}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-tinta">{TEKS.MULAI_L3_MITRA}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALIRAN_OPSI.map((a) => (
                      <label
                        key={a}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-kontrol border p-3 transition-all ${
                          aliranPilihan.includes(a)
                            ? "border-2 border-aksi bg-aksi-latar font-semibold shadow-2xs"
                            : "border-garis-halus bg-kertas hover:border-garis"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={aliranPilihan.includes(a)}
                          onChange={() => toggleAliran(a)}
                          className="h-4 w-4 text-aksi accent-[#2457c5] focus:ring-aksi"
                        />
                        <span className="text-sm text-tinta">
                          {a === "HIJAU"
                            ? TEKS.ALIRAN_HIJAU_PENDEK
                            : a === "KUNING"
                              ? TEKS.ALIRAN_KUNING_PENDEK
                              : a === "MERAH"
                                ? TEKS.ALIRAN_MERAH_PENDEK
                                : TEKS.ALIRAN_ABU_PENDEK}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {jenis === "PENGANGKUT" ? (
                  <div className="flex flex-col gap-1.5 border-t border-garis-halus pt-4">
                    <label htmlFor="mulai-plat" className="text-sm font-semibold text-tinta">
                      {TEKS.KND_PLAT}
                    </label>
                    <input
                      id="mulai-plat"
                      type="text"
                      value={platNomor}
                      onChange={(e) => setPlatNomor(e.target.value)}
                      className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
                    />
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex gap-3 mt-3">
              <Tombol varian="sekunder" onClick={() => setLangkah(2)} className="flex-1">
                {TEKS.UMUM_KEMBALI}
              </Tombol>
              <Tombol
                onClick={() => setLangkah(4)}
                className="flex-1 bg-aksi hover:bg-aksi-hover text-white shadow-sm"
              >
                {TEKS.UMUM_LANJUT}
              </Tombol>
            </div>
          </div>
        ) : null}

        {/* Langkah 4: Undang Anggota */}
        {langkah === 4 ? (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-bold text-tinta">{TEKS.MULAI_L4}</h2>
              <p className="text-xs text-tinta-redup mt-1">{TEKS.MULAI_L4_PETUNJUK}</p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mulai-undang-email" className="text-sm font-semibold text-tinta">
                  {TEKS.AGT_EMAIL}
                </label>
                <input
                  id="mulai-undang-email"
                  type="email"
                  value={emailUndang}
                  onChange={(e) => setEmailUndang(e.target.value)}
                  className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="mulai-undang-peran" className="text-sm font-semibold text-tinta">
                  {TEKS.AGT_PERAN}
                </label>
                <select
                  id="mulai-undang-peran"
                  value={peranUndang}
                  onChange={(e) =>
                    setPeranUndang(e.target.value as "PETUGAS" | "PENGELOLA" | "PENGANGKUT" | "PENERIMA")
                  }
                  className="rounded-kontrol border border-garis bg-kertas px-3.5 py-2.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
                >
                  <option value="PETUGAS">{TEKS.PERAN_PETUGAS}</option>
                  <option value="PENGELOLA">{TEKS.PERAN_PENGELOLA}</option>
                  <option value="PENGANGKUT">{TEKS.PERAN_PENGANGKUT}</option>
                  <option value="PENERIMA">{TEKS.PERAN_PENERIMA}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-3">
              <Tombol varian="sekunder" disabled={memuat} onClick={() => setLangkah(3)} className="flex-1">
                {TEKS.UMUM_KEMBALI}
              </Tombol>
              <Tombol
                disabled={memuat}
                onClick={selesaikanOnboarding}
                className="flex-1 bg-aksi hover:bg-aksi-hover text-white shadow-sm"
              >
                {memuat ? TEKS.UMUM_MUAT : TEKS.UMUM_SIMPAN}
              </Tombol>
            </div>
          </div>
        ) : null}

        {/* Langkah 5: Selesai */}
        {langkah === 5 ? (
          <div className="flex flex-col gap-6 text-center py-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-3xl font-bold">
              ✓
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-xl font-black text-tinta">{TEKS.MULAI_SELESAI}</h2>
              <p className="text-sm text-tinta-redup font-medium">{TEKS.MULAI_UJI_COBA}</p>
            </div>
            <Tombol
              onClick={masukAplikasi}
              className="w-full bg-aksi hover:bg-aksi-hover text-white shadow-sm"
            >
              {TEKS.UMUM_LANJUT}
            </Tombol>
          </div>
        ) : null}
      </Kartu>
    </main>
  );
}
