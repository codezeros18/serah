// Adaptor email `Pengirim`. Produksi: Resend (HTTP API). Pengembangan & test: dicetak ke terminal / direkam,
// TIDAK pernah dikirim ke alamat nyata. Alamat penerima di terminal disamarkan (log tanpa email).

export type PesanEmail = { ke: string; subjek: string; teks: string };

export interface Pengirim {
  kirim(pesan: PesanEmail): Promise<void>;
}

export function samarkanEmail(email: string): string {
  const [lokal = "", domain = ""] = email.split("@");
  return `${lokal.slice(0, 1)}***@${domain}`;
}

/** Pengembangan: cetak ke terminal (isi tautan dibutuhkan untuk mencoba alur verifikasi/reset). */
export class PengirimTerminal implements Pengirim {
  async kirim(p: PesanEmail): Promise<void> {
    process.stdout.write(`\n[email dev] ke ${samarkanEmail(p.ke)} · ${p.subjek}\n${p.teks}\n\n`);
  }
}

/** Produksi: Resend HTTP API. */
export class PengirimResend implements Pengirim {
  constructor(
    private readonly kunciApi: string,
    private readonly dari: string,
  ) {}

  async kirim(p: PesanEmail): Promise<void> {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.kunciApi}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.dari, to: [p.ke], subject: p.subjek, text: p.teks }),
    });
    if (!r.ok) throw new Error(`Pengiriman email gagal: HTTP ${r.status}`);
  }
}

/** Test: merekam pesan. */
export class PengirimRekam implements Pengirim {
  readonly terkirim: PesanEmail[] = [];
  async kirim(p: PesanEmail): Promise<void> {
    this.terkirim.push(p);
  }
}

let pengganti: Pengirim | null = null;

/** Hanya untuk test: ganti pengirim (null = kembali ke bawaan). */
export function setelPengirimUji(p: Pengirim | null): void {
  pengganti = p;
}

export function buatPengirim(c: { produksi: boolean; resendApiKey?: string; emailDari?: string }): Pengirim {
  if (pengganti) return pengganti;
  if (c.produksi && c.resendApiKey && c.emailDari) return new PengirimResend(c.resendApiKey, c.emailDari);
  return new PengirimTerminal();
}
