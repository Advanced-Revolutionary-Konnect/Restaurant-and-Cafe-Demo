import { createClient } from "@libsql/client";

let client;
function connection() {
  client ??= createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return client;
}

function prepare(sql) {
  return {
    bind(...args) {
      const statement = { sql, args };
      return {
        statement,
        async first() {
          const result = await connection().execute(statement);
          return result.rows[0] ?? null;
        },
        async run() {
          const result = await connection().execute(statement);
          return { meta: { changes: result.rowsAffected } };
        },
      };
    },
  };
}

export const database = {
  prepare,
  batch(statements) {
    return connection().batch(statements.map(item => item.statement), "write");
  },
};
