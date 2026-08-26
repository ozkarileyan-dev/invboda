import { requireAdminAuth } from "../../../lib/admin-auth";
import { supabaseRequest } from "../../../lib/supabase-server";

export default async function handler(request, response) {
  if (!requireAdminAuth(request, response)) return;

  if (request.method !== "POST" && request.method !== "PATCH") {
    response.setHeader("Allow", "POST, PATCH");
    return response.status(405).json({ error: "Método no permitido." });
  }

  const { token_id, family_id, status, confirmed_guest_count, optional_message } = request.body || {};

  if (!["pending", "accepted", "declined"].includes(status)) {
    return response.status(400).json({ error: "El estado de RSVP debe ser: pending, accepted o declined." });
  }

  try {
    let resolvedTokenId = token_id;

    // Si no se proporcionó token_id pero sí family_id, buscar o emitir token
    if (!resolvedTokenId && family_id) {
      const tokens = await supabaseRequest(
        `invitation_tokens?family_id=eq.${encodeURIComponent(family_id)}&revoked_at=is.null&order=issued_at.desc&limit=1`
      );
      if (tokens && tokens.length > 0) {
        resolvedTokenId = tokens[0].id;
      } else {
        // Emitir un token nuevo si no existe ninguno
        const rpcRes = await supabaseRequest("rpc/issue_invitation_token", {
          method: "POST",
          body: JSON.stringify({ p_family_id: family_id })
        });
        const newToken = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;
        resolvedTokenId = newToken?.token_id;
      }
    }

    if (!resolvedTokenId) {
      return response.status(400).json({ error: "Se requiere token_id o family_id para actualizar el RSVP." });
    }

    const payload = {
      token_id: resolvedTokenId,
      status,
      optional_message: optional_message?.trim() || null
    };

    if (status === "accepted" && confirmed_guest_count !== undefined && confirmed_guest_count !== null) {
      payload.confirmed_guest_count = Math.max(0, parseInt(confirmed_guest_count, 10) || 0);
    }

    const rows = await supabaseRequest("rsvp_responses?on_conflict=token_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(payload)
    });

    return response.status(200).json({
      message: "Estado de confirmación actualizado exitosamente.",
      rsvp: rows?.[0]
    });
  } catch (error) {
    console.error("Error actualizando RSVP administrativo:", error);
    return response.status(500).json({ error: error.message || "Error al actualizar la respuesta de RSVP." });
  }
}
