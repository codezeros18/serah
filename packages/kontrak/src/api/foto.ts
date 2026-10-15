import { z } from "zod";
import { JenisFoto } from "../enum";
import { Id, KodeSerah, rute } from "./primitif";

// Unggah foto (S08). Multipart: field `jenis` + `berkas` (+ `serahKode`, wajib untuk MUATAN & TIKET agar foto terkait serah). Server me-re-encode ke webp tanpa EXIF dan menghitung dHash.

export const FOTO_UKURAN_MAKS_BYTE = 5 * 1024 * 1024;
export const FOTO_MIME_DITERIMA = ["image/jpeg", "image/png", "image/webp"] as const;

export const FotoUnggahMasukan = z
  .object({
    jenis: JenisFoto,
    serahKode: KodeSerah.optional(),
    berkas: z
      .instanceof(Blob)
      .refine((b) => b.size > 0 && b.size <= FOTO_UKURAN_MAKS_BYTE, { message: "G_FOTO_TERLALU_BESAR" })
      .refine((b) => (FOTO_MIME_DITERIMA as readonly string[]).includes(b.type), { message: "Jenis berkas tidak diterima" }),
  })
  .strict();
export const FotoUnggahKeluaran = z.object({ fotoId: Id, dhash: z.string().regex(/^[0-9a-f]{16}$/) });

export const RUTE_FOTO = [
  rute({ metode: "POST", jalur: "/api/foto", akses: ["SESI"], masukan: FotoUnggahMasukan, keluaran: FotoUnggahKeluaran }),
] as const;
