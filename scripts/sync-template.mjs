import { readFile, writeFile } from "fs/promises";
import { join } from "path";

async function syncTemplate() {
  const root = process.cwd();
  const htmlPath = join(root, "public", "index.html");
  const targetPath = join(root, "lib", "invitation-template.js");

  const html = await readFile(htmlPath, "utf8");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) {
    throw new Error("No se encontró la etiqueta <body> en public/index.html");
  }

  // Remover scripts embebidos en el template para cargarlos ordenadamente en React
  const body = bodyMatch[1].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  const jsContent = `export const invitationBodyTemplate = ${JSON.stringify(body)};\n`;
  await writeFile(targetPath, jsContent, "utf8");
  console.log("✓ lib/invitation-template.js sincronizado exitosamente con public/index.html");
}

syncTemplate().catch((err) => {
  console.error("Error sincronizando template:", err);
  process.exit(1);
});
