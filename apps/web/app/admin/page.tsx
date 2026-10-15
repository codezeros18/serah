"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type {
  AdminAturanDaftarKeluaran,
  AdminAuditKeluaran,
  AdminMetrikKeluaran,
  AdminOrganisasiDaftarKeluaran,
  AdminOrganisasiDetailKeluaran,
  AdminPaketDaftarKeluaran,
  AdminPembayaranKeluaran,
} from "@serah/kontrak";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Kosong, Tab, Tombol } from "@serah/ui";
import { formatBp } from "@serah/core/angka";
import { panggil } from "@/lib/klien/api";
import { DialogAlasan } from "@/lib/klien/komponen/dialog-alasan";

type OrgItem = z.infer<typeof AdminOrganisasiDaftarKeluaran>["organisasi"][number];
type OrgDetail = z.infer<typeof AdminOrganisasiDetailKeluaran>;
type TagihanAdmin = z.infer<typeof AdminPembayaranKeluaran>["tagihan"][number];
type PaketItem = z.infer<typeof AdminPaketDaftarKeluaran>["paket"][number];
type AturanItem = z.infer<typeof AdminAturanDaftarKeluaran>["aturan"][number];
type AuditItem = z.infer<typeof AdminAuditKeluaran>["audit"][number];
type MetrikItem = z.infer<typeof AdminMetrikKeluaran>;

type TabAdmin =
  | "organisasi"
  | "izin"
  | "pembayaran"
  | "paket"
  | "aturan"
  | "audit"
  | "metrik";

