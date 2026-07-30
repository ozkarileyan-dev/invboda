import { findInvitation, validToken } from "../../lib/invitation";
import { supabaseRequest } from "../../lib/supabase-server";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método no permitido." });
  }

  const { token, attendance, message } = request.body || {};
  if (!validToken(token) || typeof attendance !== "boolean") {
    return response.status(400).json({ error: "La respuesta de asistencia no es válida." });
  }
  if (message !== undefined && (typeof message !== "string" || message.trim().length > 500)) {
    return response.status(400).json({ error: "El mensaje debe tener máximo 500 caracteres." });
  }

  try {
    const invitation = await findInvitation(token);
    if (!invitation) return response.status(404).json({ error: "Este enlace no es válido, ya venció o fue reemplazado." });

    const rows = await supabaseRequest("rsvp_responses?on_conflict=token_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        token_id: invitation.id,
        status: attendance ? "accepted" : "declined",
        optional_message: message?.trim() || null
      })
    });

    return response.status(200).json({
      message: attendance ? "¡Gracias! Su asistencia ha quedado confirmada." : "Gracias por avisarnos. Hemos registrado que no podrán asistir.",
      rsvp: { status: rows[0].status, confirmedGuestCount: rows[0].confirmed_guest_count, message: rows[0].optional_message || "" }
    });
  } catch (error) {
    console.error("No fue posible guardar el RSVP", error);
    return response.status(500).json({ error: "No fue posible guardar la respuesta. Intenta de nuevo." });
  }
}
