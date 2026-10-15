import Anthropic from "@anthropic-ai/sdk";
import { parseBeratTeksKeGram } from "@serah/core/angka";
import { KEYAKINAN_AI, type KeyakinanAi } from "@serah/kontrak/enum";
import { AiTidakTersedia, type HasilBaca, type PembacaTiket } from "./pembaca";

// Dokumentasi: https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md
// (output_config.format = {type:"json_schema", schema}); refusal/max_tokens lewat stop_reason.

/** Prompt sistem — disalin PERSIS dari BLUEPRINT §N.1. */
export const PROMPT_SISTEM =
  'Anda membaca foto tiket atau nota timbang sampah. Keluarkan hanya data sesuai skema. Jangan menebak. Bila suatu nilai tidak terbaca jelas, isi null. Tulis berat persis seperti tertulis di tiket dalam kilogram, termasuk tanda koma atau titik desimal. Bila satuan pada tiket adalah ton, tulis nilai yang tertulis dan isi satuan dengan "ton". Nilai keyakinan: TINGGI bila semua angka terbaca jelas, SEDANG bila ada yang kurang jelas, RENDAH bila sebagian besar tidak terbaca.';

/** Skema — disalin PERSIS dari BLUEPRINT §N.1. */
export const SKEMA_TIKET = {
  type: "object",
  additionalProperties: false,
  required: ["nomor_tiket", "berat_teks", "satuan", "tanggal_teks", "keyakinan"],
  properties: {
    nomor_tiket: { type: ["string", "null"] },
    berat_teks: { type: ["string", "null"] },
    satuan: { type: ["string", "null"], enum: ["kg", "ton", null] },
    tanggal_teks: { type: ["string", "null"] },
    keyakinan: { type: "string", enum: ["TINGGI", "SEDANG", "RENDAH"] },
  },
} as const;

export const WAKTU_HABIS_MS = 15_000;
export const MAX_TOKENS = 400;
/** Batas hasil sah: 1 g – 50.000.000 g (§N.1). Core membatasi lebih ketat lewat BERAT_G_MAKS. */
const BERAT_G_MIN = 1;
const BERAT_G_MAKS_AI = 50_000_000;

/** Bagian klien Anthropic yang dipakai (disuntik agar bisa dites tanpa jaringan). */
export interface KlienPesan {
  messages: { create(params: Record<string, unknown>, opsi?: { timeout?: number }): Promise<Respons> };
}
type Respons = { stop_reason: string | null; content: Array<{ type: string; text?: string }> };

export type OpsiClaude = {
  klien: KlienPesan;
  model: string;
  modelCadangan: string;
};

export function buatKlienAnthropic(apiKey: string): KlienPesan {
  // maxRetries 0: percobaan ulang kita atur sendiri (model → cadangan).
  return new Anthropic({ apiKey, maxRetries: 0 }) as unknown as KlienPesan;
}

/**
 * Konfigurasi berpikir per model. Pembacaan ini ekstraksi sederhana dengan max_tokens kecil, jadi
 * berpikir dimatikan agar token tidak habis sebelum JSON. Sonnet 5.5 menolak `disabled` (400) —
 * pakai `between_tools`. Model tanpa opsi mati (Opus 5.5 / Fable) dibiarkan default dan diberi anggaran lebih besar.
 */
export function konfigurasiBerpikir(model: string): { thinking?: Record<string, unknown>; maxTokens: number } {
  if (/sonnet-5-5/.test(model)) return { thinking: { type: "between_tools" }, maxTokens: MAX_TOKENS };
  if (/opus-5-5|fable/.test(model)) return { maxTokens: 4_000 };
  return { thinking: { type: "disabled" }, maxTokens: MAX_TOKENS };
}

function bukaGalat(e: unknown): boolean {
  const s = (e as { status?: number } | null)?.status;
  return s === undefined || s === 408 || s === 429 || s >= 500 || (e as Error | null)?.name === "APIConnectionTimeoutError";
}

type Mentah = {
  nomor_tiket: string | null;
  berat_teks: string | null;
  satuan: string | null;
  tanggal_teks: string | null;
  keyakinan: string;
};

const teksAtauNull = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** Validasi di kode kita (structured output tidak menegakkan kapitalisasi enum maupun rentang). */
export function normalisasi(mentah: unknown, model: string): HasilBaca | null {
  if (typeof mentah !== "object" || mentah === null) return null;
  const m = mentah as Partial<Mentah>;
  const keyakinanBesar = typeof m.keyakinan === "string" ? m.keyakinan.trim().toUpperCase() : "";
  if (!(KEYAKINAN_AI as readonly string[]).includes(keyakinanBesar)) return null;
  const satuanKecil = typeof m.satuan === "string" ? m.satuan.trim().toLowerCase() : null;
  const satuan = satuanKecil === "kg" || satuanKecil === "ton" ? satuanKecil : null;
  const beratTeks = teksAtauNull(m.berat_teks);

  let beratG: number | null = null;
  if (beratTeks !== null) {
    // Tanpa satuan terbaca → kilogram (perintah prompt: "dalam kilogram").
    const h = parseBeratTeksKeGram(beratTeks, satuan ?? "kg");
    if (h.ok && h.nilai >= BERAT_G_MIN && h.nilai <= BERAT_G_MAKS_AI) beratG = h.nilai;
  }
  return {
    tersedia: true,
    nomorTiket: teksAtauNull(m.nomor_tiket),
    beratTeks: beratG === null ? null : beratTeks,
    satuan: beratG === null ? null : satuan,
    beratG,
    tanggalTeks: teksAtauNull(m.tanggal_teks),
    keyakinan: keyakinanBesar as KeyakinanAi,
    model,
  };
}

export class ClaudePembaca implements PembacaTiket {
  constructor(private readonly o: OpsiClaude) {}

  private async panggil(model: string, foto: Buffer, mime: string): Promise<HasilBaca> {
    const { thinking, maxTokens } = konfigurasiBerpikir(model);
    const res = await this.o.klien.messages.create(
      {
        model,
        max_tokens: maxTokens,
        ...(thinking ? { thinking } : {}),
        system: PROMPT_SISTEM,
        output_config: { format: { type: "json_schema", schema: SKEMA_TIKET } },
        messages: [
          {
            role: "user",
            content: [{ type: "image", source: { type: "base64", media_type: mime, data: foto.toString("base64") } }],
          },
        ],
      },
      { timeout: WAKTU_HABIS_MS },
    );
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") throw new AiTidakTersedia(res.stop_reason);
    const teks = res.content.find((b) => b.type === "text")?.text;
    if (!teks) throw new AiTidakTersedia("tanpa teks");
    let json: unknown;
    try {
      json = JSON.parse(teks);
    } catch {
      throw new AiTidakTersedia("JSON tidak sah");
    }
    const hasil = normalisasi(json, model);
    if (!hasil) throw new AiTidakTersedia("keluaran tidak sesuai skema");
    return hasil;
  }

  /** Model utama → (gagal timeout/5xx/429) satu kali model cadangan → AiTidakTersedia. */
  async baca(foto: Buffer, mime: string): Promise<HasilBaca> {
    try {
      return await this.panggil(this.o.model, foto, mime);
    } catch (e) {
      if (e instanceof AiTidakTersedia || !bukaGalat(e)) {
        if (e instanceof AiTidakTersedia) throw e;
        throw new AiTidakTersedia();
      }
    }
    try {
      return await this.panggil(this.o.modelCadangan, foto, mime);
    } catch {
      throw new AiTidakTersedia();
    }
  }
}
