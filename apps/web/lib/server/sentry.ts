import * as Sentry from "@sentry/node";
import { DISENSOR, sensor, sensorTeks } from "./log";

// Sentry (S26-3, BLUEPRINT §P.2): hanya aktif bila SENTRY_DSN terisi. Setara `sendDefaultPii:false` di v11 =
// `dataCollection` ketat (PENGUMPULAN_DATA), dan setiap peristiwa disaring: header cookie/authorization, cookie, body permintaan, data pengguna, dan teks bebas (email, IP, token).

let aktif = false;

/**
 * @sentry/node 11.8: `sendDefaultPii` sudah diganti `dataCollection`, dan bawaannya MENGUMPULKAN data pengguna,
 * cookie, header, body, query, data kueri DB, dan variabel lokal. Semuanya dimatikan; header permintaan hanya
 * user-agent & content-type (untuk diagnosis), selebihnya disaring lagi di bersihkanPeristiwa.
 */
export const PENGUMPULAN_DATA = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ["user-agent", "content-type"] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
} satisfies NonNullable<Sentry.NodeOptions["dataCollection"]>;

type Peristiwa = Sentry.ErrorEvent;

/** Saringan peristiwa sebelum dikirim (diekspor untuk test). */
export function bersihkanPeristiwa(e: Peristiwa): Peristiwa {
  const hasil: Peristiwa = { ...e };
  delete hasil.user;
  if (hasil.request) {
    const r = { ...hasil.request };
    delete r.cookies;
    delete r.data; // body permintaan (termasuk auth) tidak pernah dikirim
    if (r.headers) r.headers = sensor(r.headers) as Record<string, string>;
    if (r.query_string) r.query_string = DISENSOR;
    if (r.url) r.url = sensorTeks(r.url.split("?")[0] ?? "");
    hasil.request = r;
  }
  if (hasil.message) hasil.message = sensorTeks(hasil.message);
  if (hasil.extra) hasil.extra = sensor(hasil.extra) as Record<string, unknown>;
  if (hasil.contexts) hasil.contexts = sensor(hasil.contexts) as Peristiwa["contexts"];
  if (hasil.exception?.values) {
    hasil.exception = { ...hasil.exception, values: hasil.exception.values.map((v) => ({ ...v, ...(v.value ? { value: sensorTeks(v.value) } : {}) })) };
  }
  if (hasil.breadcrumbs) hasil.breadcrumbs = hasil.breadcrumbs.map((b) => ({ ...b, ...(b.message ? { message: sensorTeks(b.message) } : {}), ...(b.data ? { data: sensor(b.data) as Record<string, unknown> } : {}) }));
  return hasil;
}

/** Dipanggil sekali saat server start (instrumentation.ts). */
export function mulaiSentry(dsn: string | undefined, lingkungan: string): void {
  if (!dsn || aktif) return;
  Sentry.init({
    dsn,
    environment: lingkungan,
    dataCollection: PENGUMPULAN_DATA,
    tracesSampleRate: 0,
    beforeSend: (e) => bersihkanPeristiwa(e),
    beforeBreadcrumb: (b) => ({ ...b, ...(b.message ? { message: sensorTeks(b.message) } : {}), ...(b.data ? { data: sensor(b.data) as Record<string, unknown> } : {}) }),
  });
  aktif = true;
}

/** Laporkan galat tak tertangani (tanpa konteks pengguna). Tanpa DSN: tidak melakukan apa pun. */
export function laporGalat(e: unknown): void {
  if (aktif) Sentry.captureException(e);
}
