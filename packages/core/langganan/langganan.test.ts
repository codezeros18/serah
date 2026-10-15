import { describe, expect, it } from "vitest";
import { HARI_UJI_COBA, masaUjiCoba } from "./index";

describe("masa uji coba (WIB)", () => {
  it("14 hari, tengah malam WIB", () => {
    expect(HARI_UJI_COBA).toBe(14);
    const { mulai, selesai } = masaUjiCoba(new Date("2026-10-15T08:30:00.000Z")); // 15.30 WIB
    expect(mulai.toISOString()).toBe("2026-10-14T17:00:00.000Z"); // 00.00 WIB 15 Okt
    expect(selesai.toISOString()).toBe("2026-10-28T17:00:00.000Z"); // 00.00 WIB 29 Okt
  });

  it("pukul 00.30 WIB tetap hari itu (bukan hari UTC kemarin)", () => {
    const { mulai } = masaUjiCoba(new Date("2026-10-14T17:30:00.000Z")); // 00.30 WIB 15 Okt
    expect(mulai.toISOString()).toBe("2026-10-14T17:00:00.000Z");
  });

  it("sebelum tengah malam WIB masih hari yang sama", () => {
    const { mulai } = masaUjiCoba(new Date("2026-10-15T16:59:59.999Z")); // 23.59 WIB 15 Okt
    expect(mulai.toISOString()).toBe("2026-10-14T17:00:00.000Z");
  });
});
