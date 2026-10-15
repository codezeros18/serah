/** Pisahkan parameter `?schema=` (worktree memakai skema wt_sxx) dari URL koneksi Postgres. */
export function uraiUrlDb(url: string): { connectionString: string; skema: string } {
  const u = new URL(url);
  const skema = u.searchParams.get("schema") ?? "public";
  u.searchParams.delete("schema");
  if (!/^[a-z_][a-z0-9_]*$/.test(skema)) throw new Error("Nama skema DB tidak sah");
  return { connectionString: u.toString(), skema };
}
