import { createClient } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";

const directory = new URL("../drizzle/", import.meta.url);
const database = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

try {
  await database.execute("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)");
  const files = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, directory), "utf8");
    const tx = await database.transaction("write");
    try {
      const { rows } = await tx.execute({ sql: "SELECT name FROM schema_migrations WHERE name = ?", args: [file] });
      if (!rows.length) {
        await tx.executeMultiple(sql);
        await tx.execute({ sql: "INSERT INTO schema_migrations (name) VALUES (?)", args: [file] });
      }
      await tx.commit();
    } finally {
      tx.close();
    }
  }
} finally {
  database.close();
}
