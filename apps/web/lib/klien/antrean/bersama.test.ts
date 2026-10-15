import { describe, expect, it } from "vitest";
import { kunciBatch } from "./bersama";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const a = { idempotencyKey: "11111111-1111-4111-8111-111111111111" };
const b = { idempotencyKey: "22222222-2222-4222-8222-222222222222" };

describe("kunciBatch", () => {
  it("UUID v4 sah (diterima server) dan deterministik untuk batch yang sama", async () => {
    const k1 = await kunciBatch([a, b]);
    expect(k1).toMatch(UUID);
    expect(await kunciBatch([a, b])).toBe(k1);
  });
  it("batch berbeda → kunci berbeda", async () => {
    expect(await kunciBatch([a])).not.toBe(await kunciBatch([a, b]));
    expect(await kunciBatch([b, a])).not.toBe(await kunciBatch([a, b]));
  });
});
