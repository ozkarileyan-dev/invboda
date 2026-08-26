import { requireAdminAuth } from "../../../lib/admin-auth";
import { supabaseRequest } from "../../../lib/supabase-server";

export default async function handler(request, response) {
  if (!requireAdminAuth(request, response)) return;

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método no permitido." });
  }

  const { family_id, expires_at } = request.body || {};

  if (!family_id) {
    return response.status(400).json({ error: "El ID de la familia es obligatorio." });
  }

  try {
    const payload = { p_family_id: family_id };
    if (expires_at) {
      payload.p_expires_at = expires_at;
    }

    const rpcRes = await supabaseRequest("rpc/issue_invitation_token", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const tokenData = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;

    if (!tokenData || !tokenData.raw_token) {
      throw new Error("No se recibió el token generado desde Supabase.");
    }

    return response.status(200).json({
      message: "Enlace de invitación generado exitosamente.",
      token: tokenData
    });
  } catch (error) {
    console.error("Error emitiendo token en /api/admin/token:", error);
    return response.status(500).json({ error: error.message || "No fue posible generar el token de invitación." });
  }
}
