"use client";

import { useCallback, useEffect, useState } from "react";
import { ALIRAN, STATUS_SERAH } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";
import {
  AtribusiBMKG,
  BannerGalat,
  Dialog,
  IsianBerat,
  Kartu,
  Kosong,
  LabelDemo,
  LencanaAliran,
  LencanaStatus,
  PanelAturan,
  Tab,
  Tabel,
  Tombol,
} from "@serah/ui";
import { panggil, type HasilApi } from "../api";
import { formatGramKeKg, parseBeratKgKeGram } from "../angka";
import { KameraFoto } from "./kamera-foto";
import { PemindaiQr } from "./pemindai-qr";
import { QrTampil } from "./qr-tampil";

const WARNA_TOKEN = [
  "aliran-hijau",
  "aliran-kuning",
  "aliran-merah",
  "aliran-abu",
  "aksi",
  "fokus",
  "peringatan",
  "tolak",
  "galat",
  "kertas",
  "latar",
  "tinta",
] as const;

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-b-2 border-garis pb-1 text-xl font-bold">{judul}</h2>
      {children}
    </section>
  );
}

function UjiApi() {
  const [hasil, setHasil] = useState<Record<string, string>>({});
  const jalankan = useCallback(async () => {
    const [sesi, ambil, ringkasan] = await Promise.all([
      panggil("GET", "/api/sesi"),
      panggil("GET", "/api/ambil"),
      panggil("GET", "/api/kawasan/[id]/ringkasan", { params: { id: "mockkws000001" }, kueri: { periode: "2026-10" } }),
    ]);
    const ringkas = <T,>(h: HasilApi<T>, f: (d: T) => string) => (h.ok ? f(h.data) : h.pesan);
    setHasil({
      "GET /api/sesi": ringkas(sesi, (d) => `${d.peran ?? "-"} · ${d.organisasiAktif?.nama ?? "-"}`),
      "GET /api/ambil": ringkas(ambil, (d) => `${d.serah.length} serah`),
      "GET /api/kawasan/[id]/ringkasan": ringkas(ringkasan, (d) => `${d.menungguSetuju} menunggu · ${d.peringatan.length} peringatan`),
    });
  }, []);
  useEffect(() => {
    void jalankan();
  }, [jalankan]);
  return (
    <Kartu>
      <ul className="flex flex-col gap-1 text-base" data-testid="uji-api">
        {Object.entries(hasil).map(([rute, nilai]) => (
          <li key={rute}>
            <code>{rute}</code>: <span>{nilai}</span>
          </li>
        ))}
      </ul>
    </Kartu>
  );
}

