#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const token = process.argv[2];
const siteUrl = process.argv[3] || "https://invboda-xi.vercel.app";
const tokenPattern = /^inv1_[a-f0-9]{64}$/;

function loadLocalEnvironment() {
  const file = resolve(".env.local");
  if (!existsSync(file)) return;

  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

async function request(label, url, options = {}) {
  console.log(`\n${label}`);
  try {
    const response = await fetch(url, options);
    const body = await response.text();
    console.log(`HTTP ${response.status} ${response.statusText}`);
    console.log(body || "(sin contenido)");
    return { response, body };
  } catch (error) {
    console.log(`No fue posible conectar: ${error.message}`);
    return { response: null, body: "" };
  }
}

if (!tokenPattern.test(token || "")) {
  console.error("Uso: npm run diagnose:invitation -- <token> [https://tu-dominio.vercel.app]");
  process.exit(1);
}

console.log("Diagnóstico de invitación (las claves nunca se imprimen).");
await request(
  "1. Respuesta de la API publicada:",
  `${siteUrl.replace(/\/$/, "")}/api/invitation?token=${encodeURIComponent(token)}`
);

loadLocalEnvironment();
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.log("\n2. Consulta directa a Supabase: omitida.");
  console.log("Crea .env.local a partir de .env.example con las mismas variables de Vercel y vuelve a ejecutar el comando.");
  process.exit(0);
}

const tokenHash = createHash("sha256").update(token).digest("hex");
const query = new URL(`${supabaseUrl}/rest/v1/invitation_tokens`);
query.searchParams.set("select", "id,invited_guest_count,expires_at,revoked_at,families(display_name),rsvp_responses(status,confirmed_guest_count,optional_message)");
query.searchParams.set("token_hash", `eq.${tokenHash}`);
query.searchParams.set("limit", "1");

try {
  const { response } = await request("2. Misma consulta directa a Supabase:", query, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });

  if (!response || !response.ok) {
    console.log("\nLa configuración, permisos o relación entre tablas de Supabase es el origen del problema.");
  } else {
    console.log("\nLa consulta principal funciona. Revisa en Vercel los Function Logs de /api/invitation para el error de ejecución.");
  }
} catch (error) {
  console.error("\nNo se pudo conectar a Supabase:", error.message);
  process.exitCode = 1;
}
