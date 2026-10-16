"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Kendaraan } from "@serah/kontrak";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Dialog } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { IkonLanding } from "@/lib/klien/komponen/ikon-landing";
import { IkonNav } from "@/lib/klien/komponen/ikon-nav";
import { KonfirmasiAksi } from "@/lib/klien/komponen/konfirmasi-aksi";
import { useModalHasil } from "@/lib/klien/komponen/modal-hasil";
import { RangkaHalaman } from "@/lib/klien/komponen/rangka";
import { StripKpi } from "@/lib/klien/komponen/viz";

/** Pelat nomor bergaya: bingkai tebal, huruf mono, strip biru di kiri. */
function Pelat({ teks, redup = false, besar = false }: { teks: string; redup?: boolean; besar?: boolean }) {
  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded-xl border-2 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)] ${
        redup ? "border-garis-halus opacity-60" : "border-tinta"
      }`}
    >
      <span aria-hidden="true" className={`flex w-2.5 items-end justify-center bg-aksi ${besar ? "w-3" : ""}`} />
      <span
        className={`px-3.5 py-1.5 text-center font-mono font-semibold uppercase tracking-[0.16em] text-tinta ${
          besar ? "min-w-[11rem] text-2xl" : "text-lg"
        }`}
      >
        {teks || "—"}
      </span>
    </span>
  );
}

export default function HalamanKendaraan() {
  const [daftarKendaraan, setDaftarKendaraan] = useState<Kendaraan[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const [plat, setPlat] = useState("");
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [konfirmasiTambah, setKonfirmasiTambah] = useState(false);
  const [nonaktifTarget, setNonaktifTarget] = useState<Kendaraan | null>(null);
  const [sedangNonaktif, setSedangNonaktif] = useState(false);
  const { sukses, galat: tampilGalat, modal } = useModalHasil();

  const muat = useCallback(async () => {
    setSedangMuat(true);
    setGalat(null);
    const r = await panggil("GET", "/api/kendaraan", {});
    setSedangMuat(false);
    if (r.ok) {
      setDaftarKendaraan(r.data.kendaraan);
    } else {
      setGalat(r.pesan);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  function mintaKonfirmasiTambah(e: FormEvent) {
    e.preventDefault();
    if (plat.trim() === "") return;
    setKonfirmasiTambah(true);
  }

  async function tanganiTambah() {
    setSedangSimpan(true);
    setGalat(null);

    const res = await panggil("POST", "/api/kendaraan", {
      body: { plat: plat.trim().toUpperCase() },
    });

    setSedangSimpan(false);
    setKonfirmasiTambah(false);

    if (res.ok) {
      setTambahTerbuka(false);
      setPlat("");
      sukses(TEKS.UMUM_TERSIMPAN);
      await muat();
    } else {
      tampilGalat(res.pesan, () => setKonfirmasiTambah(true));
    }
  }

  async function tanganiNonaktif(id: string) {
    setGalat(null);
    setSedangNonaktif(true);
    const res = await panggil("POST", "/api/kendaraan/[id]/nonaktif", {
      params: { id },
      body: {},
    });
    setSedangNonaktif(false);
    setNonaktifTarget(null);

    if (res.ok) {
      sukses(TEKS.KND_NONAKTIF);
      await muat();
    } else {
      tampilGalat(res.pesan, () => setNonaktifTarget(nonaktifTarget));
    }
  }

  const aktif = daftarKendaraan.filter((k) => k.aktif);
  const nonaktif = daftarKendaraan.filter((k) => !k.aktif);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS.KND_JUDUL}</h1>
          {daftarKendaraan.length > 0 ? (
            <span className="rounded-full bg-latar px-2.5 py-0.5 text-xs font-semibold tabular-nums text-tinta-redup">{daftarKendaraan.length}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setTambahTerbuka(true)}
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-aksi px-5 text-sm font-medium text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover active:translate-y-0 active:scale-[0.98]"
        >
          <IkonNav nama="tambah" className="h-5 w-5" />
          {TEKS.KND_TAMBAH}
        </button>
      </div>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {sedangMuat ? <RangkaHalaman jumlah={2} /> : null}
      {modal}

      {!sedangMuat && daftarKendaraan.length > 0 ? (
        <section className="muncul rounded-3xl border border-garis-halus bg-kertas p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <StripKpi
            item={[
              { kunci: "aktif", label: TEKS.LGN_STATUS_AKTIF, nilai: aktif.length, nada: "baik" },
              { kunci: "nonaktif", label: TEKS.KND_NONAKTIF, nilai: nonaktif.length, nada: "netral" },
            ]}
          />
        </section>
      ) : null}

      {!sedangMuat && daftarKendaraan.length === 0 && !galat ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-garis-halus bg-latar/50 px-6 py-14 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
            <IkonLanding nama="truk" className="h-9 w-9" />
          </span>
          <div>
            <p className="text-base font-semibold text-tinta">{TEKS.KND_KOSONG_JUDUL}</p>
            <p className="mt-1 text-sm text-tinta-redup">{TEKS.KND_KOSONG_ISI}</p>
          </div>
          <button
            type="button"
            onClick={() => setTambahTerbuka(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-aksi px-5 text-sm font-medium text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all hover:-translate-y-0.5 hover:bg-aksi-hover"
          >
            <IkonNav nama="tambah" className="h-5 w-5" />
            {TEKS.KND_TAMBAH}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[...aktif, ...nonaktif].map((k) => (
          <article
            key={k.id}
            className={`muncul group flex flex-col gap-4 rounded-3xl border p-5 transition-all duration-300 ${
              k.aktif
                ? "border-garis-halus bg-kertas shadow-[0_8px_30px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.12)]"
                : "border-garis-halus/70 bg-latar/50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                aria-hidden="true"
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${k.aktif ? "bg-aksi-latar" : "bg-white opacity-60"}`}
              >
                <IkonLanding nama="truk" className="h-7 w-7" />
              </span>
              {k.aktif ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                  {TEKS.LGN_STATUS_AKTIF}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-tinta-redup ring-1 ring-inset ring-garis-halus">
                  <span className="h-1.5 w-1.5 rounded-full bg-garis" aria-hidden="true" />
                  {TEKS.KND_NONAKTIF}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <Pelat teks={k.plat} redup={!k.aktif} />
              {k.aktif ? (
                <button
                  type="button"
                  onClick={() => setNonaktifTarget(k)}
                  aria-label={`${TEKS.KND_NONAKTIF} ${k.plat}`}
                  title={TEKS.KND_NONAKTIF}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-latar text-tinta-redup transition-all duration-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
                >
                  <IkonNav nama="daya" className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <Dialog terbuka={tambahTerbuka} judul={TEKS.KND_TAMBAH} onTutup={() => setTambahTerbuka(false)}>
        <form onSubmit={mintaKonfirmasiTambah} className="flex flex-col gap-5">
          <div className="flex justify-center rounded-2xl bg-latar p-5">
            <Pelat teks={plat.trim() || "B 1234 ABC"} besar redup={plat.trim() === ""} />
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium text-tinta">
            {TEKS.KND_PLAT}
            <input
              type="text"
              required
              autoFocus
              autoComplete="off"
              placeholder="B 1234 ABC"
              value={plat}
              onChange={(e) => setPlat(e.target.value)}
              className="min-h-14 rounded-2xl border border-garis-halus bg-kertas px-4 text-center font-mono text-xl font-semibold uppercase tracking-[0.15em] text-tinta transition-all placeholder:text-garis hover:border-garis focus:border-aksi focus:outline-none focus:ring-4 focus:ring-aksi/15"
            />
          </label>
          <button
            type="submit"
            disabled={sedangSimpan || plat.trim() === ""}
            className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-aksi text-base font-semibold text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {TEKS.UMUM_SIMPAN}
          </button>
        </form>
      </Dialog>

      <KonfirmasiAksi
        terbuka={konfirmasiTambah}
        judul={TEKS.KND_TAMBAH}
        labelKonfirmasi={TEKS.UMUM_SIMPAN}
        sibuk={sedangSimpan}
        onKonfirmasi={() => void tanganiTambah()}
        onTutup={() => setKonfirmasiTambah(false)}
      >
        <div className="flex justify-center">
          <Pelat teks={plat.trim().toUpperCase()} besar />
        </div>
        <p className="mt-3 text-center text-xs text-tinta-redup">{TEKS.KONF_TAMBAH_KND}</p>
      </KonfirmasiAksi>

      <KonfirmasiAksi
        terbuka={nonaktifTarget !== null}
        judul={TEKS.KND_NONAKTIF}
        tingkat="tahan"
        bahaya
        labelKonfirmasi={TEKS.KND_NONAKTIF}
        sibuk={sedangNonaktif}
        onKonfirmasi={() => nonaktifTarget && void tanganiNonaktif(nonaktifTarget.id)}
        onTutup={() => setNonaktifTarget(null)}
      >
        <div className="flex justify-center">
          <Pelat teks={nonaktifTarget?.plat ?? ""} besar />
        </div>
        <p className="mt-3 text-center text-xs text-tinta-redup">{TEKS.KONF_NONAKTIF_KND}</p>
      </KonfirmasiAksi>
    </div>
  );
}
