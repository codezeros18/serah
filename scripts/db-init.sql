-- Inisialisasi role basis data SERAH. Dijalankan SEKALI oleh superuser pada basis data aplikasi
-- (Docker lokal via docker-entrypoint-initdb.d, CI via psql). Idempoten.
--
--   serah_migrasi : pemilik basis data, skema & semua tabel; dipakai migrasi (DATABASE_URL_MIGRASI).
--   serah_app     : role runtime (DATABASE_URL) — bukan superuser, bukan pemilik tabel, NOBYPASSRLS.
--
-- Sandi di bawah HANYA untuk Postgres lokal & CI. Produksi memakai sandi kuat dari penyedia.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'serah_migrasi') THEN
    CREATE ROLE serah_migrasi LOGIN PASSWORD 'serah_migrasi_dev' NOSUPERUSER CREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'serah_app') THEN
    CREATE ROLE serah_app LOGIN PASSWORD 'serah_app_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

-- Penegasan atribut (bila role sudah ada dari sebelumnya).
ALTER ROLE serah_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
ALTER ROLE serah_migrasi NOSUPERUSER NOBYPASSRLS;

DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I OWNER TO serah_migrasi', current_database());
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO serah_app', current_database());
END
$$;

ALTER SCHEMA public OWNER TO serah_migrasi;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO serah_app;

-- Hak bawaan untuk objek yang kelak dibuat serah_migrasi. Tabel catat-saja dicabut UPDATE/DELETE-nya di migrasi.
ALTER DEFAULT PRIVILEGES FOR ROLE serah_migrasi IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO serah_app;
ALTER DEFAULT PRIVILEGES FOR ROLE serah_migrasi IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO serah_app;
ALTER DEFAULT PRIVILEGES FOR ROLE serah_migrasi IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO serah_app;
