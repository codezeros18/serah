import { z } from "zod";
import { TanpaMasukan, rute } from "./primitif";

// Cron (Bearer CRON_SECRET) & health.

export const CronKeluaran = z.object({
  pekerjaan: z.string(),
  /** Kunci jendela idempoten `pekerjaan_cron(nama, jendela)`. */
  jendela: z.string(),
  dilewati: z.boolean(),
});

export const HealthKeluaran = z.object({
  versi: z.string(),
  /** Diisi saat koneksi DB tersedia (S01/S08). */
  db: z.enum(["ok", "galat"]).optional(),
  /** Umur data prakiraan BMKG terbaru dalam jam (S05/S08). */
  bmkgUmurJam: z.number().int().min(0).nullable().optional(),
});
export type HealthKeluaran = z.infer<typeof HealthKeluaran>;

export const RUTE_SISTEM = [
  rute({ metode: "POST", jalur: "/api/cron/sepuluh-menit", akses: ["CRON"], masukan: TanpaMasukan, keluaran: CronKeluaran }),
  rute({ metode: "POST", jalur: "/api/cron/tiga-jam", akses: ["CRON"], masukan: TanpaMasukan, keluaran: CronKeluaran }),
  rute({ metode: "POST", jalur: "/api/cron/harian", akses: ["CRON"], masukan: TanpaMasukan, keluaran: CronKeluaran }),
  rute({ metode: "GET", jalur: "/api/health", akses: ["PUBLIK"], masukan: TanpaMasukan, keluaran: HealthKeluaran }),
] as const;
