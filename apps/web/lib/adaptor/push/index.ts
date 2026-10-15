// Adaptor `PengirimPush` (BLUEPRINT §O.5). Payload hanya {judul, isi, url} dari teks §M.11 —
// tidak ada data pribadi. Langganan yang sudah tidak berlaku (404/410) → pemanggil menghapusnya.
import webpush from "web-push";

export type LanggananPush = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PayloadPush = { judul: string; isi: string; url: string };
export type HasilPush = { ok: true } | { ok: false; hapusLangganan: boolean };

export interface PengirimPush {
  kirim(langganan: LanggananPush, payload: PayloadPush): Promise<HasilPush>;
}

/** Bagian `web-push` yang dipakai (disuntik agar bisa dites tanpa jaringan). */
export interface WebPushLike {
  sendNotification(
    sub: LanggananPush,
    payload: string,
    opsi: { vapidDetails: { subject: string; publicKey: string; privateKey: string }; TTL: number },
  ): Promise<unknown>;
}

export type OpsiVapid = { subject: string; publicKey: string; privateKey: string };

export class PengirimWebPush implements PengirimPush {
  constructor(
    private readonly vapid: OpsiVapid,
    private readonly klien: WebPushLike = webpush as unknown as WebPushLike,
  ) {}

  async kirim(langganan: LanggananPush, payload: PayloadPush): Promise<HasilPush> {
    const isi: PayloadPush = { judul: payload.judul, isi: payload.isi, url: payload.url };
    try {
      await this.klien.sendNotification(langganan, JSON.stringify(isi), { vapidDetails: this.vapid, TTL: 3600 });
      return { ok: true };
    } catch (e) {
      const status = (e as { statusCode?: number } | null)?.statusCode;
      return { ok: false, hapusLangganan: status === 404 || status === 410 };
    }
  }
}

/** Tanpa kunci VAPID → pengirim tak aktif (push dimatikan, bukan galat). */
export class PengirimPushMati implements PengirimPush {
  kirim(): Promise<HasilPush> {
    return Promise.resolve({ ok: false, hapusLangganan: false });
  }
}

export type EnvPush = { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string };

export function buatPengirimPush(env: EnvPush): PengirimPush {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = env;
  if (!publicKey || !privateKey || !subject) return new PengirimPushMati();
  return new PengirimWebPush({ subject, publicKey, privateKey });
}
