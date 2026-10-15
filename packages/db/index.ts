import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";
import { uraiUrlDb } from "./url.ts";

export * from "./generated/prisma/client.ts";
export { uraiUrlDb };

/** Klien Prisma lewat driver adapter pg. search_path diatur agar SQL mentah & fungsi DB ikut skema yang sama. */
export function buatPrisma(url: string): PrismaClient {
  const { connectionString, skema } = uraiUrlDb(url);
  const adapter = new PrismaPg({ connectionString, options: `-c search_path=${skema}` }, { schema: skema });
  return new PrismaClient({ adapter });
}
