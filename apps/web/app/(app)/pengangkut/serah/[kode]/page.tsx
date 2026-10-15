"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { Aliran, KodeAturan } from "@serah/kontrak/enum";
import { TEKS, isi, type KunciTeks } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, LencanaAliran, PanelAturan, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { unggahFoto } from "@/lib/klien/foto";
import { KameraFoto } from "@/lib/klien/komponen/kamera-foto";
import { PemindaiQr } from "@/lib/klien/komponen/pemindai-qr";
import { useMuat } from "@/lib/klien/muat";

type Langkah = "pindai" | "foto" | "tujuan" | "terkirim";
type Tolak = { kode: KodeAturan; teks: string };

const KUNCI_KONTRAK = {
  USULAN: "KONTRAK_USULAN",
  AKTIF: "KONTRAK_AKTIF",
  BERAKHIR: "KONTRAK_BERAKHIR",
  DIBATALKAN: "KONTRAK_DIBATALKAN",
} as const satisfies Record<string, KunciTeks>;

/** A2 — ambil serah: pindai QR → foto muatan → kendaraan & penerima → kirim. */
export default function LayarA2() {
  const { kode } = useParams<{ kode: string }>();
  const [langkah, setLangkah] = useState<Langkah>("pindai");
  const [galat, setGalat] = useState<string | null>(null);
  const [tolak, setTolak] = useState<Tolak | null>(null);
  const [fotoId, setFotoId] = useState<string | null>(null);
  const [kendaraanId, setKendaraanId] = useState("");
  const [penerimaId, setPenerimaId] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const serah = useMuat(() => panggil("GET", "/api/serah/[kode]", { params: { kode } }));
  const kendaraan = useMuat(() => panggil("GET", "/api/kendaraan"));
  // Pengangkut hanya melihat penerima yang berkontrak dengannya (direktori mitra khusus pengelola).
  const kontrak = useMuat(() => panggil("GET", "/api/kontrak"));
  const penerimaKontrak = useMemo(() => {
    if (kontrak.keadaan.status !== "siap") return [];
    const peta = new Map<string, { id: string; nama: string; aliran: Set<Aliran>; status: keyof typeof KUNCI_KONTRAK }>();
    for (const k of kontrak.keadaan.data.kontrak) {
      if (k.status === "BERAKHIR" || k.status === "DIBATALKAN") continue;
      const ada = peta.get(k.penerima.id) ?? { id: k.penerima.id, nama: k.penerima.nama, aliran: new Set<Aliran>(), status: k.status };
      k.aliran.forEach((a) => ada.aliran.add(a));
      if (k.status === "AKTIF") ada.status = "AKTIF";
      peta.set(k.penerima.id, ada);
    }
    return [...peta.values()];
  }, [kontrak.keadaan]);

  const hasilPindai = useCallback(
    (teks: string) => {
      if (teks.trim() === kode) {
        setGalat(null);
        setLangkah("foto");
      } else {
        setGalat(TEKS.G_QR_TIDAK_DIKENAL);
      }
    },
    [kode],
  );

  async function kirimFoto(blob: Blob) {
    setSibuk(true);
    setGalat(null);
    setTolak(null);
    const h = await unggahFoto(blob, "MUATAN", kode);
    setSibuk(false);
    if (h.ok) {
      setFotoId(h.fotoId);
      setLangkah("tujuan");
    } else if (h.galat.kode === "ATURAN_DITOLAK" && h.galat.aturan) {
      setTolak({ kode: h.galat.aturan.kode, teks: h.galat.aturan.teks });
    } else {
      setGalat(h.pesan);
    }
  }

  async function kirim() {
    if (!fotoId) return;
    setSibuk(true);
    setGalat(null);
    setTolak(null);
    const h = await panggil("POST", "/api/serah/[kode]/ambil", {
      params: { kode },
      body: { fotoId, kendaraanId, penerimaId },
      idempotencyKey: crypto.randomUUID(),
    });
    setSibuk(false);
    if (h.ok) {
      setLangkah("terkirim");
    } else if (h.galat.aturan && h.galat.kode === "ATURAN_DITOLAK") {
      setTolak({ kode: h.galat.aturan.kode, teks: h.galat.aturan.teks });
    } else {
      setGalat(h.pesan);
    }
  }

  const detail = serah.keadaan.status === "siap" ? serah.keadaan.data : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{isi("A2_JUDUL", { kode_serah: kode })}</h1>

      {serah.keadaan.status === "galat" ? <BannerGalat pesan={serah.keadaan.pesan} onCoba={() => void serah.ulang()} /> : null}
      {detail ? (
        <Kartu className="flex flex-col gap-2">
          <p className="text-base font-semibold">
            {detail.tps.nama} · {detail.kawasan.nama}
          </p>
          <div className="flex flex-wrap gap-2">
            {detail.aliran.map((a) => (
              <LencanaAliran key={a} aliran={a} pendek />
            ))}
          </div>
        </Kartu>
      ) : null}

      {galat ? <BannerGalat pesan={galat} /> : null}
      {tolak ? <PanelAturan aksi="TOLAK" kode={tolak.kode} teks={tolak.teks} /> : null}

      {langkah === "pindai" ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">{TEKS.A2_PINDAI}</h2>
          <PemindaiQr petunjuk={TEKS.A2_PINDAI} onHasil={hasilPindai} />
          {/* QR sudah dikenal dari daftar A1; tombol ini untuk perangkat tanpa kamera yang bisa memindai. */}
          <Tombol varian="sekunder" onClick={() => setLangkah("foto")}>
            {TEKS.UMUM_LANJUT}
          </Tombol>
        </section>
      ) : null}

      {langkah === "foto" ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">{TEKS.A2_FOTO}</h2>
          <KameraFoto petunjuk={TEKS.A2_FOTO_PETUNJUK} labelAmbil={sibuk ? TEKS.UMUM_MUAT : TEKS.A2_FOTO} onFoto={(b) => void kirimFoto(b)} />
          {tolak ? (
            <Tombol varian="sekunder" onClick={() => setTolak(null)}>
              {TEKS.A2_FOTO_ULANG}
            </Tombol>
          ) : null}
        </section>
      ) : null}

      {langkah === "tujuan" ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="kendaraan" className="text-base font-semibold">
              {TEKS.A2_KENDARAAN}
            </label>
            <select
              id="kendaraan"
              value={kendaraanId}
              onChange={(e) => setKendaraanId(e.target.value)}
              className="min-h-12 rounded-kontrol border-2 border-garis bg-kertas px-3 text-base"
            >
              <option value="" />
              {kendaraan.keadaan.status === "siap"
                ? kendaraan.keadaan.data.kendaraan
                    .filter((k) => k.aktif)
                    .map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.plat}
                      </option>
                    ))
                : null}
            </select>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-base font-semibold">{TEKS.A2_PENERIMA}</legend>
            <p className="text-sm text-tinta-redup">{TEKS.A2_PENERIMA_PETUNJUK}</p>
            {penerimaKontrak.map((m) => (
              <label
                key={m.id}
                className="flex min-h-12 cursor-pointer items-start gap-3 rounded-kartu border-2 border-garis-halus bg-kertas p-3 has-[:checked]:border-aksi"
              >
                <input
                  type="radio"
                  name="penerima"
                  value={m.id}
                  checked={penerimaId === m.id}
                  onChange={() => {
                    setPenerimaId(m.id);
                    setTolak(null);
                  }}
                  className="mt-1 h-5 w-5"
                />
                <span className="flex flex-col gap-1">
                  <span className="text-base font-semibold">{m.nama}</span>
                  <span className="text-sm text-tinta-redup">{TEKS[KUNCI_KONTRAK[m.status]]}</span>
                  <span className="flex flex-wrap gap-1">
                    {[...m.aliran].map((a) => (
                      <LencanaAliran key={a} aliran={a} pendek />
                    ))}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <Tombol onClick={() => void kirim()} disabled={sibuk || kendaraanId === "" || penerimaId === ""}>
            {sibuk ? TEKS.UMUM_MUAT : TEKS.A2_KIRIM}
          </Tombol>
        </section>
      ) : null}

      {langkah === "terkirim" ? (
        <section className="flex flex-col gap-3" role="status">
          <p className="text-lg font-semibold">{TEKS.A2_TERKIRIM}</p>
          <Link
            href="/pengangkut"
            className="inline-flex min-h-12 items-center justify-center rounded-kontrol border-2 border-garis bg-kertas px-5 text-base font-semibold"
          >
            {TEKS.A1_JUDUL}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
