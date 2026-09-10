import React, { useEffect } from "react";
import Head from "next/head";
import { findInvitation, validToken } from "../lib/invitation";
import { invitationBodyTemplate } from "../lib/invitation-template";

export async function getServerSideProps(context) {
  const queryToken = context.query?.token;
  const token = Array.isArray(queryToken) ? queryToken[0] : queryToken;

  // 1. Si no hay token en la URL
  if (!token || !token.trim()) {
    return {
      props: {
        isValid: false,
        errorTitle: "Invitación Privada",
        errorMessage: "Esta invitación es personal y requiere un enlace válido con token para visualizarse."
      }
    };
  }

  // 2. Si el formato del token no es válido
  if (!validToken(token)) {
    return {
      props: {
        isValid: false,
        errorTitle: "Enlace no válido",
        errorMessage: "El enlace de invitación proporcionado no tiene un formato válido o está incompleto."
      }
    };
  }

  let invitation = null;
  // 3. Validar existencia y vigencia del token en la base de datos Supabase
  try {
    invitation = await findInvitation(token);
    if (!invitation) {
      return {
        props: {
          isValid: false,
          errorTitle: "Invitación no disponible",
          errorMessage: "Este enlace ya no es válido, ha vencido o fue reemplazado por uno nuevo."
        }
      };
    }
  } catch (error) {
    console.warn("No se pudo verificar el token en Supabase durante SSR:", error.message);
  }

  // 4. Si el token es válido, inyectar el cuerpo del template
  try {
    let body = invitationBodyTemplate || "";

    if (!body) {
      const { readFile } = await import("fs/promises");
      const { join } = await import("path");
      for (const templatePath of [
        join(process.cwd(), "public", "index.html"),
        join(process.cwd(), "index.html")
      ]) {
        try {
          const template = await readFile(templatePath, "utf8");
          body = template.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || "";
          body = body.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
          if (body) break;
        } catch {}
      }
    }

    if (!body) throw new Error("No se encontró el template de la invitación.");

    const familyDisplayName = invitation?.families?.display_name || "Familia";
    body = body.replace(/\{\{FAMILY_NAME\}\}/g, familyDisplayName);

    return {
      props: {
        isValid: true,
        familyName: familyDisplayName,
        body
      }
    };
  } catch (err) {
    console.error("Error cargando template de invitación:", err);
    return {
      props: {
        isValid: false,
        errorTitle: "Error temporal",
        errorMessage: "No fue posible cargar los detalles de la invitación. Por favor intenta de nuevo más tarde."
      }
    };
  }
}

export default function InvitationPage({ isValid, errorTitle, errorMessage, body }) {
  useEffect(() => {
    // Si no es válida la invitación, no cargar scripts de la plantilla ni ejecutar preloader
    if (!isValid) return;

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
  }, [isValid]);

  // Si la invitación no es válida o no incluye token en la URL
  if (!isValid) {
    return (
      <div className="invalid-invitation-container">
        <Head>
          <title>Invitación Privada · Naye &amp; Oscar</title>
          <meta name="robots" content="noindex, nofollow" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>

        <div className="invalid-card">
          <div className="card-icon-wrapper">
            <span className="card-icon">💌</span>
          </div>

          <span className="wedding-subtitle">Naye &amp; Oscar · 21 Noviembre 2026</span>
          <h1 className="card-title">{errorTitle || "Invitación no válida"}</h1>

          <p className="card-message">
            {errorMessage || "Este enlace no incluye una invitación válida o ha vencido."}
          </p>

          <div className="info-box">
            <p>
              Por favor revisa el enlace personalizado que recibiste por <strong>WhatsApp</strong> o comunícate directamente con los novios para obtener tu invitación.
            </p>
          </div>
        </div>

        <style jsx>{`
          .invalid-invitation-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #fdfbf7 0%, #f4ede4 100%);
            padding: 24px 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            color: #1e293b;
          }

          .invalid-card {
            background: #ffffff;
            border-radius: 24px;
            box-shadow: 0 20px 45px rgba(102, 63, 69, 0.08);
            border: 1px solid #ede4dc;
            width: 100%;
            max-width: 480px;
            padding: 44px 32px;
            text-align: center;
            animation: fadeIn 0.4s ease-out;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .card-icon-wrapper {
            width: 72px;
            height: 72px;
            background: #fdf2f4;
            border: 1px solid #f9d8de;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
          }

          .card-icon {
            font-size: 34px;
          }

          .wedding-subtitle {
            display: block;
            font-size: 13px;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: #92666d;
            font-weight: 600;
            margin-bottom: 8px;
          }

          .card-title {
            font-size: 24px;
            font-weight: 700;
            color: #4a2c31;
            margin: 0 0 14px;
            line-height: 1.3;
          }

          .card-message {
            font-size: 15px;
            color: #64748b;
            line-height: 1.6;
            margin: 0 0 24px;
          }

          .info-box {
            background: #fbf8f5;
            border: 1px dashed #decbc5;
            border-radius: 12px;
            padding: 16px 18px;
          }

          .info-box p {
            margin: 0;
            font-size: 13px;
            color: #6a4f54;
            line-height: 1.5;
          }

          @media (max-width: 480px) {
            .invalid-card {
              padding: 32px 20px;
              border-radius: 20px;
            }
            .card-title {
              font-size: 21px;
            }
          }
        `}</style>
      </div>
    );
  }

  // Si la invitación es válida
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