export function Galeri() {
  const [berat, setBerat] = useState("42,5");
  const [dialog, setDialog] = useState(false);
  const [tab, setTab] = useState("a");
  const [kamera, setKamera] = useState(false);
  const [pindai, setPindai] = useState(false);
  const [hasilQr, setHasilQr] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const gram = parseBeratKgKeGram(berat);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-4">
      <h1 className="text-3xl font-bold">{TEKS.APP_NAMA}</h1>
      <LabelDemo />

      <Bagian judul="Token">
        <div className="grid grid-cols-3 gap-2">
          {WARNA_TOKEN.map((w) => (
            <div key={w} className="rounded-kontrol border border-garis p-2 text-sm" data-token={w}>
              <div className="h-8 rounded-kontrol border border-garis-halus" style={{ background: `var(--color-${w})` }} />
              {w}
            </div>
          ))}
        </div>
      </Bagian>

      <Bagian judul="Aliran">
        <div className="flex flex-wrap gap-2">
          {ALIRAN.map((a) => (
            <LencanaAliran key={a} aliran={a} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {ALIRAN.map((a) => (
            <LencanaAliran key={a} aliran={a} pendek />
          ))}
        </div>
      </Bagian>

      <Bagian judul="Status">
        <div className="flex flex-wrap gap-2">
          {STATUS_SERAH.map((s) => (
            <LencanaStatus key={s} status={s} />
          ))}
        </div>
      </Bagian>

      <Bagian judul="Tombol">
        <div className="flex flex-wrap gap-2">
          <Tombol>{TEKS.UMUM_SIMPAN}</Tombol>
          <Tombol varian="sekunder">{TEKS.UMUM_BATAL}</Tombol>
          <Tombol disabled>{TEKS.UMUM_KIRIM}</Tombol>
        </div>
      </Bagian>

      <Bagian judul="Aturan">
        <PanelAturan
          aksi="TOLAK"
          kode="R01"
          teks={isi("ATURAN_R01", { aliran: TEKS.ALIRAN_HIJAU_PENDEK })}
          sumber="Pergub DKI Jakarta No. 102/2021 Ps. 20(2)(d)"
        />
        <PanelAturan aksi="PERINGATAN" kode="R06" teks={isi("ATURAN_R06", { kode_tps: "TPS-PCS-01", jam: 26 })} />
        <PanelAturan
          aksi="PRIORITAS"
          kode="R10"
          teks={isi("ATURAN_R10_PRAKIRAAN", {
            weather_desc: "Hujan Lebat",
            nama_kelurahan: "Kemayoran",
            jam_slot: "15:00",
            aliran: TEKS.ALIRAN_KUNING_PENDEK,
            kode_tps: "TPS-PCS-01",
            jam: 30,
          })}
        />
        <AtribusiBMKG />
      </Bagian>

      <Bagian judul="Galat & kosong">
        <BannerGalat pesan={TEKS.G_SERVER} onCoba={() => undefined} />
        <BannerGalat pesan={TEKS.G_OFFLINE} />
        <Kosong teks={TEKS.K_KOSONG_TPS} />
      </Bagian>

      <Bagian judul="Isian berat">
        <IsianBerat id="berat" nilai={berat} onUbah={setBerat} salah={berat !== "" && gram === null} />
        <p data-testid="gram">{gram === null ? "-" : `${gram} g = ${isi("UMUM_KG", { nilai: formatGramKeKg(gram) })}`}</p>
      </Bagian>

      <Bagian judul="Tabel">
        <Tabel
          keterangan={TEKS.LAPORAN_TOTAL}
          kunciBaris={(b) => b.aliran}
          baris={ALIRAN.map((aliran, i) => ({ aliran, g: (i + 1) * 12_500 }))}
          kolom={[
            { kunci: "aliran", judul: TEKS.KOL_ALIRAN, sel: (b) => <LencanaAliran aliran={b.aliran} pendek /> },
            { kunci: "g", judul: TEKS.KOL_BERAT_TPS, angka: true, sel: (b) => isi("UMUM_KG", { nilai: formatGramKeKg(b.g) }) },
          ]}
        />
      </Bagian>

      <Bagian judul="Tab & dialog">
        <Tab
          aktif={tab}
          onPilih={setTab}
          item={[
            { kunci: "a", judul: TEKS.LAPORAN_KAWASAN, isi: <p>{TEKS.LAPORAN_KAWASAN}</p> },
            { kunci: "b", judul: TEKS.LAPORAN_PENGANGKUT, isi: <p>{TEKS.LAPORAN_PENGANGKUT}</p> },
            { kunci: "c", judul: TEKS.LAPORAN_PENERIMA, isi: <p>{TEKS.LAPORAN_PENERIMA}</p> },
          ]}
        />
        <Tombol varian="sekunder" onClick={() => setDialog(true)}>
          {TEKS.UMUM_KONFIRMASI}
        </Tombol>
        <Dialog terbuka={dialog} judul={TEKS.UMUM_KONFIRMASI} onTutup={() => setDialog(false)}>
          <p>{TEKS.UMUM_ALASAN}</p>
        </Dialog>
      </Bagian>

      <Bagian judul="Kamera & QR">
        <QrTampil isi="SERAH-CONTOH-QR" label={TEKS.T2_QR_PETUNJUK} lebarPx={200} />
        <div className="flex flex-wrap gap-2">
          <Tombol onClick={() => setKamera((v) => !v)}>{TEKS.A2_FOTO}</Tombol>
          <Tombol varian="sekunder" onClick={() => setPindai((v) => !v)}>
            {TEKS.T1_PINDAI}
          </Tombol>
        </div>
        {kamera ? (
          <KameraFoto
            petunjuk={TEKS.A2_FOTO_PETUNJUK}
            labelAmbil={TEKS.A2_FOTO}
            onFoto={(b) => {
              setFoto(`${b.type} · ${b.size} byte`);
              setKamera(false);
            }}
          />
        ) : null}
        {pindai ? (
          <PemindaiQr
            petunjuk={TEKS.T1_PINDAI_PETUNJUK}
            onHasil={(t) => {
              setHasilQr(t);
              setPindai(false);
            }}
          />
        ) : null}
        {foto ? <p data-testid="foto">{foto}</p> : null}
        {hasilQr ? <p data-testid="hasil-qr">{hasilQr}</p> : null}
      </Bagian>

      <Bagian judul="API mock">
        <UjiApi />
      </Bagian>
    </div>
  );
}
