-- SERAH S01 — catat-saja (🔒), CHECK, view nilai final, retensi foto, rantai hash, RLS.
-- Dijalankan sebagai serah_migrasi (pemilik). Role runtime serah_app: bukan pemilik, NOBYPASSRLS.
-- Semua nama tanpa kualifikasi skema: berlaku di skema migrasi (public, atau wt_sxx di worktree).

-- ═══ 0. Hak role runtime atas skema ini (aman diulang; skema bisa dibuat ulang oleh migrate reset) ═══
DO $$
BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO serah_app', current_schema());
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO serah_app', current_schema());
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO serah_app', current_schema());
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO serah_app', current_schema());
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO serah_app', current_schema());
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO serah_app', current_schema());
  -- Tabel riwayat migrasi bukan urusan role runtime (tidak ada di shadow database).
  IF to_regclass('_prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON TABLE _prisma_migrations FROM serah_app;
  END IF;
END
$$;

-- ═══ 1. Konteks akses (diisi SET LOCAL oleh denganAkses/denganAdmin/denganSistem/denganAuth) ═══
CREATE FUNCTION app_org_ids() RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('app.org_ids', true), ''), '{}')::text[]
$$;

CREATE FUNCTION app_pengguna_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.pengguna_id', true), '')
$$;

CREATE FUNCTION app_akses_penuh() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.admin', true), '') = 'true'
      OR coalesce(current_setting('app.sistem', true), '') = 'true'
$$;

CREATE FUNCTION app_konteks_auth() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.auth', true), '') = 'true'
$$;

CREATE FUNCTION app_ada_konteks() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT app_pengguna_id() IS NOT NULL OR app_akses_penuh() OR app_konteks_auth()
$$;

CREATE FUNCTION app_milik(VARIADIC org text[]) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT org && app_org_ids()
$$;

