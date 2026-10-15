import type { Guard, Temuan } from "./jenis.ts";
import { adalahBerkasPrisma, normalNama, segmen, uraiModel } from "./prisma.ts";
import { dilewati, diperiksa, nomorBaris } from "./util.ts";

// (e) Nol identitas orang di model operasional (CLAUDE.md §2.5).

export const SEGMEN_IDENTITAS = ["nama", "nik", "telepon", "phone", "email", "lokasi", "latitude"] as const;

/** Model identitas & akun pribadi: semua kolom dikecualikan (identitas hanya boleh di sini). */
export const MODEL_IDENTITAS = ["pengguna", "sesi", "token_sekali", "persetujuan_pdp", "keanggotaan", "preferensi_notifikasi", "langganan_push"];

/** Model yang kolom `nama*`-nya bukan nama orang: badan usaha/tempat (organisasi, kawasan, TPS) & sistem (nama pekerjaan cron). */
export const MODEL_ENTITAS_USAHA = ["organisasi", "kawasan", "tps", "paket", "pekerjaan_cron"];

const identitas = new Set(MODEL_IDENTITAS.map(normalNama));
const usaha = new Set(MODEL_ENTITAS_USAHA.map(normalNama));

export const guardKolomIdentitas: Guard = {
  kode: "e",
  nama: "kolom-identitas",
  keterangan: "Kolom nama/nik/telepon/phone/email/lokasi/latitude dilarang di model operasional",
  periksa(k) {
    const prisma = k.berkas.filter((b) => adalahBerkasPrisma(b.jalur));
    if (prisma.length === 0) return dilewati("schema.prisma belum ada");
    const temuan: Temuan[] = [];
    for (const b of prisma) {
      for (const model of uraiModel(b.isi)) {
        const kunciModel = [model.nama, model.map].filter((x): x is string => !!x).map(normalNama);
        if (kunciModel.some((x) => identitas.has(x))) continue;
        const bolehNama = kunciModel.some((x) => usaha.has(x));
        for (const f of model.field) {
          for (const nama of [f.nama, f.map].filter((x): x is string => !!x)) {
            const kena = segmen(nama).find((s) => (SEGMEN_IDENTITAS as readonly string[]).includes(s) && !(bolehNama && s === "nama"));
            if (kena) {
              temuan.push({ berkas: b.jalur, baris: nomorBaris(b.isi, f.indeks), pesan: `${model.nama}.${nama}: kolom "${kena}" di model operasional` });
              break;
            }
          }
        }
      }
    }
    return diperiksa(temuan);
  },
};
