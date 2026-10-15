import { describe, expect, it } from "vitest";
import { buatPengirimPush, PengirimPushMati, PengirimWebPush, type WebPushLike } from "./index";

const SUB = { endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } };
const VAPID = { subject: "mailto:uji@example.com", publicKey: "pub", privateKey: "priv" };

describe("PengirimWebPush", () => {
  it("kirim hanya {judul, isi, url}", async () => {
    let dikirim = "";
    const klien: WebPushLike = {
      async sendNotification(_s, payload) {
        dikirim = payload;
        return {};
      },
    };
    const h = await new PengirimWebPush(VAPID, klien).kirim(SUB, { judul: "j", isi: "i", url: "/u", rahasia: "x" } as never);
    expect(h).toEqual({ ok: true });
    expect(JSON.parse(dikirim)).toEqual({ judul: "j", isi: "i", url: "/u" });
  });

  it("404 / 410 → hapus langganan; galat lain → tidak", async () => {
    const dengan = (statusCode?: number): WebPushLike => ({
      async sendNotification() {
        throw Object.assign(new Error("x"), { statusCode });
      },
    });
    const p = { judul: "j", isi: "i", url: "/u" };
    expect(await new PengirimWebPush(VAPID, dengan(404)).kirim(SUB, p)).toEqual({ ok: false, hapusLangganan: true });
    expect(await new PengirimWebPush(VAPID, dengan(410)).kirim(SUB, p)).toEqual({ ok: false, hapusLangganan: true });
    expect(await new PengirimWebPush(VAPID, dengan(500)).kirim(SUB, p)).toEqual({ ok: false, hapusLangganan: false });
    expect(await new PengirimWebPush(VAPID, dengan(undefined)).kirim(SUB, p)).toEqual({ ok: false, hapusLangganan: false });
  });
});

describe("buatPengirimPush", () => {
  it("tanpa kunci VAPID → mati; lengkap → WebPush", () => {
    expect(buatPengirimPush({})).toBeInstanceOf(PengirimPushMati);
    expect(buatPengirimPush({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b", VAPID_SUBJECT: "mailto:x@y.z" })).toBeInstanceOf(PengirimWebPush);
  });
});
