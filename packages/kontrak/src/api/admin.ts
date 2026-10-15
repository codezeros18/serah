import { z } from "zod";
import { AksiAturan, JenisOrganisasi, KeputusanIzin, KeputusanKonfirmasi, KodeAturan, Peran, StatusTagihan, Yurisdiksi } from "../enum";
import { Hak, KunciHak, NilaiHak } from "../hak";
import { Organisasi } from "./organisasi";
import { Paket } from "./langganan";
import { Tagihan } from "./tagihan";
import { Alasan, Bp, Id, Idr, NomorTagihan, Oke, TanpaMasukan, Tanggal, WaktuIso, rute } from "./primitif";

// Admin internal (S21). Setiap mutasi & pembukaan data organisasi wajib header X-Alasan (≥15 karakter),
// dicatat di audit_log. Alasan itu TIDAK ada di body.

export const AdminOrganisasiDaftarKeluaran = z.object({ organisasi: z.array(Organisasi) });
export const AdminOrganisasiParams = z.object({ id: Id });
export const AdminOrganisasiDetailKeluaran = z.object({
  organisasi: Organisasi,
  jumlahAnggota: z.number().int().min(0),
  jumlahKawasan: z.number().int().min(0),
  jumlahTpsAktif: z.number().int().min(0),
  paketKode: z.string().nullable(),
});

export const AdminIzinParams = z.object({ organisasiId: Id });
export const AdminIzinPutusMasukan = z.object({ keputusan: KeputusanIzin, alasan: Alasan, fotoId: Id.optional() }).strict();
export const AdminIzinPutusKeluaran = z.object({ organisasi: Organisasi });

export const AdminPembayaranKueri = z.object({ status: StatusTagihan.optional() }).strict();
export const AdminPembayaranKeluaran = z.object({
  tagihan: z.array(Tagihan.extend({ organisasiId: Id, organisasiNama: z.string(), fotoBuktiId: Id.nullable() })),
  /** Antrean tinjauan: uang ganda/lebih/kurang/terlambat/dikembalikan. Status tagihan tidak berubah sampai admin memutus. Bawaan kosong (mock lama). */
  perluTinjauan: z.array(
    z.object({
      tagihanId: Id,
      nomor: NomorTagihan,
      organisasiId: Id,
      sebab: z.string(),
      jumlahIdr: Idr.nullable(),
      dicatatPada: WaktuIso,
    }),
  ).default([]),
});
export const AdminPembayaranParams = z.object({ tagihanId: Id });
export const AdminKonfirmasiMasukan = z.object({ keputusan: KeputusanKonfirmasi, alasan: Alasan }).strict();
export const AdminKonfirmasiKeluaran = z.object({ tagihan: Tagihan });

export const AdminPaketDaftarKeluaran = z.object({ paket: z.array(Paket) });
export const AdminPaketBuatMasukan = z
  .object({
    kode: z.string().regex(/^[A-Z][A-Z0-9_]{2,40}$/),
    urutan: z.number().int().min(0),
    hargaPerTpsIdr: Idr,
    berlakuUntuk: JenisOrganisasi,
    aktif: z.boolean(),
    hak: z.array(Hak),
  })
  .strict();
export const AdminPaketKeluaran = z.object({ paket: Paket });
export const AdminPaketParams = z.object({ kode: z.string().regex(/^[A-Z][A-Z0-9_]{2,40}$/) });
export const AdminEntitlementMasukan = z.object({ kunci: KunciHak, nilai: NilaiHak }).strict();

export const AturanVersi = z.object({
  id: Id,
  kode: KodeAturan,
  yurisdiksi: Yurisdiksi,
  versi: z.number().int().min(1),
  sumber: z.string(),
  aksi: AksiAturan,
  ambang: z.record(z.string(), z.number().int()),
  kunciTeks: z.string(),
  berlakuDari: WaktuIso,
});
export const AdminAturanDaftarKeluaran = z.object({ aturan: z.array(AturanVersi) });
export const AdminAturanBuatMasukan = z
  .object({
    kode: KodeAturan,
    yurisdiksi: Yurisdiksi,
    sumber: z.string().trim().min(3).max(300),
    aksi: AksiAturan,
    ambang: z.record(z.string(), z.number().int()),
    kunciTeks: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    berlakuDari: WaktuIso,
  })
  .strict();
