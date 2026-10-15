import { describe, expect, it } from "vitest";
import { arahSelisih, bandingkanBayangan, teksSelisihBayangan } from "./index";

// S24-3 — selisih dua arah per aliran; angka dihitung tangan.

describe("bandingkanBayangan", () => {
  it("selisih = bayangan − SERAH; dua arah dan sama", () => {
    const baris = bandingkanBayangan(
      { KUNING: 100_000, HIJAU: 50_000, MERAH: 2_000 },
      [
        { aliran: "KUNING", beratG: 112_500, sumberCatatan: "buku TPS" }, // lebih 12.500
        { aliran: "HIJAU", beratG: 45_000, sumberCatatan: "buku TPS" }, // kurang 5.000
        { aliran: "MERAH", beratG: 2_000, sumberCatatan: "laporan lama" }, // sama
      ],
    );
    expect(baris).toEqual([
      { aliran: "HIJAU", serahG: 50_000, bayanganG: 45_000, selisihG: -5_000, arah: "KURANG", sumberCatatan: ["buku TPS"] },
      { aliran: "KUNING", serahG: 100_000, bayanganG: 112_500, selisihG: 12_500, arah: "LEBIH", sumberCatatan: ["buku TPS"] },
      { aliran: "MERAH", serahG: 2_000, bayanganG: 2_000, selisihG: 0, arah: "SAMA", sumberCatatan: ["laporan lama"] },
    ]);
  });

  it("entri ganda sealiran dijumlahkan, sumber unik & urut; hanya bayangan atau hanya SERAH tetap tampil", () => {
    const baris = bandingkanBayangan(
      { ABU: 7_000 },
      [
        { aliran: "KUNING", beratG: 3_000, sumberCatatan: "laporan lama" },
        { aliran: "KUNING", beratG: 4_000, sumberCatatan: "buku TPS" },
        { aliran: "KUNING", beratG: 1_000, sumberCatatan: "buku TPS" },
      ],
    );
    expect(baris).toEqual([
      { aliran: "KUNING", serahG: 0, bayanganG: 8_000, selisihG: 8_000, arah: "LEBIH", sumberCatatan: ["buku TPS", "laporan lama"] },
      { aliran: "ABU", serahG: 7_000, bayanganG: 0, selisihG: -7_000, arah: "KURANG", sumberCatatan: [] },
    ]);
  });

  it("tanpa data sama sekali → kosong; angka tak sah ditolak", () => {
    expect(bandingkanBayangan({}, [])).toEqual([]);
    expect(() => bandingkanBayangan({ HIJAU: -1 }, [])).toThrow(RangeError);
    expect(() => bandingkanBayangan({}, [{ aliran: "HIJAU", beratG: 1.5, sumberCatatan: "x" }])).toThrow(RangeError);
  });
});

describe("teksSelisihBayangan", () => {
  it("memakai BYG_LEBIH / BYG_KURANG / BYG_SAMA dengan kg berformat Indonesia", () => {
    expect(arahSelisih(1)).toBe("LEBIH");
    expect(teksSelisihBayangan(12_500)).toBe("Catatan lama 12,5 kg lebih besar");
    expect(teksSelisihBayangan(-5_000)).toBe("Catatan lama 5 kg lebih kecil");
    expect(teksSelisihBayangan(0)).toBe("Sama");
    expect(teksSelisihBayangan(1_250_500)).toBe("Catatan lama 1.250,5 kg lebih besar");
  });
});
