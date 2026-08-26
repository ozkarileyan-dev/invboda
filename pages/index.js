import React, { useEffect } from "react";
import Head from "next/head";

export async function getStaticProps() {
  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  const template = await readFile(join(process.cwd(), "public", "index.html"), "utf8");
  let body = template.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || "";
  // Remover tags de scripts embebidos en el template para cargarlos ordenadamente en el ciclo de vida de React
  body = body.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  return { props: { body } };
}

export default function InvitationPage({ body }) {
  useEffect(() => {
    // 1. Fallback de seguridad: desvanecer preloader después de un tiempo prudente
    const preloaderSafetyTimer = setTimeout(() => {
      const preloader = document.querySelector(".preloader");
      if (preloader) {
        preloader.style.transition = "opacity 0.4s ease";
        preloader.style.opacity = "0";
        setTimeout(() => {
          if (preloader && preloader.parentNode) {
            preloader.parentNode.removeChild(preloader);
          }
        }, 400);
      }
    }, 500);

    // 2. Cargar dependencias de scripts secuencialmente en orden estricto
    const scriptSources = [
      "/assets/js/jquery.min.js",
      "/assets/js/bootstrap.bundle.min.js",
      "/assets/js/modernizr.custom.js",
      "/assets/js/jquery-plugin-collection.js",
      "/assets/js/script.js",
      "/assets/js/rsvp.js"
    ];

    let isMounted = true;

    const loadScripts = async () => {
      for (const src of scriptSources) {
        if (!isMounted) return;
        await new Promise((resolve) => {
          const existing = document.querySelector(`script[src="${src}"]`);
          if (existing) {
            resolve();
            return;
          }
          const s = document.createElement("script");
          s.src = src;
          s.async = false;
          s.onload = () => resolve();
          s.onerror = () => resolve();
          document.body.appendChild(s);
        });
      }

      // 3. Ocultar preloader cuando los scripts hayan terminado de cargarse
      const preloader = document.querySelector(".preloader");
      if (preloader) {
        preloader.style.transition = "opacity 0.3s ease";
        preloader.style.opacity = "0";
        setTimeout(() => {
          if (preloader && preloader.parentNode) {
            preloader.parentNode.removeChild(preloader);
          }
        }, 300);
      }
    };

    loadScripts();

    return () => {
      isMounted = false;
      clearTimeout(preloaderSafetyTimer);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Naye &amp; Oscar · 21 Noviembre 2026</title>
        <meta name="description" content="Invitación de boda de Naye y Oscar" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main suppressHydrationWarning dangerouslySetInnerHTML={{ __html: body }} />
    </>
  );
}
