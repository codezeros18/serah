import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { DISENSOR, buatLog, sensor, sensorTeks } from "./log";
import { PENGUMPULAN_DATA, bersihkanPeristiwa } from "./sentry";

// S26-3 — log & Sentry tanpa PII: email, token, cookie, IP mentah tidak pernah keluar.

const EMAIL = "budi.contoh@contoh.test";
const TOKEN = "Zq3x9VbN2mK7pL4sT8wY1cR6dF0gH5jA_kE-uI3oP9q";
const COOKIE = `__Host-serah=${TOKEN}`;
const IP = "203.0.113.47";
const IPV6 = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";

function tangkap() {
  const baris: string[] = [];
  const tujuan = new Writable({
    write(potong, _enc, cb) {
      baris.push(String(potong));
      cb();
    },
  });
  return { log: buatLog(tujuan), keluaran: () => baris.join("") };
}

const FIXTURE = {
  email: EMAIL,
  token: TOKEN,
  cookie: COOKIE,
  ip: IP,
  headers: { cookie: COOKIE, authorization: `Bearer ${TOKEN}`, "x-forwarded-for": IP, "user-agent": "uji" },
  pengguna: { emailTujuan: EMAIL, sandi: "rahasia-sekali-1" },
  catatan: `pengguna ${EMAIL} dari ${IP} / ${IPV6} memakai ${COOKIE}`,
  daftar: [{ email: EMAIL }, `Bearer ${TOKEN}`],
  kodeSerah: "SRH-20261016-0001",
  jumlah: 3,
};

describe("log tanpa PII", () => {
  it("objek berisi email/token/cookie/IP (juga bersarang & dalam teks) → keluaran tidak memuat satu pun", () => {
    const { log, keluaran } = tangkap();
    log.error(`masuk gagal untuk ${EMAIL}`, FIXTURE);
    log.warn("header mentah", { headers: new Headers({ cookie: COOKIE, authorization: `Bearer ${TOKEN}` }) });
    log.info(`token ${TOKEN}`);
    const out = keluaran();
    for (const rahasia of [EMAIL, TOKEN, COOKIE, IP, IPV6, "rahasia-sekali-1", "budi.contoh"]) expect(out).not.toContain(rahasia);
    expect(out).toContain(DISENSOR);
    // Data operasional yang bukan PII tetap tercatat.
    expect(out).toContain("SRH-20261016-0001");
    expect(out).toContain('"jumlah":3');
  });

  it("keluaran adalah JSON per baris dengan tingkat & waktu", () => {
    const { log, keluaran } = tangkap();
    log.warn("uji", { kodeSerah: "SRH-1" });
    const j = JSON.parse(keluaran().trim().split("\n")[0]!);
    expect(j).toMatchObject({ level: 40, msg: "uji", kodeSerah: "SRH-1", app: "serah" });
    expect(typeof j.time).toBe("string");
  });

  it("Error dicatat sebagai nama, kode, dan pesan tersensor (tanpa jejak tumpukan)", () => {
    const e = Object.assign(new Error(`gagal kirim ke ${EMAIL}`), { code: "P2028" });
    expect(sensor(e)).toEqual({ nama: "Error", kode: "P2028", pesan: `gagal kirim ke ${DISENSOR}` });
  });

  it("kunci API (Anthropic, Resend, Midtrans) di dalam teks disensor walau pendek", () => {
    const s = sensorTeks("401 kunci sk-ant-rahasia, re_abc123xyz, SB-Mid-server-abc, Mid-client-xyz ditolak");
    for (const r of ["sk-ant-rahasia", "re_abc123xyz", "Mid-server-abc", "Mid-client-xyz"]) expect(s).not.toContain(r);
    expect(s).toBe(`401 kunci ${DISENSOR}, ${DISENSOR}, ${DISENSOR}, ${DISENSOR} ditolak`);
  });

  it("sensorTeks tidak merusak kode serah, tanggal, dan angka biasa", () => {
    const s = "Serah SRH-20261016-0001 ditutup 2026-10-16 berat 12500 g";
    expect(sensorTeks(s)).toBe(s);
  });
});

describe("Sentry tanpa PII", () => {
  it("dataCollection (pengganti sendDefaultPii di v11): pengguna, cookie, body, query, variabel lokal, data DB mati", () => {
    expect(PENGUMPULAN_DATA).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      httpHeaders: { request: { allow: ["user-agent", "content-type"] }, response: false },
    });
  });

  it("bersihkanPeristiwa membuang user, cookie, body, query; menyensor header, pesan, extra, breadcrumb", () => {
    const e = bersihkanPeristiwa({
      type: undefined,
      message: `galat untuk ${EMAIL}`,
      user: { email: EMAIL, ip_address: IP },
      request: {
        url: `https://serah.test/api/auth/masuk?email=${EMAIL}`,
        cookies: { "__Host-serah": TOKEN },
        data: { email: EMAIL, sandi: "rahasia-sekali-1" },
        query_string: `email=${EMAIL}`,
        headers: { cookie: COOKIE, authorization: `Bearer ${TOKEN}`, "user-agent": "uji" },
      },
      extra: { email: EMAIL, catatan: `dari ${IP}` },
      exception: { values: [{ type: "Error", value: `tidak terkirim ke ${EMAIL}` }] },
      breadcrumbs: [{ message: `fetch ${COOKIE}`, data: { token: TOKEN } }],
    });
    const out = JSON.stringify(e);
    for (const rahasia of [EMAIL, TOKEN, IP, "rahasia-sekali-1"]) expect(out).not.toContain(rahasia);
    expect(e.user).toBeUndefined();
    expect(e.request?.cookies).toBeUndefined();
    expect(e.request?.data).toBeUndefined();
    expect(e.request?.url).toBe("https://serah.test/api/auth/masuk");
    expect(e.request?.headers?.["user-agent"]).toBe("uji");
  });
});
