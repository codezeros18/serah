import type { Guard, Temuan } from "./jenis.ts";
import { adalahGuard, adalahKode, bersihkanKode, diperiksa, temukan } from "./util.ts";

// (h) Kosakata penyedia pembayaran berhenti di apps/web/lib/adaptor/bayar/** (CLAUDE.md §2.7).
// Yang diperiksa: token persis order_id, transaction_status, gross_amount, dan kata utuh "snap".

const DIIZINKAN = "apps/web/lib/adaptor/bayar/";
const POLA = /\b(order_id|transaction_status|gross_amount)\b|\b([Ss]nap|SNAP)\b/g;

export const guardKosakataBayar: Guard = {
  kode: "h",
  nama: "kosakata-bayar",
  keterangan: "order_id/transaction_status/gross_amount/snap hanya di lib/adaptor/bayar",
  periksa(k) {
    const temuan: Temuan[] = [];
    for (const b of k.berkas) {
      if (!adalahKode(b.jalur) || adalahGuard(b.jalur) || b.jalur.startsWith(DIIZINKAN)) continue;
      temuan.push(...temukan(b, bersihkanKode(b.isi), POLA, (m) => `kosakata pembayaran "${m[1] ?? m[2]}" di luar ${DIIZINKAN}`));
    }
    return diperiksa(temuan);
  },
};