export const AdminAturanKeluaran = z.object({ aturan: AturanVersi });

export const AdminAuditKueri = z
  .object({ dari: Tanggal.optional(), sampai: Tanggal.optional(), organisasiId: Id.optional(), aksi: z.string().trim().min(1).max(60).optional() })
  .strict();
export const AdminAuditKeluaran = z.object({
  audit: z.array(
    z.object({
      id: Id,
      organisasiId: Id.nullable(),
      peran: Peran,
      aksi: z.string(),
      objekJenis: z.string(),
      objekId: z.string(),
      alasan: z.string().nullable(),
      dibuatPada: WaktuIso,
    }),
  ),
});

/** Metrik agregat platform — tidak ada metrik per orang. */
export const AdminMetrikKeluaran = z.object({
  serahTertutupBp: Bp,
  hariTpsTercatatBp: Bp,
  kawasanAktif7Hari: z.number().int().min(0),
});

export const RUTE_ADMIN = [
  rute({ metode: "GET", jalur: "/api/admin/organisasi", akses: ["ADMIN"], masukan: TanpaMasukan, keluaran: AdminOrganisasiDaftarKeluaran }),
  rute({ metode: "GET", jalur: "/api/admin/organisasi/[id]", akses: ["ADMIN"], params: AdminOrganisasiParams, masukan: TanpaMasukan, keluaran: AdminOrganisasiDetailKeluaran }),
  rute({ metode: "POST", jalur: "/api/admin/izin/[organisasiId]/putus", akses: ["ADMIN"], params: AdminIzinParams, masukan: AdminIzinPutusMasukan, keluaran: AdminIzinPutusKeluaran }),
  rute({ metode: "GET", jalur: "/api/admin/pembayaran", akses: ["ADMIN"], kueri: AdminPembayaranKueri, masukan: TanpaMasukan, keluaran: AdminPembayaranKeluaran }),
  rute({ metode: "POST", jalur: "/api/admin/pembayaran/[tagihanId]/konfirmasi", akses: ["ADMIN"], params: AdminPembayaranParams, masukan: AdminKonfirmasiMasukan, keluaran: AdminKonfirmasiKeluaran }),
  rute({ metode: "GET", jalur: "/api/admin/paket", akses: ["ADMIN"], masukan: TanpaMasukan, keluaran: AdminPaketDaftarKeluaran }),
  rute({ metode: "POST", jalur: "/api/admin/paket", akses: ["ADMIN"], masukan: AdminPaketBuatMasukan, keluaran: AdminPaketKeluaran }),
  rute({ metode: "PUT", jalur: "/api/admin/paket/[kode]/entitlement", akses: ["ADMIN"], params: AdminPaketParams, masukan: AdminEntitlementMasukan, keluaran: AdminPaketKeluaran }),
  rute({ metode: "GET", jalur: "/api/admin/aturan", akses: ["ADMIN"], masukan: TanpaMasukan, keluaran: AdminAturanDaftarKeluaran }),
  rute({ metode: "POST", jalur: "/api/admin/aturan", akses: ["ADMIN"], masukan: AdminAturanBuatMasukan, keluaran: AdminAturanKeluaran }),
  rute({ metode: "GET", jalur: "/api/admin/audit", akses: ["ADMIN"], kueri: AdminAuditKueri, masukan: TanpaMasukan, keluaran: AdminAuditKeluaran }),
  rute({ metode: "GET", jalur: "/api/admin/metrik", akses: ["ADMIN"], masukan: TanpaMasukan, keluaran: AdminMetrikKeluaran }),
  rute({ metode: "POST", jalur: "/api/admin/demo/reset", akses: ["ADMIN"], masukan: TanpaMasukan, keluaran: Oke }),
] as const;
