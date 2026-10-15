import { describe, expect, it } from "vitest";
import { ClaudePembaca, PROMPT_SISTEM, SKEMA_TIKET, konfigurasiBerpikir, normalisasi, type KlienPesan } from "./claude-pembaca";
import { AiTidakTersedia, ManualPembaca } from "./pembaca";

type Params = Record<string, unknown>;
type Langkah = { stop?: string | null; json?: unknown; teks?: string; galat?: { status?: number; name?: string } };

function klienTiruan(langkah: Langkah[]) {
  const panggilan: Params[] = [];
  const klien: KlienPesan = {
    messages: {
      async create(params) {
        panggilan.push(params);
        const l = langkah[panggilan.length - 1];
        if (!l) throw new Error("panggilan tak terduga");
        if (l.galat) throw Object.assign(new Error("galat"), l.galat);
        const teks = l.teks ?? JSON.stringify(l.json);
        return { stop_reason: l.stop ?? "end_turn", content: [{ type: "text", text: teks }] };
      },
    },
  };
  return { klien, panggilan };
}

const TINGGI = { nomor_tiket: "T-001", berat_teks: "42,5", satuan: "kg", tanggal_teks: "15/10/2026", keyakinan: "TINGGI" };
const buat = (langkah: Langkah[]) => {
  const t = klienTiruan(langkah);
  return { ...t, pembaca: new ClaudePembaca({ klien: t.klien, model: "claude-haiku-5-5", modelCadangan: "claude-sonnet-5-5" }) };
};
const FOTO = Buffer.from("fotopalsu");

describe("ClaudePembaca", () => {
  it("sukses TINGGI: berat dalam gram integer, model tercatat", async () => {
    const { pembaca } = buat([{ json: TINGGI }]);
    expect(await pembaca.baca(FOTO, "image/webp")).toEqual({
      tersedia: true,
      nomorTiket: "T-001",
      beratTeks: "42,5",
      satuan: "kg",
      beratG: 42_500,
      tanggalTeks: "15/10/2026",
      keyakinan: "TINGGI",
      model: "claude-haiku-5-5",
    });
  });

  it("RENDAH dengan nilai null tetap tersedia, beratG null", async () => {
    const { pembaca } = buat([{ json: { nomor_tiket: null, berat_teks: null, satuan: null, tanggal_teks: null, keyakinan: "RENDAH" } }]);
    const h = await pembaca.baca(FOTO, "image/webp");
    expect(h).toMatchObject({ tersedia: true, beratG: null, keyakinan: "RENDAH", nomorTiket: null });
  });

  it("parameter permintaan: prompt persis, skema json_schema, max_tokens 400, thinking dimatikan, gambar base64", async () => {
    const { pembaca, panggilan } = buat([{ json: TINGGI }]);
    await pembaca.baca(FOTO, "image/webp");
    const p = panggilan[0]!;
    expect(p.system).toBe(PROMPT_SISTEM);
    expect(p.output_config).toEqual({ format: { type: "json_schema", schema: SKEMA_TIKET } });
    expect(p.max_tokens).toBe(400);
    expect(p.thinking).toEqual({ type: "disabled" });
    expect(JSON.stringify(p.messages)).toContain(FOTO.toString("base64"));
    expect(p.model).toBe("claude-haiku-5-5");
  });

  it("refusal dan max_tokens → AiTidakTersedia tanpa mencoba cadangan", async () => {
    for (const stop of ["refusal", "max_tokens"]) {
      const { pembaca, panggilan } = buat([{ stop, json: TINGGI }]);
      await expect(pembaca.baca(FOTO, "image/webp")).rejects.toBeInstanceOf(AiTidakTersedia);
      expect(panggilan).toHaveLength(1);
    }
  });

  it("429 / 5xx / timeout → satu kali model cadangan", async () => {
    for (const galat of [{ status: 429 }, { status: 503 }, { name: "APIConnectionTimeoutError", status: undefined }]) {
      const { pembaca, panggilan } = buat([{ galat }, { json: TINGGI }]);
      const h = await pembaca.baca(FOTO, "image/webp");
      expect(h).toMatchObject({ tersedia: true, model: "claude-sonnet-5-5" });
      expect(panggilan.map((x) => x.model)).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5"]);
      expect(panggilan[1]!.thinking).toEqual({ type: "between_tools" });
    }
  });

  it("utama dan cadangan gagal → AiTidakTersedia (maks dua panggilan)", async () => {
    const { pembaca, panggilan } = buat([{ galat: { status: 500 } }, { galat: { status: 500 } }]);
    await expect(pembaca.baca(FOTO, "image/webp")).rejects.toBeInstanceOf(AiTidakTersedia);
    expect(panggilan).toHaveLength(2);
  });

  it("galat klien 4xx (mis. 400) tidak memicu cadangan", async () => {
    const { pembaca, panggilan } = buat([{ galat: { status: 400 } }]);
    await expect(pembaca.baca(FOTO, "image/webp")).rejects.toBeInstanceOf(AiTidakTersedia);
    expect(panggilan).toHaveLength(1);
  });

  it("JSON rusak atau enum keyakinan tak dikenal → AiTidakTersedia", async () => {
    await expect(buat([{ teks: "bukan json" }]).pembaca.baca(FOTO, "image/webp")).rejects.toBeInstanceOf(AiTidakTersedia);
    await expect(buat([{ json: { ...TINGGI, keyakinan: "YAKIN" } }]).pembaca.baca(FOTO, "image/webp")).rejects.toBeInstanceOf(AiTidakTersedia);
  });
});

