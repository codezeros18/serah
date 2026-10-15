"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, LencanaAliran, LencanaStatus, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { useMuat } from "@/lib/klien/muat";

/** K2 — pengelola menyetujui atau mengembalikan serah (alasan wajib saat mengembalikan). */
export default function LayarK2() {
  const { kode } = useParams<{ kode: string }>();
  const { keadaan, ulang } = useMuat(() => panggil("GET", "/api/serah/[kode]", { params: { kode } }));
  const [kembalikan, setKembalikan] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<"disetujui" | "dikembalikan" | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function setujui() {
    setSibuk(true);
    setGalat(null);
    const h = await panggil("POST", "/api/serah/[kode]/setujui", { params: { kode }, body: {}, idempotencyKey: crypto.randomUUID() });
    setSibuk(false);
    if (h.ok) setHasil("disetujui");
    else if (h.galat.kode === "KONFLIK_VERSI") {
      setGalat(h.pesan);
      void ulang();
    } else setGalat(h.pesan);
  }

  async function kirimKembalikan() {
    if (alasan.trim() === "") {
      setGalat(TEKS.UMUM_ALASAN_WAJIB);
      return;
    }
    setSibuk(true);
    setGalat(null);
    const h = await panggil("POST", "/api/serah/[kode]/kembalikan", {
      params: { kode },
      body: { alasan: alasan.trim() },
      idempotencyKey: crypto.randomUUID(),
    });
    setSibuk(false);
    if (h.ok) setHasil("dikembalikan");
    else setGalat(h.pesan);
  }

  const d = keadaan.status === "siap" ? keadaan.data : null;
  const muatanFoto = d?.foto.find((f) => f.jenis === "MUATAN");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-garis-halus pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/kawasan/setujui"
            className="inline-flex min-h-10 items-center justify-center rounded-kontrol border border-garis-halus bg-kertas px-3 text-sm font-semibold text-tinta transition-colors hover:bg-latar active:scale-[0.98]"
          >
            ← {TEKS.UMUM_KEMBALI}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">{isi("K2_JUDUL", { kode_serah: kode })}</h1>
        </div>
      </div>

      {keadaan.status === "memuat" ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}
      {keadaan.status === "galat" ? <BannerGalat pesan={keadaan.pesan} onCoba={() => void ulang()} /> : null}

      {d ? (
        <Kartu className="flex flex-col gap-4 border-l-4 border-l-aksi">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-garis-halus pb-3">
            <LencanaStatus status={d.status} />
            <div className="flex flex-wrap gap-2">
              {d.aliran.map((a) => (
                <LencanaAliran key={a} aliran={a} />
              ))}
            </div>
          </div>

          <div className="rounded-kontrol border border-garis-halus bg-latar/50 p-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm sm:text-base">
              <dt className="font-semibold text-tinta-redup">{TEKS.A2_KENDARAAN}</dt>
              <dd className="font-mono font-bold text-tinta">{d.kendaraan?.plat ?? "-"}</dd>
              <dt className="font-semibold text-tinta-redup">{TEKS.A2_PENERIMA}</dt>
              <dd className="font-medium text-tinta">{d.penerima?.nama ?? "-"}</dd>
              <dt className="font-semibold text-tinta-redup">{TEKS.KOL_PENGANGKUT}</dt>
              <dd className="font-medium text-tinta">{d.pengangkut?.nama ?? "-"}</dd>
            </dl>
          </div>

          {muatanFoto ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-tinta-redup">{TEKS.A2_FOTO}</span>
              <div className="overflow-hidden rounded-kontrol border border-garis-halus bg-latar/30 p-2">
                <img
                  src={muatanFoto.url}
                  alt={TEKS.A2_FOTO}
                  className="max-h-72 w-full rounded-kontrol object-contain"
                />
              </div>
            </div>
          ) : null}
        </Kartu>
      ) : null}

      {galat ? <BannerGalat pesan={galat} /> : null}

      {hasil === "disetujui" ? (
        <div className="rounded-kartu border border-status-selesai/30 bg-status-selesai-latar p-5 text-center">
          <p role="status" className="text-lg font-bold text-status-selesai">
            {`✓ ${isi("K2_DISETUJUI", { kode_serah: kode })}`}
          </p>
        </div>
      ) : null}
      {hasil === "dikembalikan" ? (
        <div className="rounded-kartu border border-status-tolak/30 bg-status-tolak-latar p-5 text-center">
          <p role="status" className="text-lg font-bold text-status-tolak">
            {TEKS.K2_KEMBALIKAN}
          </p>
        </div>
      ) : null}

      {d && hasil === null ? (
        <div className="flex flex-col gap-4 rounded-kartu border border-garis-halus bg-kertas p-5 shadow-xs">
          <p className="text-base text-tinta-redup">{TEKS.K2_PENJELASAN}</p>
          {d.status !== "MENUNGGU_SETUJU" ? null : (
            <div className="flex flex-col gap-3">
              <Tombol onClick={() => void setujui()} disabled={sibuk} className="w-full text-base">
                {`✓ ${TEKS.K2_SETUJUI}`}
              </Tombol>
              {!kembalikan ? (
                <Tombol varian="sekunder" onClick={() => setKembalikan(true)} className="w-full text-base">
                  {TEKS.K2_KEMBALIKAN}
                </Tombol>
              ) : (
                <div className="flex flex-col gap-3 rounded-kontrol border border-garis-halus bg-latar/40 p-4">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="alasan" className="text-base font-semibold text-tinta">
                      {TEKS.UMUM_ALASAN}
                    </label>
                    <p className="text-xs text-tinta-redup">{TEKS.K2_KEMBALIKAN_PETUNJUK}</p>
                  </div>
                  <textarea
                    id="alasan"
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    rows={3}
                    className="min-h-24 rounded-kontrol border-2 border-garis-halus bg-kertas p-3 text-base text-tinta transition-colors focus:border-aksi focus:outline-none"
                  />
                  <Tombol varian="sekunder" onClick={() => void kirimKembalikan()} disabled={sibuk}>
                    {TEKS.K2_KEMBALIKAN}
                  </Tombol>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
