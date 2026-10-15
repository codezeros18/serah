// Idempotensi aksi perangkat (CLAUDE.md §2.2, BLUEPRINT §F.6/§I.2). Murni: keadaan & catatan kunci masuk
// sebagai argumen, keluar sebagai nilai baru. Satu kunci = satu efek; kiriman ulang mendapat respons yang sama.
//
// - Kunci sudah tercatat (kiriman sebelumnya atau lebih awal di batch ini) → DUPLIKAT + respons tersimpan.
// - Aksi ditolak (mis. TRANSISI_TIDAK_SAH karena status sudah berubah) → DITOLAK, tidak dicatat,
//   sehingga kiriman ulang dinilai ulang terhadap keadaan saat itu.
// - Urutan penerapan = urutan kiriman; tiap aksi dinilai terhadap keadaan saat diterima server.

export type HasilAksiBatch<R, G> =
  | { idempotencyKey: string; status: "DITERAPKAN" | "DUPLIKAT"; hasil: R }
  | { idempotencyKey: string; status: "DITOLAK"; galat: G };

export type TerapkanSatu<A, S, R, G> = (keadaan: S, aksi: A) => { ok: true; keadaan: S; hasil: R } | { ok: false; galat: G };

export type HasilBatch<S, R, G> = {
  hasil: HasilAksiBatch<R, G>[];
  keadaan: S;
  /** Kunci yang baru diterapkan di batch ini beserta responsnya (untuk disimpan). */
  tercatatBaru: Map<string, R>;
};

export function terapkanBatch<A extends { idempotencyKey: string }, S, R, G>(
  batch: readonly A[],
  awal: { keadaan: S; tercatat: ReadonlyMap<string, R> },
  terapkan: TerapkanSatu<A, S, R, G>,
): HasilBatch<S, R, G> {
  let keadaan = awal.keadaan;
  const tercatatBaru = new Map<string, R>();
  const hasil: HasilAksiBatch<R, G>[] = [];

  for (const aksi of batch) {
    const kunci = aksi.idempotencyKey;
    const lama = awal.tercatat.has(kunci) ? { r: awal.tercatat.get(kunci) as R } : tercatatBaru.has(kunci) ? { r: tercatatBaru.get(kunci) as R } : null;
    if (lama) {
      hasil.push({ idempotencyKey: kunci, status: "DUPLIKAT", hasil: lama.r });
      continue;
    }
    const h = terapkan(keadaan, aksi);
    if (!h.ok) {
      hasil.push({ idempotencyKey: kunci, status: "DITOLAK", galat: h.galat });
      continue;
    }
    keadaan = h.keadaan;
    tercatatBaru.set(kunci, h.hasil);
    hasil.push({ idempotencyKey: kunci, status: "DITERAPKAN", hasil: h.hasil });
  }

  return { hasil, keadaan, tercatatBaru };
}
