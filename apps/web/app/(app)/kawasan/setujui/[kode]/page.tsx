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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{isi("K2_JUDUL", { kode_serah: kode })}</h1>
      {keadaan.status === "memuat" ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}
      {keadaan.status === "galat" ? <BannerGalat pesan={keadaan.pesan} onCoba={() => void ulang()} /> : null}

      {d ? (
        <Kartu className="flex flex-col gap-3">
          <LencanaStatus status={d.status} />
          <div className="flex flex-wrap gap-2">
            {d.aliran.map((a) => (
              <LencanaAliran key={a} aliran={a} />
            ))}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
            <dt className="font-semibold">{TEKS.A2_KENDARAAN}</dt>
            <dd>{d.kendaraan?.plat ?? "-"}</dd>
            <dt className="font-semibold">{TEKS.A2_PENERIMA}</dt>
            <dd>{d.penerima?.nama ?? "-"}</dd>
            <dt className="font-semibold">{TEKS.KOL_PENGANGKUT}</dt>
            <dd>{d.pengangkut?.nama ?? "-"}</dd>
          </dl>
          {muatanFoto ? (
            <img src={muatanFoto.url} alt={TEKS.A2_FOTO} className="max-h-64 w-full rounded-kontrol border border-garis-halus object-contain" />
          ) : null}
        </Kartu>
      ) : null}

      {galat ? <BannerGalat pesan={galat} /> : null}

      {hasil === "disetujui" ? (
        <p role="status" className="text-lg font-semibold">
          {isi("K2_DISETUJUI", { kode_serah: kode })}
        </p>
      ) : null}
      {hasil === "dikembalikan" ? (
        <p role="status" className="text-lg font-semibold">
          {TEKS.K2_KEMBALIKAN}
        </p>
      ) : null}

      {d && hasil === null ? (
        <>
          <p className="text-base">{TEKS.K2_PENJELASAN}</p>
          {d.status !== "MENUNGGU_SETUJU" ? null : (
            <div className="flex flex-col gap-3">
              <Tombol onClick={() => void setujui()} disabled={sibuk}>
                {TEKS.K2_SETUJUI}
              </Tombol>
              {!kembalikan ? (
                <Tombol varian="sekunder" onClick={() => setKembalikan(true)}>
                  {TEKS.K2_KEMBALIKAN}
                </Tombol>
              ) : (
                <div className="flex flex-col gap-2">
                  <label htmlFor="alasan" className="text-base font-semibold">
                    {TEKS.UMUM_ALASAN}
                  </label>
                  <p className="text-sm text-tinta-redup">{TEKS.K2_KEMBALIKAN_PETUNJUK}</p>
                  <textarea
                    id="alasan"
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    rows={3}
                    className="rounded-kontrol border-2 border-garis bg-kertas p-3 text-base"
                  />
                  <Tombol varian="sekunder" onClick={() => void kirimKembalikan()} disabled={sibuk}>
                    {TEKS.K2_KEMBALIKAN}
                  </Tombol>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}

      <Link href="/kawasan/setujui" className="inline-flex min-h-12 items-center text-base font-semibold underline">
        {TEKS.UMUM_KEMBALI}
      </Link>
    </div>
  );
}