describe("normalisasi (validasi di kode kita)", () => {
  const dasar = { nomor_tiket: "x", tanggal_teks: null };
  it("enum keyakinan & satuan tanpa membedakan huruf besar/kecil", () => {
    expect(normalisasi({ ...dasar, berat_teks: "2", satuan: "KG", keyakinan: "tinggi" }, "m")).toMatchObject({
      keyakinan: "TINGGI",
      satuan: "kg",
      beratG: 2_000,
    });
    expect(normalisasi({ ...dasar, berat_teks: "1,5", satuan: "Ton", keyakinan: "Sedang" }, "m")).toMatchObject({
      keyakinan: "SEDANG",
      satuan: "ton",
      beratG: 1_500_000,
    });
  });
  it("format Indonesia tanpa float: 1.250,5 kg → 1250500 g", () => {
    expect(normalisasi({ ...dasar, berat_teks: "1.250,5", satuan: "kg", keyakinan: "TINGGI" }, "m")).toMatchObject({ beratG: 1_250_500 });
  });
  it("satuan null → kilogram", () => {
    expect(normalisasi({ ...dasar, berat_teks: "42,5", satuan: null, keyakinan: "TINGGI" }, "m")).toMatchObject({ beratG: 42_500 });
  });
  it("teks tak terurai, nol, atau di luar rentang → berat null", () => {
    for (const t of ["abc", "0", "-5", "1,2,3", "99999999", "4 kg"]) {
      expect(normalisasi({ ...dasar, berat_teks: t, satuan: "kg", keyakinan: "TINGGI" }, "m")).toMatchObject({ beratG: null, beratTeks: null });
    }
  });
  it("bukan objek → null", () => {
    expect(normalisasi("x", "m")).toBeNull();
    expect(normalisasi(null, "m")).toBeNull();
  });
});

describe("konfigurasiBerpikir", () => {
  it("per model", () => {
    expect(konfigurasiBerpikir("claude-haiku-5-5")).toEqual({ thinking: { type: "disabled" }, maxTokens: 400 });
    expect(konfigurasiBerpikir("claude-sonnet-5-5")).toEqual({ thinking: { type: "between_tools" }, maxTokens: 400 });
    expect(konfigurasiBerpikir("claude-opus-5-5")).toEqual({ maxTokens: 4000 });
  });
});

describe("ManualPembaca", () => {
  it("selalu tidak tersedia", async () => {
    expect(await new ManualPembaca().baca(FOTO, "image/webp")).toEqual({ tersedia: false });
  });
});
