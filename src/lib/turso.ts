import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;

export function getTurso(): Client {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_CONNECTION_URL || "",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

// Legacy export for backward compatibility
export const turso = {
  get execute() {
    return getTurso().execute.bind(getTurso());
  },
  get batch() {
    return getTurso().batch.bind(getTurso());
  },
};
