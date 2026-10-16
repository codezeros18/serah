"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { z } from "zod";
import type { AkunDataSayaKeluaran, AnggotaDaftarKeluaran, Peran } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Dialog, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { rutePeran } from "@/lib/klien/rute-peran";
import { useSesi } from "@/lib/klien/sesi";
import { unduhBerkas } from "@/lib/klien/unduh";
import { Pilih } from "@/lib/klien/komponen/pilih";
import { KonfirmasiAksi } from "@/lib/klien/komponen/konfirmasi-aksi";
import { IkonLanding, type NamaIkon } from "@/lib/klien/komponen/ikon-landing";
import { IkonNav, type NamaIkonNav } from "@/lib/klien/komponen/ikon-nav";
import { LegendaIkon } from "@/lib/klien/komponen/legenda-ikon";
import { Rangka } from "@/lib/klien/komponen/rangka";

type DataSaya = z.infer<typeof AkunDataSayaKeluaran>;
type ItemAnggota = z.infer<typeof AnggotaDaftarKeluaran>["anggota"][number];

const IKON_PERAN: Record<string, NamaIkon> = {
  PETUGAS: "tps",
  PENGANGKUT: "truk",
  PENGELOLA: "laporan",
  PENERIMA: "timbang",
  ADMIN: "aturan",
};

function Kelompok({ judul, aksi, children }: { judul: string; aksi?: ReactNode; children: ReactNode }) {
  return (
    <section className="muncul flex flex-col gap-2" aria-label={judul}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tinta-redup">{judul}</h2>
        {aksi}
      </div>
      <div className="divide-y divide-garis-halus/70 overflow-hidden rounded-3xl border border-garis-halus bg-kertas shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        {children}
      </div>
    </section>
  );
}

function BarisMenu({
  ikon,
  judul,
  deskripsi,
  kanan,
  onClick,
  href,
  bahaya = false,
  aktif = false,
}: {
  ikon: NamaIkonNav;
  judul: string;
  deskripsi?: string;
  kanan?: ReactNode;
  onClick?: () => void;
  href?: string;
  bahaya?: boolean;
  aktif?: boolean;
}) {
  const isi = (
    <>
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
          bahaya ? "bg-rose-50 text-rose-600" : aktif ? "bg-aksi text-white" : "bg-latar text-tinta-redup group-hover:bg-white group-hover:text-aksi"
        }`}
      >
        <IkonNav nama={ikon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium ${bahaya ? "text-rose-700" : "text-tinta"}`}>{judul}</span>
        {deskripsi ? <span className="block truncate text-xs text-tinta-redup">{deskripsi}</span> : null}
      </span>
      {kanan ?? (
        <IkonNav nama="chevron" className="h-4 w-4 shrink-0 text-tinta-redup transition-transform duration-200 group-hover:translate-x-0.5" />
      )}
    </>
  );
  const kelas = "group flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-200 hover:bg-aksi-latar/40";
  if (href) return <Link href={href} className={kelas}>{isi}</Link>;
  return (
    <button type="button" onClick={onClick} className={kelas}>
      {isi}
    </button>
  );
}

/** Saklar geser: <input type="checkbox"> asli bergaya sakelar. */
function Saklar({ id, label, ikon, nilai, onUbah }: { id: string; label: string; ikon: NamaIkonNav; nilai: boolean; onUbah: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="group flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 transition-colors duration-200 hover:bg-aksi-latar/40">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-latar text-tinta-redup transition-colors group-hover:bg-white group-hover:text-aksi">
        <IkonNav nama={ikon} className="h-5 w-5" />
      </span>
      <span className="flex-1 text-sm font-medium text-tinta">{label}</span>
      <input id={id} type="checkbox" role="switch" checked={nilai} onChange={(e) => onUbah(e.target.checked)} className="saklar" />
    </label>
  );
}

