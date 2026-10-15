-- SERAH S08 — nilai final per kolom rincian, ujung rantai berkunci, pembanding R-04, timeline serah,
-- dan penyimpanan respons idempoten. Dijalankan sebagai serah_migrasi.

-- ═══ 1. Nilai final: RINCIAN_DITERIMA → diterima_g, RINCIAN_DITOLAK → ditolak_g ═══
DROP VIEW v_nilai_final;
CREATE VIEW v_nilai_final WITH (security_invoker = true) AS
WITH terakhir AS (
  SELECT DISTINCT ON (target_jenis, target_id) target_jenis, target_id, nilai_final_g
  FROM koreksi
  ORDER BY target_jenis, target_id, dibuat_pada DESC, id DESC
), jumlah AS (
  SELECT target_jenis, target_id, count(*)::int AS n FROM koreksi GROUP BY target_jenis, target_id
)
SELECT 'WADAH'::"TargetKoreksi" AS target_jenis, w.id AS target_id, w.berat_g AS nilai_asli_g,
       coalesce(t.nilai_final_g, w.berat_g) AS nilai_final_g, coalesce(j.n, 0) AS jumlah_koreksi
FROM wadah_catat w
LEFT JOIN terakhir t ON t.target_jenis = 'WADAH' AND t.target_id = w.id
LEFT JOIN jumlah j ON j.target_jenis = 'WADAH' AND j.target_id = w.id
UNION ALL
SELECT 'TIKET'::"TargetKoreksi", k.id, k.berat_g, coalesce(t.nilai_final_g, k.berat_g), coalesce(j.n, 0)
FROM tiket_timbang k
LEFT JOIN terakhir t ON t.target_jenis = 'TIKET' AND t.target_id = k.id
LEFT JOIN jumlah j ON j.target_jenis = 'TIKET' AND j.target_id = k.id
UNION ALL
SELECT 'RINCIAN_DITERIMA'::"TargetKoreksi", r.id, r.diterima_g, coalesce(t.nilai_final_g, r.diterima_g), coalesce(j.n, 0)
FROM penutupan_rincian r
LEFT JOIN terakhir t ON t.target_jenis = 'RINCIAN_DITERIMA' AND t.target_id = r.id
LEFT JOIN jumlah j ON j.target_jenis = 'RINCIAN_DITERIMA' AND j.target_id = r.id
UNION ALL
SELECT 'RINCIAN_DITOLAK'::"TargetKoreksi", r.id, r.ditolak_g, coalesce(t.nilai_final_g, r.ditolak_g), coalesce(j.n, 0)
FROM penutupan_rincian r
LEFT JOIN terakhir t ON t.target_jenis = 'RINCIAN_DITOLAK' AND t.target_id = r.id
LEFT JOIN jumlah j ON j.target_jenis = 'RINCIAN_DITOLAK' AND j.target_id = r.id;
GRANT SELECT ON v_nilai_final TO serah_app;

-- ═══ 2. Ujung rantai kawasan, di bawah pg_advisory_xact_lock (§F.2) ═══
-- Penerima/pengangkut tidak boleh membaca event kawasan yang bukan pihaknya (RLS), tetapi butuh hash terakhir
-- untuk menyambung rantai. Fungsi ini mengunci rantai kawasan sampai transaksi selesai dan hanya mengembalikan
-- (urutan_rantai, hash) terakhir — tidak pernah isi event. Hash event baru tetap dihitung core/rantai.
CREATE FUNCTION kunci_ujung_rantai(p_kawasan_id text)
  RETURNS TABLE (ujung_urutan integer, ujung_hash text)
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path FROM CURRENT AS $$
BEGIN
  IF NOT app_terkait_kawasan(p_kawasan_id) THEN
    RAISE EXCEPTION 'TIDAK_BOLEH: bukan pihak terkait kawasan' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('serah:rantai:' || p_kawasan_id, 0));
  RETURN QUERY
    SELECT e.urutan_rantai, e.hash::text FROM event e
    WHERE e.kawasan_id = p_kawasan_id ORDER BY e.urutan_rantai DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, repeat('0', 64);
  END IF;
END
$$;

-- ═══ 3. Pembanding R-04: dHash foto MUATAN milik organisasi pengangkut atau terkait kawasan (jendela waktu) ═══
-- Hanya dHash, kode serah, dan waktu — tidak pernah objek foto.
CREATE FUNCTION foto_pembanding_r04(p_kawasan_id text, p_org_pengangkut text, p_sejak timestamptz, p_kecuali text)
  RETURNS TABLE (p_dhash text, p_kode_serah text, p_diterima_pada timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path FROM CURRENT AS $$
  SELECT f.dhash::text, coalesce(s.kode, '-'), f.diterima_pada
  FROM foto f
  LEFT JOIN serah s ON s.id = f.serah_id
  WHERE f.jenis = 'MUATAN'
    AND f.diterima_pada >= p_sejak
    AND f.id <> coalesce(p_kecuali, '')
    AND (f.organisasi_id = p_org_pengangkut
         OR s.kawasan_id = p_kawasan_id
         OR f.organisasi_id = (SELECT k.organisasi_id FROM kawasan k WHERE k.id = p_kawasan_id))
    AND (app_akses_penuh() OR (p_org_pengangkut = ANY (app_org_ids()) AND app_terkait_kawasan(p_kawasan_id)))
$$;

-- ═══ 4. Timeline serah tanpa payload, untuk semua pihak serah (event lama bisa belum memuat pihak baru) ═══
CREATE FUNCTION timeline_serah(p_serah_id text)
  RETURNS TABLE (t_urutan_rantai integer, t_jenis text, t_peran text, t_terjadi_pada timestamptz, t_diterima_pada timestamptz, t_hash text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path FROM CURRENT AS $$
  SELECT e.urutan_rantai, e.jenis::text, e.peran::text, e.terjadi_pada, e.diterima_pada, e.hash::text
  FROM event e
  WHERE e.serah_id = p_serah_id AND app_terkait_serah(p_serah_id)
  ORDER BY e.urutan_rantai
$$;

-- ═══ 5. Respons idempoten (CLAUDE.md §2.2: kiriman ganda → satu efek, respons sama) ═══
-- Bukan catat-saja: hanya cermin respons sukses per Idempotency-Key, boleh dibersihkan.
CREATE TABLE "respons_idempoten" (
    "kunci" TEXT NOT NULL,
    "organisasi_id" TEXT NOT NULL,
    "rute" TEXT NOT NULL,
    "status_http" INTEGER NOT NULL,
    "isi" JSONB NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respons_idempoten_pkey" PRIMARY KEY ("kunci")
);
CREATE INDEX "respons_idempoten_organisasi_id_dibuat_pada_idx" ON "respons_idempoten"("organisasi_id", "dibuat_pada");
ALTER TABLE "respons_idempoten" ADD CONSTRAINT "respons_idempoten_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
GRANT SELECT, INSERT, UPDATE, DELETE ON respons_idempoten TO serah_app;
ALTER TABLE respons_idempoten ENABLE ROW LEVEL SECURITY;
CREATE POLICY organisasi ON respons_idempoten FOR ALL
  USING (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh())
  WITH CHECK (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh());
