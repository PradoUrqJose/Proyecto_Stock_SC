import { createClient, type Client } from "@libsql/client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} no está definida. Verifica tu archivo .env.local`
    );
  }
  return value;
}

const TURSO_URL = requireEnv("TURSO_CONNECTION_URL");
const TURSO_TOKEN = requireEnv("TURSO_AUTH_TOKEN");

let _client: Client | null = null;

export function getTurso(): Client {
  if (!_client) {
    _client = createClient({
      url: TURSO_URL,
      authToken: TURSO_TOKEN,
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
