import { createHash } from "node:crypto";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function configurationError() {
  return new Error("Faltan las variables de entorno de Supabase en el servidor.");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function supabaseRequest(path, options = {}) {
  if (!supabaseUrl || !serviceRoleKey) throw configurationError();

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase respondió ${response.status}: ${detail}`);
  }

  if (response.status === 204) return null;
  return response.json();
}
