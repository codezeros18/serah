-- S07: persetujuan PDP dicatat SEBELUM baris pengguna dibuat, dalam transaksi yang sama (CLAUDE.md §2.5, §P.2).
-- FK diperiksa saat COMMIT, sehingga INSERT persetujuan_pdp boleh mendahului INSERT pengguna.
ALTER TABLE persetujuan_pdp ALTER CONSTRAINT persetujuan_pdp_pengguna_id_fkey DEFERRABLE INITIALLY DEFERRED;