export default function HalamanAkun() {
  const router = useRouter();
  const { keadaan, muatUlang } = useSesi();

  const [dataSaya, setDataSaya] = useState<DataSaya | null>(null);
  const [daftarAnggota, setDaftarAnggota] = useState<ItemAnggota[]>([]);
  const [ntfEmail, setNtfEmail] = useState(true);
  const [ntfPush, setNtfPush] = useState(false);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  // Dialog undang anggota
  const [undangTerbuka, setUndangTerbuka] = useState(false);
  const [emailUndang, setEmailUndang] = useState("");
  const [peranUndang, setPeranUndang] = useState<"PETUGAS" | "PENGELOLA" | "PENGANGKUT" | "PENERIMA">("PETUGAS");
  const [sedangUndang, setSedangUndang] = useState(false);

  // Konfirmasi nonaktifkan anggota
  const [anggotaNonaktif, setAnggotaNonaktif] = useState<ItemAnggota | null>(null);
  const [sedangNonaktifAnggota, setSedangNonaktifAnggota] = useState(false);

  // Dialog tarik persetujuan
  const [tarikTerbuka, setTarikTerbuka] = useState(false);
  const [sedangTarik, setSedangTarik] = useState(false);

  // Dialog hapus akun
  const [hapusTerbuka, setHapusTerbuka] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState("");
  const [sedangHapus, setSedangHapus] = useState(false);

  const muat = useCallback(async () => {
    setSedangMuat(true);
    setGalat(null);

    const [rData, rNtf, rAnggota] = await Promise.all([
      panggil("GET", "/api/akun/data-saya", {}),
      panggil("GET", "/api/akun/notifikasi", {}),
      panggil("GET", "/api/anggota", {}),
    ]);

    setSedangMuat(false);

    if (rData.ok) {
      setDataSaya(rData.data);
    } else {
      setGalat(rData.pesan);
    }

    if (rNtf.ok && rNtf.data.preferensi[0]) {
      setNtfEmail(rNtf.data.preferensi[0].email);
      setNtfPush(rNtf.data.preferensi[0].push);
    }

    if (rAnggota.ok) {
      setDaftarAnggota(rAnggota.data.anggota);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function gantiOrganisasiPeran(organisasiId: string, peran: Peran) {
    setGalat(null);
    const res = await panggil("POST", "/api/sesi/organisasi", {
      body: { organisasiId, peran },
    });

    if (res.ok) {
      muatUlang();
      router.push(rutePeran(peran));
    } else {
      setGalat(res.pesan);
    }
  }

  async function ubahNotifikasi(email: boolean, push: boolean) {
    setNtfEmail(email);
    setNtfPush(push);
    if (!dataSaya || !keadaan || keadaan.status !== "siap" || !keadaan.sesi.organisasiAktif) return;

    await panggil("PUT", "/api/akun/notifikasi", {
      body: {
        organisasiId: keadaan.sesi.organisasiAktif.id,
        email,
        push,
      },
    });
  }

  async function tanganiUndang(e: FormEvent) {
    e.preventDefault();
    setSedangUndang(true);
    setGalat(null);
    setPesanSukses(null);

    const res = await panggil("POST", "/api/undangan", {
      body: {
        email: emailUndang,
        peran: peranUndang,
      },
    });

    setSedangUndang(false);

    if (res.ok) {
      setUndangTerbuka(false);
      setEmailUndang("");
      setPesanSukses(TEKS.AGT_UNDANGAN_TERKIRIM);
      await muat();
    } else {
      setGalat(res.pesan);
    }
  }

  async function tanganiNonaktifAnggota(id: string) {
    setGalat(null);
    const res = await panggil("POST", "/api/anggota/[id]/nonaktif", {
      params: { id },
      body: {},
    });

    if (res.ok) {
      await muat();
    } else {
      setGalat(res.pesan);
    }
  }

  async function tanganiUnduhData() {
    setGalat(null);
    const res = await unduhBerkas("/api/akun/data-saya", { namaCadangan: "data-saya-serah.json" });
    if (!res.ok) setGalat(res.pesan);
  }

  async function tanganiTarikPersetujuan() {
    setSedangTarik(true);
    setGalat(null);
    const res = await panggil("POST", "/api/akun/tarik-persetujuan", { body: {} });
    setSedangTarik(false);

    if (res.ok) {
      router.push("/masuk");
    } else {
      setGalat(res.pesan);
    }
  }

  async function tanganiHapusAkun(e: FormEvent) {
    e.preventDefault();
    if (konfirmasiHapus !== "HAPUS") return;

    setSedangHapus(true);
    setGalat(null);
    const res = await panggil("POST", "/api/akun/hapus", {
      body: { konfirmasi: "HAPUS" },
    });
    setSedangHapus(false);

    if (res.ok) {
      router.push("/masuk");
    } else {
      setGalat(res.pesan);
    }
  }

  const sesi = keadaan.status === "siap" ? keadaan.sesi : null;

  const peranAktif = sesi?.peran ?? null;
  const ikonPeran: NamaIkon = (peranAktif && IKON_PERAN[peranAktif]) || "aturan";
  const anggotaAktif = daftarAnggota.filter((a) => a.aktif).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 text-tinta">
      <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS.AKUN_JUDUL}</h1>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {pesanSukses ? (
        <div role="status" className="flex items-center gap-2 rounded-2xl border border-status-selesai/20 bg-status-selesai-latar p-4 text-sm font-medium text-status-selesai">
          <span aria-hidden="true">✓</span>
          <span>{pesanSukses}</span>
        </div>
      ) : null}
      {sedangMuat ? (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">{TEKS.UMUM_MUAT}</span>
          <Rangka className="h-28 w-full rounded-3xl" />
          <Rangka className="h-40 w-full rounded-3xl" />
        </div>
      ) : null}

      {/* Kartu profil */}
      {sesi ? (
        <section className="muncul flex items-center gap-4 rounded-3xl border border-white/70 bg-gradient-to-br from-white via-white to-aksi-latar/60 p-5 shadow-[0_12px_40px_rgba(36,87,197,0.10)] ring-1 ring-garis-halus/70">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_6px_20px_rgba(15,23,42,0.10)]">
            <IkonLanding nama={ikonPeran} className="h-9 w-9" />
            <span aria-hidden="true" className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold tracking-tight text-tinta">{sesi.organisasiAktif?.nama ?? "-"}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-aksi-latar px-2.5 py-0.5 text-xs font-semibold text-aksi ring-1 ring-inset ring-aksi/20">
                {sesi.peran ?? "-"}
              </span>
              <span className="text-xs text-tinta-redup">{TEKS.AKUN_PERAN_AKTIF}</span>
            </div>
          </div>
        </section>
      ) : null}

      {/* Ganti organisasi / peran */}
      {dataSaya && dataSaya.keanggotaan.filter((k) => k.aktif).length > 0 ? (
        <Kelompok judul={TEKS.AKUN_GANTI_PERAN}>
          {dataSaya.keanggotaan
            .filter((k) => k.aktif)
            .map((k) => {
              const adalahAktif = sesi?.organisasiAktif?.id === k.organisasiId && sesi?.peran === k.peran;
              return (
                <button
                  key={`${k.organisasiId}-${k.peran}`}
                  type="button"
                  disabled={adalahAktif}
                  onClick={() => void gantiOrganisasiPeran(k.organisasiId, k.peran)}
                  className={`group flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-200 ${
                    adalahAktif ? "bg-aksi-latar/40" : "hover:bg-aksi-latar/40"
                  }`}
                >
                  <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${adalahAktif ? "bg-white" : "bg-latar group-hover:bg-white"}`}>
                    <IkonLanding nama={IKON_PERAN[k.peran] ?? "aturan"} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-tinta">{k.organisasiNama}</span>
                    <span className="block text-xs text-tinta-redup">{k.peran}</span>
                  </span>
                  {adalahAktif ? (
                    <span className="rounded-full bg-aksi px-2.5 py-0.5 text-[11px] font-semibold text-white">Aktif</span>
                  ) : (
                    <IkonNav nama="chevron" className="h-4 w-4 text-tinta-redup transition-transform duration-200 group-hover:translate-x-0.5" />
                  )}
                </button>
              );
            })}
        </Kelompok>
      ) : null}

      {/* Notifikasi */}
      <Kelompok judul={TEKS.AKUN_NOTIFIKASI}>
        <Saklar id="ntf-email" label={TEKS.AKUN_NTF_EMAIL} ikon="laporan" nilai={ntfEmail} onUbah={(v) => void ubahNotifikasi(v, ntfPush)} />
        <Saklar id="ntf-push" label={TEKS.AKUN_NTF_PUSH} ikon="lonceng" nilai={ntfPush} onUbah={(v) => void ubahNotifikasi(ntfEmail, v)} />
      </Kelompok>

      {/* Anggota organisasi */}
      {sesi?.organisasiAktif ? (
        <Kelompok
          judul={`${TEKS.AGT_JUDUL} · ${anggotaAktif}`}
          aksi={
            <button
              type="button"
              onClick={() => setUndangTerbuka(true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-aksi px-3 text-xs font-medium text-white shadow-[0_6px_16px_rgba(36,87,197,0.28)] transition-all hover:-translate-y-0.5 hover:bg-aksi-hover"
            >
              <IkonNav nama="tambah" className="h-4 w-4" />
              {TEKS.AGT_UNDANG}
            </button>
          }
        >
          {daftarAnggota.map((a) => (
            <div key={a.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.aktif ? "bg-latar" : "bg-latar opacity-50"}`}>
                <IkonLanding nama={IKON_PERAN[a.peran] ?? "aturan"} className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-tinta">{a.peran}</span>
                <span className="block text-xs text-tinta-redup">{isi("AGT_SEJAK", { tanggal: a.sejak.slice(0, 10) })}</span>
              </span>
              {a.aktif ? (
                <button
                  type="button"
                  onClick={() => setAnggotaNonaktif(a)}
                  aria-label={TEKS.AGT_NONAKTIF}
                  title={TEKS.AGT_NONAKTIF}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-latar text-tinta-redup transition-all duration-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
                >
                  <IkonNav nama="daya" className="h-5 w-5" />
                </button>
              ) : (
                <span className="rounded-full bg-latar px-2.5 py-1 text-xs font-medium text-tinta-redup">{TEKS.KND_NONAKTIF}</span>
              )}
            </div>
          ))}
        </Kelompok>
      ) : null}

      {/* Privasi */}
      <Kelompok judul={TEKS.AKUN_PRIVASI}>
        <BarisMenu ikon="unduh" judul={TEKS.AKUN_UNDUH_DATA} onClick={() => void tanganiUnduhData()} />
        <BarisMenu ikon="perisai" judul={TEKS.AKUN_TARIK} onClick={() => setTarikTerbuka(true)} />
        <BarisMenu ikon="sampah" judul={TEKS.AKUN_HAPUS} bahaya onClick={() => setHapusTerbuka(true)} />
      </Kelompok>

      {/* Bantuan & dokumentasi */}
      <Kelompok judul={TEKS.AKUN_BANTUAN}>
        <LegendaIkon varian="baris" />
        <BarisMenu ikon="buku" judul={TEKS.TENTANG_JUDUL} href="/#tentang" />
        <BarisMenu ikon="perisai" judul={TEKS.PRIV_JUDUL} href="/privasi" />
        <BarisMenu ikon="laporan" judul={TEKS.SYR_JUDUL} href="/syarat" />
      </Kelompok>

      {/* Konfirmasi nonaktifkan anggota (tahan) */}
      <KonfirmasiAksi
        terbuka={anggotaNonaktif !== null}
        judul={TEKS.AGT_NONAKTIF}
        tingkat="tahan"
        bahaya
        labelKonfirmasi={TEKS.AGT_NONAKTIF}
        sibuk={sedangNonaktifAnggota}
        onKonfirmasi={async () => {
          if (!anggotaNonaktif) return;
          setSedangNonaktifAnggota(true);
          await tanganiNonaktifAnggota(anggotaNonaktif.id);
          setSedangNonaktifAnggota(false);
          setAnggotaNonaktif(null);
        }}
        onTutup={() => setAnggotaNonaktif(null)}
      >
        <p className="text-sm font-medium text-tinta">{anggotaNonaktif?.peran}</p>
      </KonfirmasiAksi>

      {/* Dialog Undang Anggota */}
      <Dialog
        terbuka={undangTerbuka}
        judul={TEKS.AGT_UNDANG}
        onTutup={() => setUndangTerbuka(false)}
      >
        <form onSubmit={tanganiUndang} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-tinta">
            {TEKS.AGT_EMAIL}
            <input
              type="email"
              required
              value={emailUndang}
              onChange={(e) => setEmailUndang(e.target.value)}
              className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3.5 text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-tinta">
            {TEKS.AGT_PERAN}
            <Pilih
              value={peranUndang}
              onChange={(e) =>
                setPeranUndang(
                  e.target.value as "PETUGAS" | "PENGELOLA" | "PENGANGKUT" | "PENERIMA",
                )
              }
            >
              <option value="PETUGAS">PETUGAS</option>
              <option value="PENGELOLA">PENGELOLA</option>
              <option value="PENGANGKUT">PENGANGKUT</option>
              <option value="PENERIMA">PENERIMA</option>
            </Pilih>
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <Tombol
              varian="sekunder"
              onClick={() => setUndangTerbuka(false)}
              disabled={sedangUndang}
              className="text-xs font-bold"
            >
              {TEKS.UMUM_BATAL}
            </Tombol>
            <Tombol
              type="submit"
              disabled={sedangUndang}
              className="text-xs font-bold bg-aksi hover:bg-aksi-hover text-white shadow-sm"
            >
              {TEKS.UMUM_KIRIM}
            </Tombol>
          </div>
        </form>
      </Dialog>

      {/* Tarik persetujuan: tahan untuk konfirmasi */}
      <KonfirmasiAksi
        terbuka={tarikTerbuka}
        judul={TEKS.AKUN_TARIK}
        tingkat="tahan"
        bahaya
        labelKonfirmasi={TEKS.UMUM_KONFIRMASI}
        sibuk={sedangTarik}
        onKonfirmasi={() => void tanganiTarikPersetujuan()}
        onTutup={() => setTarikTerbuka(false)}
      >
        <p className="text-sm leading-relaxed text-tinta">{TEKS.AKUN_TARIK_PERINGATAN}</p>
      </KonfirmasiAksi>

      {/* Dialog Hapus Akun */}
      <Dialog
        terbuka={hapusTerbuka}
        judul={TEKS.AKUN_HAPUS}
        onTutup={() => setHapusTerbuka(false)}
      >
        <form onSubmit={tanganiHapusAkun} className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-tinta">{TEKS.AKUN_HAPUS_PERINGATAN}</p>
          <input
            type="text"
            required
            placeholder="HAPUS"
            value={konfirmasiHapus}
            onChange={(e) => setKonfirmasiHapus(e.target.value)}
            className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3.5 font-mono text-base text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-2 focus:ring-aksi/20"
          />
          <div className="flex justify-end gap-2">
            <Tombol
              varian="sekunder"
              onClick={() => setHapusTerbuka(false)}
              disabled={sedangHapus}
              className="text-xs font-bold"
            >
              {TEKS.UMUM_BATAL}
            </Tombol>
            <Tombol
              type="submit"
              disabled={konfirmasiHapus !== "HAPUS" || sedangHapus}
              className="text-xs font-bold bg-gray-900 hover:bg-black text-white shadow-sm"
            >
              {TEKS.UMUM_HAPUS}
            </Tombol>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
