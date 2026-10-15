// TPS yang terakhir dipindai petugas. Disimpan di perangkat agar pencatatan tetap bisa dilanjutkan
// tanpa sambungan setelah halaman dibuka ulang. Hanya id/kode/nama TPS dan kawasan (bukan data orang).

export interface TpsTerpilih {
  id: string;
  kode: string;
  nama: string;
  namaKawasan: string;
}

const KUNCI = "serah.petugas.tps";

export function bacaTpsTerpilih(): TpsTerpilih | null {
  try {
    const mentah = localStorage.getItem(KUNCI);
    if (!mentah) return null;
    const o: unknown = JSON.parse(mentah);
    if (typeof o !== "object" || o === null) return null;
    const { id, kode, nama, namaKawasan } = o as Record<string, unknown>;
    if (typeof id === "string" && typeof kode === "string" && typeof nama === "string" && typeof namaKawasan === "string") {
      return { id, kode, nama, namaKawasan };
    }
    return null;
  } catch {
    return null;
  }
}

export function simpanTpsTerpilih(t: TpsTerpilih): void {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(t));
  } catch {
    // Penyimpanan penuh/diblokir: TPS hanya berlaku selama halaman terbuka.
  }
}

/** QR TPS berisi token mentah atau URL yang berakhir/berparameter token. null bila bentuknya tidak masuk akal. */
export function ekstrakTokenQr(teks: string): string | null {
  const t = teks.trim();
  if (!t) return null;
  let kandidat = t;
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      kandidat = u.searchParams.get("token") ?? u.pathname.split("/").filter(Boolean).pop() ?? "";
    } catch {
      return null;
    }
  }
  return /^[A-Za-z0-9._~-]{16,200}$/.test(kandidat) ? kandidat : null;
}
