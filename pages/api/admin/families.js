import { requireAdminAuth } from "../../../lib/admin-auth";
import { supabaseRequest } from "../../../lib/supabase-server";

function slugify(text) {
  return (text || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function handler(request, response) {
  if (!requireAdminAuth(request, response)) return;

  try {
    // ------------------------------------------------------------------------
    // GET: Listar todas las familias y métricas
    // ------------------------------------------------------------------------
    if (request.method === "GET") {
      let families = [];
      try {
        families = await supabaseRequest(
          "family_invitation_summary?select=*&order=display_name.asc"
        );
      } catch (err) {
        // Fallback si la vista no ha sido actualizada todavía en Supabase
        console.warn("Consulta a family_invitation_summary falló, intentando fallback:", err.message);
        families = await supabaseRequest(
          "families?select=id,reference_code,display_name,invited_guest_count,active,internal_notes,created_at,updated_at&order=display_name.asc"
        );
      }

      // Calcular estadísticas de resumen
      const stats = {
        totalFamilies: families.length,
        activeFamilies: families.filter((f) => f.active !== false).length,
        totalInvitedGuests: families.reduce((acc, f) => acc + (Number(f.invited_guest_count) || 0), 0),
        confirmedFamilies: families.filter((f) => f.rsvp_status === "accepted").length,
        confirmedGuests: families
          .filter((f) => f.rsvp_status === "accepted")
          .reduce((acc, f) => acc + (Number(f.confirmed_guest_count) || Number(f.invited_guest_count) || 0), 0),
        declinedFamilies: families.filter((f) => f.rsvp_status === "declined").length,
        pendingFamilies: families.filter((f) => !f.rsvp_status || f.rsvp_status === "pending").length,
        visitedLinks: families.filter((f) => Boolean(f.last_visited_at)).length
      };

      return response.status(200).json({ families, stats });
    }

    // ------------------------------------------------------------------------
    // POST: Crear una nueva familia (+ emisión opcional de token)
    // ------------------------------------------------------------------------
    if (request.method === "POST") {
      const {
        display_name,
        reference_code,
        invited_guest_count,
        internal_notes,
        active = true,
        generate_token = true
      } = request.body || {};

      if (!display_name || !display_name.trim()) {
        return response.status(400).json({ error: "El nombre de la familia es obligatorio." });
      }

      const count = parseInt(invited_guest_count, 10);
      if (isNaN(count) || count < 1 || count > 20) {
        return response.status(400).json({ error: "El cupo de invitados debe ser entre 1 y 20 personas." });
      }

      let code = (reference_code && reference_code.trim())
        ? slugify(reference_code)
        : slugify(display_name);

      if (!code) {
        code = `familia-${Date.now().toString(36)}`;
      }

      // Verificar si el reference_code ya existe, si es así agregar sufijo
      try {
        const existing = await supabaseRequest(`families?reference_code=eq.${encodeURIComponent(code)}&select=id`);
        if (existing && existing.length > 0) {
          code = `${code}-${Math.floor(100 + Math.random() * 900)}`;
        }
      } catch (e) {
        // Continuar
      }

      const newFamilyRows = await supabaseRequest("families", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          display_name: display_name.trim(),
          reference_code: code,
          invited_guest_count: count,
          internal_notes: internal_notes?.trim() || null,
          active: Boolean(active)
        })
      });

      const newFamily = newFamilyRows?.[0];
      if (!newFamily) {
        throw new Error("No se pudo crear el registro de la familia.");
      }

      let tokenData = null;
      if (generate_token) {
        try {
          const rpcRes = await supabaseRequest("rpc/issue_invitation_token", {
            method: "POST",
            body: JSON.stringify({ p_family_id: newFamily.id })
          });
          tokenData = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;
        } catch (tokenErr) {
          console.error("Error emitiendo token inicial para familia:", tokenErr);
        }
      }

      return response.status(201).json({
        message: "Familia registrada correctamente.",
        family: newFamily,
        token: tokenData
      });
    }

    // ------------------------------------------------------------------------
    // PATCH / PUT: Actualizar datos de una familia
    // ------------------------------------------------------------------------
    if (request.method === "PATCH" || request.method === "PUT") {
      const { id, display_name, reference_code, invited_guest_count, internal_notes, active } =
        request.body || {};

      if (!id) {
        return response.status(400).json({ error: "El ID de la familia es obligatorio." });
      }

      const updates = {};
      if (display_name !== undefined) {
        if (!display_name.trim()) return response.status(400).json({ error: "El nombre no puede estar vacío." });
        updates.display_name = display_name.trim();
      }

      if (reference_code !== undefined) {
        const code = slugify(reference_code);
        if (!code) return response.status(400).json({ error: "El código de referencia no es válido." });
        updates.reference_code = code;
      }

      if (invited_guest_count !== undefined) {
        const count = parseInt(invited_guest_count, 10);
        if (isNaN(count) || count < 1 || count > 20) {
          return response.status(400).json({ error: "El cupo de invitados debe estar entre 1 y 20." });
        }
        updates.invited_guest_count = count;
      }

      if (internal_notes !== undefined) {
        updates.internal_notes = internal_notes ? internal_notes.trim() : null;
      }

      if (active !== undefined) {
        updates.active = Boolean(active);
      }

      const updatedRows = await supabaseRequest(`families?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(updates)
      });

      return response.status(200).json({
        message: "Familia actualizada correctamente.",
        family: updatedRows?.[0]
      });
    }

    // ------------------------------------------------------------------------
    // DELETE: Eliminar o desactivar una familia
    // ------------------------------------------------------------------------
    if (request.method === "DELETE") {
      const id = request.query.id || request.body?.id;
      const permanent = request.query.permanent === "true" || request.body?.permanent === true;

      if (!id) {
        return response.status(400).json({ error: "El ID de la familia es requerido." });
      }

      if (permanent) {
        // Elimina en cascada los tokens y respuestas asociadas
        await supabaseRequest(`families?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE"
        });
        return response.status(200).json({ message: "Familia y enlaces asociados eliminados permanentemente." });
      } else {
        // Soft delete (desactivar)
        const updated = await supabaseRequest(`families?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ active: false })
        });
        return response.status(200).json({ message: "Familia desactivada.", family: updated?.[0] });
      }
    }

    response.setHeader("Allow", "GET, POST, PATCH, PUT, DELETE");
    return response.status(405).json({ error: "Método no permitido." });
  } catch (error) {
    console.error("Error en /api/admin/families:", error);
    return response.status(500).json({ error: error.message || "Error interno del servidor." });
  }
}
