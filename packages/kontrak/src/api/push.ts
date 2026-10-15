import { z } from "zod";
import { Oke, TanpaMasukan, rute } from "./primitif";

// Langganan Web Push (S17/S18).

const Endpoint = z.url().max(2_000);

export const PushLanggananMasukan = z
  .object({ endpoint: Endpoint, keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }).strict() })
  .strict();
export const PushBerhentiMasukan = z.object({ endpoint: Endpoint }).strict();
export const PushKunciPublikKeluaran = z.object({ kunciPublik: z.string().nullable() });

export const RUTE_PUSH = [
  rute({ metode: "POST", jalur: "/api/push/langganan", akses: ["SESI"], masukan: PushLanggananMasukan, keluaran: Oke }),
  rute({ metode: "DELETE", jalur: "/api/push/langganan", akses: ["SESI"], masukan: PushBerhentiMasukan, keluaran: Oke }),
  rute({ metode: "GET", jalur: "/api/push/kunci-publik", akses: ["SESI"], masukan: TanpaMasukan, keluaran: PushKunciPublikKeluaran }),
] as const;
