import type { Aliran, StatusSerah } from "@serah/kontrak/enum";
import type { KunciTeks } from "@serah/kontrak/teks";

// Pemetaan enum → kunci teks & kelas token. Tidak ada kalimat di sini; teks diambil dari TEKS (§M.2).

export const KUNCI_ALIRAN: Record<Aliran, KunciTeks> = {
  HIJAU: "ALIRAN_HIJAU",
  KUNING: "ALIRAN_KUNING",
  MERAH: "ALIRAN_MERAH",
  ABU: "ALIRAN_ABU",
};

export const KUNCI_ALIRAN_PENDEK: Record<Aliran, KunciTeks> = {
  HIJAU: "ALIRAN_HIJAU_PENDEK",
  KUNING: "ALIRAN_KUNING_PENDEK",
  MERAH: "ALIRAN_MERAH_PENDEK",
  ABU: "ALIRAN_ABU_PENDEK",
};

/** Kelas Tailwind (latar + teks) per aliran. Ditulis utuh agar terbaca pemindai kelas Tailwind. */
export const KELAS_ALIRAN: Record<Aliran, string> = {
  HIJAU: "bg-aliran-hijau text-aliran-hijau-teks",
  KUNING: "bg-aliran-kuning text-aliran-kuning-teks",
  MERAH: "bg-aliran-merah text-aliran-merah-teks",
  ABU: "bg-aliran-abu text-aliran-abu-teks",
};

export const KUNCI_STATUS: Record<StatusSerah, KunciTeks> = {
  DRAF: "STATUS_DRAF",
  MENUNGGU_SETUJU: "STATUS_MENUNGGU_SETUJU",
  DIANGKUT: "STATUS_DIANGKUT",
  DITERIMA: "STATUS_DITERIMA",
  DITERIMA_SEBAGIAN: "STATUS_DITERIMA_SEBAGIAN",
  DITOLAK: "STATUS_DITOLAK",
  MENGGANTUNG: "STATUS_MENGGANTUNG",
};

/** Status: tanpa merah. Ikon teks membedakan selain warna. */
export const GAYA_STATUS: Record<StatusSerah, { kelas: string; ikon: string }> = {
  DRAF: { kelas: "bg-status-draf-latar text-status-draf border-status-draf", ikon: "○" },
  MENUNGGU_SETUJU: { kelas: "bg-status-menunggu-latar text-status-menunggu border-status-menunggu", ikon: "◔" },
  DIANGKUT: { kelas: "bg-status-angkut-latar text-status-angkut border-status-angkut", ikon: "➜" },
  DITERIMA: { kelas: "bg-status-selesai-latar text-status-selesai border-status-selesai", ikon: "✓" },
  DITERIMA_SEBAGIAN: { kelas: "bg-status-sebagian-latar text-status-sebagian border-status-sebagian", ikon: "◐" },
  DITOLAK: { kelas: "bg-status-tolak-latar text-status-tolak border-status-tolak", ikon: "✕" },
  MENGGANTUNG: { kelas: "bg-status-menunggu-latar text-status-menunggu border-status-menunggu", ikon: "!" },
};

/** Versi lembut (SaaS): latar tinta + cincin halus; dipakai untuk lencana, kartu, dan tombol pilihan. */
export const KELAS_ALIRAN_LEMBUT: Record<Aliran, string> = {
  HIJAU: "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-600/25",
  KUNING: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-500/35",
  MERAH: "bg-rose-50 text-rose-900 ring-1 ring-inset ring-rose-600/25",
  ABU: "bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-500/25",
};

/** Warna glif/ikon per aliran (dipasangkan dengan KELAS_ALIRAN_LEMBUT). */
export const WARNA_GLIF_ALIRAN: Record<Aliran, string> = {
  HIJAU: "text-emerald-600",
  KUNING: "text-amber-500",
  MERAH: "text-rose-600",
  ABU: "text-slate-500",
};
