-- SERAH S08 — sasaran koreksi rincian dipecah per kolom (keputusan pemilik 15 Okt 2026):
-- satu baris koreksi = satu nilai. RINCIAN lama selalu berarti diterima_g (v_nilai_final S01).
-- Terpisah dari migrasi berikutnya: nilai enum baru belum boleh dipakai di transaksi yang sama.
ALTER TYPE "TargetKoreksi" RENAME VALUE 'RINCIAN' TO 'RINCIAN_DITERIMA';
ALTER TYPE "TargetKoreksi" ADD VALUE 'RINCIAN_DITOLAK';
