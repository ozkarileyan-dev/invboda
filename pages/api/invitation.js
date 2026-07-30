import { findInvitation, invitationPayload, validToken } from "../../lib/invitation";
import { sha256, supabaseRequest } from "../../lib/supabase-server";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Método no permitido." });
  }

  const token = Array.isArray(request.query.token) ? request.query.token[0] : request.query.token;
  if (!validToken(token)) return response.status(404).json({ error: "Esta invitación no es válida." });

  try {
    const invitation = await findInvitation(token);
    if (!invitation) return response.status(404).json({ error: "Este enlace no es válido, ya venció o fue reemplazado." });

    const forwardedFor = request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.headers["x-real-ip"];
    const ipHash = forwardedFor ? sha256(forwardedFor) : null;
    const userAgent = request.headers["user-agent"]?.slice(0, 500) || null;
    const referrer = request.headers.referer?.slice(0, 1000) || null;
    await Promise.all([
      supabaseRequest(`invitation_tokens?id=eq.${invitation.id}`, {
        method: "PATCH",
        body: JSON.stringify({ last_visited_at: new Date().toISOString() })
      }),
      supabaseRequest("invitation_visit_logs", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ token_id: invitation.id, ip_hash: ipHash, user_agent: userAgent, referrer, request_path: "/" })
      })
    ]).catch((trackingError) => {
      // El registro de telemetría no debe impedir que la familia vea su invitación.
      console.error("No fue posible registrar la visita", trackingError);
    });

    return response.status(200).json(invitationPayload(invitation));
  } catch (error) {
    console.error("No fue posible obtener la invitación", error);
    return response.status(500).json({ error: "No fue posible cargar la invitación. Intenta de nuevo." });
  }
}