-- Pembantu SECURITY DEFINER (membaca tanpa RLS, menghindari rekursi kebijakan). Hanya mengembalikan boolean.
CREATE FUNCTION app_terkait_kawasan(p_kawasan_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path FROM CURRENT AS $$
  SELECT app_akses_penuh()
      OR EXISTS (SELECT 1 FROM kawasan k WHERE k.id = p_kawasan_id AND k.organisasi_id = ANY (app_org_ids()))
      OR EXISTS (SELECT 1 FROM kontrak c WHERE c.kawasan_id = p_kawasan_id
                   AND (c.org_pengangkut_id = ANY (app_org_ids()) OR c.org_penerima_id = ANY (app_org_ids())))
$$;

CREATE FUNCTION app_pengangkut_kawasan(p_kawasan_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path FROM CURRENT AS $$
  SELECT EXISTS (SELECT 1 FROM kontrak c WHERE c.kawasan_id = p_kawasan_id AND c.status = 'AKTIF'
                   AND c.org_pengangkut_id = ANY (app_org_ids()))
$$;

CREATE FUNCTION app_terkait_serah(p_serah_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path FROM CURRENT AS $$
  SELECT p_serah_id IS NOT NULL AND (
    app_akses_penuh()
    OR EXISTS (SELECT 1 FROM serah s WHERE s.id = p_serah_id AND (
         ARRAY[s.org_kawasan_id, s.org_pengangkut_id, s.org_penerima_id] && app_org_ids()
         OR (s.status = 'DRAF' AND app_pengangkut_kawasan(s.kawasan_id))))
  )
$$;

-- ═══ 2. Tabel catat-saja 🔒: trigger penolak + pencabutan hak (dua lapis) ═══
CREATE FUNCTION tolak_ubah_catat_saja() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Satu-satunya pengecualian: penanda retensi foto lewat tandai_foto_dihapus_retensi().
  IF TG_TABLE_NAME = 'foto' AND TG_OP = 'UPDATE'
     AND coalesce(current_setting('app.retensi_foto', true), '') = 'true' THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'CATAT_SAJA: % pada tabel % ditolak; koreksi = baris baru', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'teks_persetujuan', 'persetujuan_pdp', 'izin_putusan', 'wadah_catat', 'event', 'foto', 'tiket_timbang',
    'penutupan_rincian', 'koreksi', 'permintaan_koreksi', 'permintaan_koreksi_putusan', 'aturan_versi',
    'prakiraan_cuaca', 'peringatan_cuaca', 'prioritas_tercatat', 'harga_material', 'ekspor', 'bayangan_entri',
    'tagihan_angkut', 'perubahan_paket', 'peristiwa_langganan', 'peristiwa_bayar', 'konfirmasi_manual', 'audit_log'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION tolak_ubah_catat_saja()',
      t || '_catat_saja', t);
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON %I FROM serah_app, PUBLIC', t);
  END LOOP;
END
$$;

-- Penanda retensi foto: objek dihapus dari penyimpanan, baris tetap. Hanya konteks sistem (cron).
CREATE FUNCTION tandai_foto_dihapus_retensi(p_foto_id text) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path FROM CURRENT AS $$
DECLARE
  n integer;
BEGIN
  IF NOT app_akses_penuh() THEN
    RAISE EXCEPTION 'TIDAK_BOLEH: retensi foto hanya dari konteks sistem' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.retensi_foto', 'true', true);
  UPDATE foto SET dihapus_retensi_pada = now() WHERE id = p_foto_id AND dihapus_retensi_pada IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.retensi_foto', 'false', true);
  RETURN n > 0;
END
$$;

-- ═══ 3. CHECK ═══
ALTER TABLE wadah_catat
  ADD CONSTRAINT wadah_catat_berat_atau_jumlah CHECK (berat_g IS NOT NULL OR jumlah_wadah IS NOT NULL),
  ADD CONSTRAINT wadah_catat_berat_rentang CHECK (berat_g IS NULL OR berat_g BETWEEN 1 AND 5000000),
  ADD CONSTRAINT wadah_catat_jumlah_positif CHECK (jumlah_wadah IS NULL OR jumlah_wadah >= 1);
ALTER TABLE pengguna ADD CONSTRAINT pengguna_email_huruf_kecil CHECK (email IS NULL OR email = lower(email));
ALTER TABLE event
  ADD CONSTRAINT event_hash_hex CHECK (hash ~ '^[0-9a-f]{64}$' AND prev_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT event_urutan_rantai_positif CHECK (urutan_rantai >= 1);
ALTER TABLE serah ADD CONSTRAINT serah_versi_tidak_negatif CHECK (versi >= 0);
ALTER TABLE tiket_timbang ADD CONSTRAINT tiket_berat_positif CHECK (berat_g >= 1);
ALTER TABLE penutupan_rincian ADD CONSTRAINT rincian_berat_tidak_negatif CHECK (diterima_g >= 0 AND ditolak_g >= 0);
ALTER TABLE koreksi ADD CONSTRAINT koreksi_nilai_tidak_negatif CHECK (nilai_asli_g >= 0 AND nilai_final_g >= 0);
ALTER TABLE permintaan_koreksi ADD CONSTRAINT permintaan_nilai_tidak_negatif CHECK (nilai_usulan_g >= 0);
ALTER TABLE kontrak
  ADD CONSTRAINT kontrak_rentang_berlaku CHECK (berlaku_sampai >= berlaku_dari),
  ADD CONSTRAINT kontrak_tarif_tidak_negatif CHECK (coalesce(tarif_per_rit_idr, 0) >= 0 AND coalesce(tarif_per_kg_idr, 0) >= 0),
  ADD CONSTRAINT kontrak_aliran_tidak_kosong CHECK (cardinality(aliran) >= 1);
ALTER TABLE tps ADD CONSTRAINT tps_koordinat_rentang
  CHECK (lat_e6 BETWEEN -90000000 AND 90000000 AND lon_e6 BETWEEN -180000000 AND 180000000);
ALTER TABLE kawasan ADD CONSTRAINT kawasan_adm4_pola CHECK (adm4 ~ '^\d{2}\.\d{2}\.\d{2}\.\d{4}$');
ALTER TABLE foto
  ADD CONSTRAINT foto_dhash_hex CHECK (dhash ~ '^[0-9a-f]{16}$'),
  ADD CONSTRAINT foto_ukuran_positif CHECK (ukuran_byte > 0 AND lebar > 0 AND tinggi > 0);
ALTER TABLE harga_material ADD CONSTRAINT harga_positif
  CHECK (harga_bersih_idr_per_kg > 0 AND (harga_kotor_idr_per_kg IS NULL OR harga_kotor_idr_per_kg > 0));
ALTER TABLE bayangan_entri ADD CONSTRAINT bayangan_berat_positif CHECK (berat_g >= 1);
ALTER TABLE tagihan_angkut ADD CONSTRAINT tagihan_angkut_tidak_negatif
  CHECK (rit_tertutup >= 0 AND kg_diterima_g >= 0 AND total_idr >= 0);
ALTER TABLE paket ADD CONSTRAINT paket_harga_tidak_negatif CHECK (harga_per_tps_idr >= 0);
ALTER TABLE tagihan ADD CONSTRAINT tagihan_tidak_negatif CHECK (jumlah_tps >= 0 AND harga_per_tps_idr >= 0 AND total_idr >= 0);
ALTER TABLE batas_laju ADD CONSTRAINT batas_laju_hitungan CHECK (hitungan >= 0);

-- ═══ 4. Nilai final: nilai asli tidak pernah berubah; koreksi terakhir menang ═══
-- WADAH → wadah_catat.berat_g · TIKET → tiket_timbang.berat_g · RINCIAN → penutupan_rincian.diterima_g
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
SELECT 'RINCIAN'::"TargetKoreksi", r.id, r.diterima_g, coalesce(t.nilai_final_g, r.diterima_g), coalesce(j.n, 0)
FROM penutupan_rincian r
LEFT JOIN terakhir t ON t.target_jenis = 'RINCIAN' AND t.target_id = r.id
LEFT JOIN jumlah j ON j.target_jenis = 'RINCIAN' AND j.target_id = r.id;

-- ═══ 5. Rantai hash per kawasan (§F.3) ═══
-- JSON kanonis: kunci objek terurut leksikografis (byte, COLLATE "C"), tanpa spasi; urutan larik dipertahankan.
CREATE FUNCTION json_kanonis(j jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  hasil text;
BEGIN
  CASE jsonb_typeof(j)
    WHEN 'object' THEN
      SELECT '{' || coalesce(string_agg(to_jsonb(k)::text || ':' || json_kanonis(v), ',' ORDER BY k COLLATE "C"), '') || '}'
        INTO hasil FROM jsonb_each(j) AS x(k, v);
    WHEN 'array' THEN
      SELECT '[' || coalesce(string_agg(json_kanonis(v), ',' ORDER BY i), '') || ']'
        INTO hasil FROM jsonb_array_elements(j) WITH ORDINALITY AS x(v, i);
    ELSE
      hasil := j::text;
  END CASE;
  RETURN hasil;
END
$$;

-- hash = SHA-256( prev ‖ "|" ‖ jenis ‖ "|" ‖ serah_kode|"-" ‖ "|" ‖ peran|"-" ‖ "|" ‖ payload_kanonis ‖ "|" ‖ diterima_pada ISO UTC ms ), hex kecil.
CREATE FUNCTION hash_event(
  p_prev_hash text, p_jenis text, p_serah_kode text, p_peran text, p_payload jsonb, p_diterima_pada timestamptz
) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT encode(sha256(convert_to(
    p_prev_hash || '|' || p_jenis || '|' || coalesce(p_serah_kode, '-') || '|' || coalesce(p_peran, '-') || '|'
    || json_kanonis(p_payload) || '|'
    || to_char(p_diterima_pada AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'UTF8')), 'hex')
$$;

-- Hanya mengembalikan {utuh, jumlah, patah_di_urutan}, tidak pernah isi event; untuk pihak terkait kawasan.
CREATE FUNCTION verifikasi_rantai(p_kawasan_id text)
  RETURNS TABLE (utuh boolean, jumlah integer, patah_di_urutan integer)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path FROM CURRENT AS $$
DECLARE
  r record;
  harap text := repeat('0', 64);
  n integer := 0;
BEGIN
  IF NOT app_terkait_kawasan(p_kawasan_id) THEN
    RAISE EXCEPTION 'TIDAK_BOLEH: bukan pihak terkait kawasan' USING ERRCODE = '42501';
  END IF;
  FOR r IN
    SELECT e.urutan_rantai, e.prev_hash, e.hash, e.jenis::text AS jenis, s.kode AS serah_kode,
           e.peran::text AS peran, e.payload, e.diterima_pada
    FROM event e LEFT JOIN serah s ON s.id = e.serah_id
    WHERE e.kawasan_id = p_kawasan_id
    ORDER BY e.urutan_rantai
  LOOP
    n := n + 1;
    IF r.urutan_rantai <> n OR r.prev_hash <> harap
       OR r.hash <> hash_event(r.prev_hash, r.jenis, r.serah_kode, r.peran, r.payload, r.diterima_pada) THEN
      RETURN QUERY SELECT false, (SELECT count(*)::integer FROM event WHERE kawasan_id = p_kawasan_id), r.urutan_rantai;
      RETURN;
    END IF;
    harap := r.hash;
  END LOOP;
  RETURN QUERY SELECT true, n, NULL::integer;
END
$$;

-- ═══ 6. Row-Level Security ═══
-- Pola: kebijakan `baca` (FOR SELECT, lebih luas) + `tulis` (FOR ALL, lebih sempit). Kebijakan permisif digabung OR.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;

-- Identitas & akses
CREATE POLICY milik_sendiri ON pengguna FOR ALL
  USING (id = app_pengguna_id() OR app_konteks_auth() OR app_akses_penuh())
  WITH CHECK (id = app_pengguna_id() OR app_konteks_auth() OR app_akses_penuh());
CREATE POLICY milik_sendiri ON sesi FOR ALL
  USING (pengguna_id = app_pengguna_id() OR app_konteks_auth() OR app_akses_penuh())
  WITH CHECK (pengguna_id = app_pengguna_id() OR app_konteks_auth() OR app_akses_penuh());
CREATE POLICY milik_sendiri ON token_sekali FOR ALL
  USING (pengguna_id = app_pengguna_id() OR organisasi_id = ANY (app_org_ids()) OR app_konteks_auth() OR app_akses_penuh())
  WITH CHECK (pengguna_id = app_pengguna_id() OR organisasi_id = ANY (app_org_ids()) OR app_konteks_auth() OR app_akses_penuh());
CREATE POLICY baca ON teks_persetujuan FOR SELECT USING (true);
CREATE POLICY tulis ON teks_persetujuan FOR ALL USING (app_akses_penuh()) WITH CHECK (app_akses_penuh());
CREATE POLICY milik_sendiri ON persetujuan_pdp FOR ALL
  USING (pengguna_id = app_pengguna_id() OR app_konteks_auth() OR app_akses_penuh())
  WITH CHECK (pengguna_id = app_pengguna_id() OR app_konteks_auth() OR app_akses_penuh());

CREATE POLICY baca ON organisasi FOR SELECT USING (
  id = ANY (app_org_ids())
  OR (jenis IN ('PENGANGKUT', 'PENERIMA') AND app_ada_konteks())
  OR EXISTS (SELECT 1 FROM kontrak c WHERE c.org_kawasan_id = organisasi.id)
  OR app_konteks_auth() OR app_akses_penuh());
CREATE POLICY tambah ON organisasi FOR INSERT WITH CHECK (app_pengguna_id() IS NOT NULL OR app_akses_penuh());
CREATE POLICY ubah ON organisasi FOR UPDATE
  USING (id = ANY (app_org_ids()) OR app_akses_penuh()) WITH CHECK (id = ANY (app_org_ids()) OR app_akses_penuh());
CREATE POLICY hapus ON organisasi FOR DELETE USING (app_akses_penuh());

CREATE POLICY anggota ON keanggotaan FOR ALL
  USING (pengguna_id = app_pengguna_id() OR organisasi_id = ANY (app_org_ids()) OR app_konteks_auth() OR app_akses_penuh())
  WITH CHECK (pengguna_id = app_pengguna_id() OR organisasi_id = ANY (app_org_ids()) OR app_konteks_auth() OR app_akses_penuh());
CREATE POLICY organisasi ON izin_putusan FOR ALL
  USING (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh())
  WITH CHECK (app_akses_penuh());

-- Kawasan & mitra
CREATE POLICY baca ON kawasan FOR SELECT USING (app_terkait_kawasan(id));
CREATE POLICY tulis ON kawasan FOR ALL
  USING (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh())
  WITH CHECK (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh());
CREATE POLICY baca ON tps FOR SELECT USING (app_terkait_kawasan(kawasan_id));
CREATE POLICY tulis ON tps FOR ALL
  USING (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh())
  WITH CHECK (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh());
CREATE POLICY baca ON kendaraan FOR SELECT USING (
  organisasi_id = ANY (app_org_ids()) OR app_akses_penuh()
  OR EXISTS (SELECT 1 FROM serah s WHERE s.kendaraan_id = kendaraan.id));
CREATE POLICY tulis ON kendaraan FOR ALL
  USING (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh())
  WITH CHECK (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh());
CREATE POLICY pihak ON kontrak FOR ALL
  USING (app_milik(org_kawasan_id, org_pengangkut_id, org_penerima_id) OR app_akses_penuh())
  WITH CHECK (app_milik(org_kawasan_id, org_pengangkut_id, org_penerima_id) OR app_akses_penuh());

-- Inti serah
CREATE POLICY baca ON wadah_catat FOR SELECT USING (
  org_kawasan_id = ANY (app_org_ids()) OR app_akses_penuh()
  OR EXISTS (SELECT 1 FROM serah_wadah sw WHERE sw.wadah_catat_id = wadah_catat.id AND app_terkait_serah(sw.serah_id)));
CREATE POLICY tulis ON wadah_catat FOR ALL
  USING (org_kawasan_id = ANY (app_org_ids()) OR app_akses_penuh())
  WITH CHECK (org_kawasan_id = ANY (app_org_ids()) OR app_akses_penuh());
-- Pengangkut berkontrak AKTIF melihat (dan mengambil) serah DRAF kawasan itu sebelum menjadi pihaknya.
CREATE POLICY pihak ON serah FOR ALL
  USING (app_milik(org_kawasan_id, org_pengangkut_id, org_penerima_id) OR app_akses_penuh()
         OR (status = 'DRAF' AND app_pengangkut_kawasan(kawasan_id)))
  WITH CHECK (app_milik(org_kawasan_id, org_pengangkut_id, org_penerima_id) OR app_akses_penuh());
CREATE POLICY pihak ON serah_wadah FOR ALL
  USING (app_terkait_serah(serah_id)) WITH CHECK (app_terkait_serah(serah_id));
CREATE POLICY pihak ON event FOR ALL
  USING (app_milik(org_kawasan_id, org_pengangkut_id, org_penerima_id) OR app_akses_penuh())
  WITH CHECK (app_milik(org_kawasan_id, org_pengangkut_id, org_penerima_id) OR app_akses_penuh());
CREATE POLICY baca ON foto FOR SELECT USING (
  organisasi_id = ANY (app_org_ids()) OR app_akses_penuh() OR app_terkait_serah(serah_id));
CREATE POLICY tulis ON foto FOR ALL
  USING (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh())
  WITH CHECK (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh());
CREATE POLICY pihak ON tiket_timbang FOR ALL USING (app_terkait_serah(serah_id)) WITH CHECK (app_terkait_serah(serah_id));
CREATE POLICY pihak ON penutupan_rincian FOR ALL USING (app_terkait_serah(serah_id)) WITH CHECK (app_terkait_serah(serah_id));
CREATE POLICY pihak ON koreksi FOR ALL
  USING (org_kawasan_id = ANY (app_org_ids()) OR app_akses_penuh() OR app_terkait_serah(serah_id))
  WITH CHECK (org_kawasan_id = ANY (app_org_ids()) OR app_akses_penuh() OR app_terkait_serah(serah_id));
CREATE POLICY pihak ON permintaan_koreksi FOR ALL
  USING (app_milik(org_kawasan_id, org_penerima_id) OR app_akses_penuh())
  WITH CHECK (app_milik(org_kawasan_id, org_penerima_id) OR app_akses_penuh());
CREATE POLICY pihak ON permintaan_koreksi_putusan FOR ALL
  USING (app_akses_penuh() OR EXISTS (SELECT 1 FROM permintaan_koreksi p WHERE p.id = permintaan_id))
  WITH CHECK (app_akses_penuh() OR EXISTS (SELECT 1 FROM permintaan_koreksi p WHERE p.id = permintaan_id));

-- Data global hanya-baca: SELECT untuk semua; tulis hanya admin/sistem (atau pemilik lewat migrasi/seed).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['aturan_versi', 'prakiraan_cuaca', 'peringatan_cuaca', 'harga_material', 'alasan_tolak', 'paket', 'entitlement'] LOOP
    EXECUTE format('CREATE POLICY baca ON %I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY tulis ON %I FOR ALL USING (app_akses_penuh()) WITH CHECK (app_akses_penuh())', t);
  END LOOP;
END
$$;
CREATE POLICY baca ON prioritas_tercatat FOR SELECT USING (app_terkait_kawasan(kawasan_id));
CREATE POLICY tulis ON prioritas_tercatat FOR ALL
  USING (org_kawasan_id = ANY (app_org_ids()) OR app_akses_penuh())
  WITH CHECK (org_kawasan_id = ANY (app_org_ids()) OR app_akses_penuh());

-- Notifikasi & live (notifikasi dibuat oleh aksi pihak lain untuk organisasi tujuan)
CREATE POLICY baca ON notifikasi FOR SELECT USING (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh());
CREATE POLICY tambah ON notifikasi FOR INSERT WITH CHECK (app_ada_konteks());
CREATE POLICY milik_sendiri ON notifikasi_dibaca FOR ALL
  USING (pengguna_id = app_pengguna_id() OR app_akses_penuh()) WITH CHECK (pengguna_id = app_pengguna_id() OR app_akses_penuh());
CREATE POLICY milik_sendiri ON langganan_push FOR ALL
  USING (pengguna_id = app_pengguna_id() OR app_akses_penuh()) WITH CHECK (pengguna_id = app_pengguna_id() OR app_akses_penuh());
CREATE POLICY milik_sendiri ON preferensi_notifikasi FOR ALL
  USING (pengguna_id = app_pengguna_id() OR app_akses_penuh()) WITH CHECK (pengguna_id = app_pengguna_id() OR app_akses_penuh());

-- Laporan, ekspor, bayangan, tagihan angkut
CREATE POLICY organisasi ON ekspor FOR ALL
  USING (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh())
  WITH CHECK (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh());
CREATE POLICY organisasi ON bayangan_entri FOR ALL
  USING (org_kawasan_id = ANY (app_org_ids()) OR app_akses_penuh())
  WITH CHECK (org_kawasan_id = ANY (app_org_ids()) OR app_akses_penuh());
CREATE POLICY pihak ON tagihan_angkut FOR ALL
  USING (app_milik(org_kawasan_id, org_pengangkut_id) OR app_akses_penuh())
  WITH CHECK (app_milik(org_kawasan_id, org_pengangkut_id) OR app_akses_penuh());

-- Langganan & pembayaran
CREATE POLICY admin ON perubahan_paket FOR ALL USING (app_akses_penuh()) WITH CHECK (app_akses_penuh());
CREATE POLICY organisasi ON langganan FOR ALL
  USING (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh())
  WITH CHECK (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh());
CREATE POLICY organisasi ON peristiwa_langganan FOR ALL
  USING (app_akses_penuh() OR EXISTS (SELECT 1 FROM langganan l WHERE l.id = langganan_id))
  WITH CHECK (app_akses_penuh() OR EXISTS (SELECT 1 FROM langganan l WHERE l.id = langganan_id));
CREATE POLICY organisasi ON tagihan FOR ALL
  USING (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh())
  WITH CHECK (organisasi_id = ANY (app_org_ids()) OR app_akses_penuh());
CREATE POLICY organisasi ON peristiwa_bayar FOR ALL
  USING (app_akses_penuh() OR EXISTS (SELECT 1 FROM tagihan t WHERE t.id = tagihan_id))
  WITH CHECK (app_akses_penuh() OR EXISTS (SELECT 1 FROM tagihan t WHERE t.id = tagihan_id));
CREATE POLICY organisasi ON konfirmasi_manual FOR ALL
  USING (app_akses_penuh() OR EXISTS (SELECT 1 FROM tagihan t WHERE t.id = tagihan_id))
  WITH CHECK (app_akses_penuh());

-- Sistem
CREATE POLICY baca ON audit_log FOR SELECT USING (app_akses_penuh());
CREATE POLICY tambah ON audit_log FOR INSERT WITH CHECK (app_ada_konteks());
CREATE POLICY konteks ON batas_laju FOR ALL USING (app_ada_konteks()) WITH CHECK (app_ada_konteks());
CREATE POLICY konteks ON pekerjaan_cron FOR ALL USING (app_ada_konteks()) WITH CHECK (app_ada_konteks());
CREATE POLICY konteks ON penomoran FOR ALL USING (app_ada_konteks()) WITH CHECK (app_ada_konteks());