export default function HalamanAdmin() {
  const [tabAktif, setTabAktif] = useState<TabAdmin>("organisasi");
  const [sedangMuat, setSedangMuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [suksesPesan, setSuksesPesan] = useState<string | null>(null);

  // Data states
  const [daftarOrg, setDaftarOrg] = useState<OrgItem[]>([]);
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [targetDetailId, setTargetDetailId] = useState<string | null>(null);
  // Semua rute admin wajib X-Alasan (S21): alasan akses diminta sekali sebelum data dimuat; membuka detail
  // organisasi meminta alasannya sendiri.
  const [alasanAkses, setAlasanAkses] = useState<string | null>(null);
  const [tujuanDialog, setTujuanDialog] = useState<"akses" | "detail">("akses");
  const [dialogAlasanTerbuka, setDialogAlasanTerbuka] = useState(true);

  const [daftarTagihan, setDaftarTagihan] = useState<TagihanAdmin[]>([]);
  const [daftarPaket, setDaftarPaket] = useState<PaketItem[]>([]);
  const [daftarAturan, setDaftarAturan] = useState<AturanItem[]>([]);
  const [daftarAudit, setDaftarAudit] = useState<AuditItem[]>([]);
  const [metrik, setMetrik] = useState<MetrikItem | null>(null);

  const muatData = useCallback(async (alasan: string) => {
    setSedangMuat(true);
    setGalat(null);

    const [resOrg, resBayar, resPaket, resAturan, resAudit, resMetrik] =
      await Promise.all([
        panggil("GET", "/api/admin/organisasi", { alasan }),
        panggil("GET", "/api/admin/pembayaran", { alasan }),
        panggil("GET", "/api/admin/paket", { alasan }),
        panggil("GET", "/api/admin/aturan", { alasan }),
        panggil("GET", "/api/admin/audit", { alasan }),
        panggil("GET", "/api/admin/metrik", { alasan }),
      ]);

    setSedangMuat(false);
    if (!resOrg.ok) setGalat(resOrg.pesan);

    if (resOrg.ok) setDaftarOrg(resOrg.data.organisasi);
    if (resBayar.ok) setDaftarTagihan(resBayar.data.tagihan);
    if (resPaket.ok) setDaftarPaket(resPaket.data.paket);
    if (resAturan.ok) setDaftarAturan(resAturan.data.aturan);
    if (resAudit.ok) setDaftarAudit(resAudit.data.audit);
    if (resMetrik.ok) setMetrik(resMetrik.data);
  }, []);

  useEffect(() => {
    if (alasanAkses) void muatData(alasanAkses);
  }, [alasanAkses, muatData]);

  function konfirmasiDialog(alasan: string) {
    if (tujuanDialog === "detail") {
      void konfirmasiAlasanDetail(alasan);
      return;
    }
    setDialogAlasanTerbuka(false);
    setAlasanAkses(alasan);
  }

  // S22-1: Alur buka detail organisasi dengan dialog alasan wajib >= 15 karakter
  function mintaBukaDetail(id: string) {
    setTargetDetailId(id);
    setTujuanDialog("detail");
    setDialogAlasanTerbuka(true);
  }

  async function konfirmasiAlasanDetail(alasan: string) {
    setDialogAlasanTerbuka(false);
    if (!targetDetailId) return;

    setSedangMuat(true);
    const res = await panggil("GET", "/api/admin/organisasi/[id]", {
      params: { id: targetDetailId },
      alasan,
    });
    setSedangMuat(false);

    if (res.ok) {
      setOrgDetail(res.data);
      // Jejak audit dicatat server; muat ulang agar baris barunya tampil.
      const audit = await panggil("GET", "/api/admin/audit", { alasan });
      if (audit.ok) setDaftarAudit(audit.data.audit);
    } else {
      setGalat(res.pesan);
    }
  }

  // S22-2: Putus izin (SETUJUI / TOLAK)
  async function putusIzin(organisasiId: string, keputusan: "TERVERIFIKASI" | "DITOLAK") {
    setGalat(null);
    const res = await panggil("POST", "/api/admin/izin/[organisasiId]/putus", {
      params: { organisasiId },
      alasan: alasanAkses ?? "",
      body: {
        keputusan,
        alasan:
          keputusan === "TERVERIFIKASI"
            ? TEKS.ADM_IZIN_SETUJUI
            : TEKS.ADM_IZIN_TOLAK,
      },
    });

    if (res.ok) {
      setDaftarOrg((prev) =>
        prev.map((o) =>
          o.id === organisasiId ? { ...o, statusIzin: keputusan } : o,
        ),
      );
      setSuksesPesan(keputusan);
    } else {
      setGalat(res.pesan);
    }
  }

  // S22-2: Konfirmasi pembayaran
  async function konfirmasiBayar(tagihanId: string) {
    setGalat(null);
    const res = await panggil(
      "POST",
      "/api/admin/pembayaran/[tagihanId]/konfirmasi",
      {
        params: { tagihanId },
        alasan: alasanAkses ?? "",
        body: {
          keputusan: "SETUJUI",
          alasan: TEKS.ADM_KONFIRMASI_BAYAR,
        },
      },
    );

    if (res.ok) {
      setDaftarTagihan((prev) =>
        prev.map((t) => (t.id === tagihanId ? { ...t, status: "LUNAS" } : t)),
      );
      setSuksesPesan(TEKS.TGH_LUNAS);
    } else {
      setGalat(res.pesan);
    }
  }

  // S22-2: Tambah versi aturan baru
  async function tambahVersiAturan() {
    setGalat(null);
    const res = await panggil("POST", "/api/admin/aturan", {
      alasan: alasanAkses ?? "",
      body: {
        kode: "R05",
        yurisdiksi: "DKI",
        sumber: "Pergub DKI Jakarta No. 102 Tahun 2021 Pasal 8 ayat (1) huruf g (Pembaruan)",
        aksi: "PERINGATAN",
        // Kunci ambang = nama di core/aturan/konfigurasi.ts; berlaku_dari tidak boleh di masa lalu (S21-3).
        ambang: { R05_JAM: 48 },
        kunciTeks: "ATURAN_R05",
        berlakuDari: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });

    if (res.ok) {
      setDaftarAturan((prev) => [...prev, res.data.aturan]);
      setSuksesPesan(TEKS.ADM_ATURAN_VERSI);
    } else {
      setGalat(res.pesan);
    }
  }

  // S22-2: Reset demo
  async function resetDemo() {
    setGalat(null);
    const res = await panggil("POST", "/api/admin/demo/reset", { body: {}, alasan: alasanAkses ?? "" });
    if (res.ok) {
      setSuksesPesan(TEKS.DEMO_RESET_SELESAI);
      // Reset mengembalikan SELURUH data ke seed, termasuk sesi admin ini → masuk lagi lewat /demo.
      window.location.assign("/demo");
    } else {
      setGalat(res.pesan);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-tinta">{TEKS.ADM_JUDUL}</h1>
        <Tombol varian="sekunder" onClick={resetDemo}>
          {TEKS.DEMO_RESET}
        </Tombol>
      </div>

      {galat ? (
        <BannerGalat
          pesan={galat}
          onCoba={() => (alasanAkses ? void muatData(alasanAkses) : setDialogAlasanTerbuka(true))}
        />
      ) : null}
      {!alasanAkses && !dialogAlasanTerbuka ? (
        <div>
          <Tombol
            onClick={() => {
              setTujuanDialog("akses");
              setDialogAlasanTerbuka(true);
            }}
          >
            {TEKS.ADM_ALASAN}
          </Tombol>
        </div>
      ) : null}
      {suksesPesan ? (
        <div className="rounded-kontrol border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          {suksesPesan}
        </div>
      ) : null}

      {sedangMuat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      <Tab
        aktif={tabAktif}
        onPilih={(k) => setTabAktif(k as TabAdmin)}
        item={[
          {
            kunci: "organisasi",
            judul: TEKS.ADM_ORGANISASI,
            isi: (
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {daftarOrg.map((org) => (
                    <Kartu
                      key={org.id}
                      className="flex flex-col justify-between gap-3 border border-garis-halus bg-kertas p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-tinta-redup">
                          {org.jenis}
                        </span>
                        <h3 className="text-base font-bold text-tinta">{org.nama}</h3>
                        <p className="text-xs text-tinta-redup">
                          Izin: {org.statusIzin}
                        </p>
                      </div>
                      <div>
                        <Tombol
                          varian="sekunder"
                          onClick={() => mintaBukaDetail(org.id)}
                        >
                          {TEKS.UMUM_LIHAT_DETAIL}
                        </Tombol>
                      </div>
                    </Kartu>
                  ))}
                </div>

                {orgDetail ? (
                  <Kartu className="flex flex-col gap-3 border-2 border-aksi bg-kertas p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-tinta">
                      Detail: {orgDetail.organisasi.nama}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-tinta-redup">Jenis Organisasi</p>
                        <p className="font-semibold text-tinta">
                          {orgDetail.organisasi.jenis}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-tinta-redup">Jumlah Anggota</p>
                        <p className="font-semibold text-tinta">
                          {orgDetail.jumlahAnggota}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-tinta-redup">Jumlah Kawasan</p>
                        <p className="font-semibold text-tinta">
                          {orgDetail.jumlahKawasan}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-tinta-redup">TPS Aktif</p>
                        <p className="font-semibold text-tinta">
                          {orgDetail.jumlahTpsAktif}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-tinta-redup">Paket</p>
                        <p className="font-semibold text-tinta">
                          {orgDetail.paketKode ?? "Gratis"}
                        </p>
                      </div>
                    </div>
                  </Kartu>
                ) : null}
              </div>
            ),
          },
          {
            kunci: "izin",
            judul: TEKS.ADM_IZIN,
            isi: (
              <div className="flex flex-col gap-4">
                {daftarOrg.filter((o) => o.statusIzin !== "TERVERIFIKASI").length === 0 ? (
                  <Kosong teks="Tidak ada izin." />
                ) : (
                  daftarOrg
                    .filter((o) => o.statusIzin !== "TERVERIFIKASI")
                    .map((org) => (
                      <Kartu
                        key={org.id}
                        className="flex flex-col justify-between gap-4 border border-garis-halus bg-kertas p-5 shadow-sm md:flex-row md:items-center"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-tinta-redup">
                            {org.jenis}
                          </span>
                          <h3 className="text-base font-bold text-tinta">{org.nama}</h3>
                          <p className="text-xs text-amber-800 font-semibold">
                            Status saat ini: {org.statusIzin}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Tombol onClick={() => void putusIzin(org.id, "TERVERIFIKASI")}>
                            {TEKS.ADM_IZIN_SETUJUI}
                          </Tombol>
                          <Tombol
                            varian="sekunder"
                            onClick={() => void putusIzin(org.id, "DITOLAK")}
                          >
                            {TEKS.ADM_IZIN_TOLAK}
                          </Tombol>
                        </div>
                      </Kartu>
                    ))
                )}
              </div>
            ),
          },
          {
            kunci: "pembayaran",
            judul: TEKS.ADM_PEMBAYARAN,
            isi: (
              <div className="flex flex-col gap-4">
                {daftarTagihan.length === 0 ? (
                  <Kosong teks="Belum ada pembayaran." />
                ) : (
                  daftarTagihan.map((t) => (
                    <Kartu
                      key={t.id}
                      className="flex flex-col justify-between gap-4 border border-garis-halus bg-kertas p-5 shadow-sm md:flex-row md:items-center"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-tinta-redup">
                          {t.organisasiNama} · {t.nomor}
                        </span>
                        <h3 className="text-base font-bold text-tinta">
                          Rp{new Intl.NumberFormat("id-ID").format(t.totalIdr)} ({t.periode})
                        </h3>
                        <p className="text-xs text-tinta-redup">
                          Status: {t.status}
                        </p>
                      </div>
                      <div>
                        {t.status !== "LUNAS" ? (
                          <Tombol onClick={() => void konfirmasiBayar(t.id)}>
                            {TEKS.ADM_KONFIRMASI_BAYAR}
                          </Tombol>
                        ) : (
                          <span className="rounded-kontrol bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                            {TEKS.TGH_LUNAS}
                          </span>
                        )}
                      </div>
                    </Kartu>
                  ))
                )}
              </div>
            ),
          },
          {
            kunci: "paket",
            judul: TEKS.ADM_PAKET,
            isi: (
              <div className="grid gap-4 md:grid-cols-2">
                {daftarPaket.map((p) => (
                  <Kartu
                    key={p.kode}
                    className="flex flex-col gap-3 border border-garis-halus bg-kertas p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-tinta">{p.kode}</h3>
                      <span className="rounded-kontrol bg-aksi/10 px-2.5 py-0.5 text-xs font-bold text-aksi">
                        {p.berlakuUntuk}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-tinta">
                      Rp{new Intl.NumberFormat("id-ID").format(p.hargaPerTpsIdr)} per TPS
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-garis-halus">
                      {p.hak.map((h) => (
                        <span
                          key={h.kunci}
                          className="rounded-kontrol bg-latar px-2 py-0.5 text-xs text-tinta"
                        >
                          {h.kunci}: {String(h.nilai)}
                        </span>
                      ))}
                    </div>
                  </Kartu>
                ))}
              </div>
            ),
          },
          {
            kunci: "aturan",
            judul: TEKS.ADM_ATURAN,
            isi: (
              <div className="flex flex-col gap-4">
                <div className="flex justify-end">
                  <Tombol onClick={() => void tambahVersiAturan()}>
                    {TEKS.ADM_ATURAN_VERSI}
                  </Tombol>
                </div>
                <div className="flex flex-col gap-3">
                  {daftarAturan.map((a) => (
                    <Kartu
                      key={`${a.kode}-${a.versi}`}
                      className="flex flex-col gap-2 border border-garis-halus bg-kertas p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-aksi">
                          {a.kode} (Versi {a.versi})
                        </span>
                        <span className="text-xs text-tinta-redup">
                          {a.yurisdiksi} · {a.aksi}
                        </span>
                      </div>
                      <p className="text-sm text-tinta font-medium">{a.sumber}</p>
                      <p className="text-xs text-tinta-redup">
                        Ambang: {JSON.stringify(a.ambang)}
                      </p>
                    </Kartu>
                  ))}
                </div>
              </div>
            ),
          },
          {
            kunci: "audit",
            judul: TEKS.ADM_AUDIT,
            isi: (
              <div className="flex flex-col gap-3">
                {daftarAudit.map((aud) => (
                  <Kartu
                    key={aud.id}
                    className="flex flex-col gap-1.5 border border-garis-halus bg-kertas p-4 shadow-sm text-sm"
                  >
                    <div className="flex items-center justify-between text-xs text-tinta-redup">
                      <span>{aud.dibuatPada.slice(0, 19).replace("T", " ")}</span>
                      <span className="font-bold text-tinta">{aud.peran}</span>
                    </div>
                    <p className="font-semibold text-tinta">{aud.aksi}</p>
                    {aud.alasan ? (
                      <p className="text-xs text-tinta-redup bg-latar p-2 rounded-kontrol">
                        Alasan: {aud.alasan}
                      </p>
                    ) : null}
                  </Kartu>
                ))}
              </div>
            ),
          },
          {
            kunci: "metrik",
            judul: TEKS.ADM_METRIK,
            isi: metrik ? (
              <div className="grid gap-4 md:grid-cols-3">
                <Kartu className="flex flex-col gap-2 border border-garis-halus bg-kertas p-5 shadow-sm">
                  <p className="text-xs text-tinta-redup">{TEKS.ADM_METRIK_TERTUTUP}</p>
                  <p className="text-2xl font-bold text-aksi">
                    {formatBp(metrik.serahTertutupBp)}%
                  </p>
                </Kartu>
                <Kartu className="flex flex-col gap-2 border border-garis-halus bg-kertas p-5 shadow-sm">
                  <p className="text-xs text-tinta-redup">
                    {TEKS.ADM_METRIK_HARI_TERCATAT}
                  </p>
                  <p className="text-2xl font-bold text-aksi">
                    {formatBp(metrik.hariTpsTercatatBp)}%
                  </p>
                </Kartu>
                <Kartu className="flex flex-col gap-2 border border-garis-halus bg-kertas p-5 shadow-sm">
                  <p className="text-xs text-tinta-redup">
                    {TEKS.ADM_METRIK_KAWASAN_AKTIF}
                  </p>
                  <p className="text-2xl font-bold text-tinta">
                    {metrik.kawasanAktif7Hari}
                  </p>
                </Kartu>
              </div>
            ) : null,
          },
        ]}
      />

      <DialogAlasan
        terbuka={dialogAlasanTerbuka}
        onBatal={() => setDialogAlasanTerbuka(false)}
        onKonfirmasi={konfirmasiDialog}
      />
    </div>
  );
}
