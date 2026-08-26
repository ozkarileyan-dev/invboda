import { computeAdminToken, verifyAdminPassword, verifyAdminToken, extractAdminTokenFromRequest } from "../../../lib/admin-auth";

export default async function handler(request, response) {
  if (request.method === "GET") {
    const token = extractAdminTokenFromRequest(request);
    if (token && verifyAdminToken(token)) {
      return response.status(200).json({ authenticated: true });
    }
    return response.status(401).json({ authenticated: false, error: "Sesión inválida o expirada." });
  }

  if (request.method === "POST") {
    const { password, token } = request.body || {};

    if (token && verifyAdminToken(token)) {
      return response.status(200).json({
        authenticated: true,
        token: computeAdminToken(),
        message: "Sesión válida."
      });
    }

    if (password && verifyAdminPassword(password)) {
      const sessionToken = computeAdminToken();
      // Establecer cookie de sesión opcional para mayor comodidad
      response.setHeader(
        "Set-Cookie",
        `admin_session=${sessionToken}; Path=/; SameSite=Lax; Max-Age=2592000; HttpOnly`
      );
      return response.status(200).json({
        authenticated: true,
        token: sessionToken,
        message: "Autenticación exitosa."
      });
    }

    return response.status(401).json({
      authenticated: false,
      error: "Contraseña incorrecta. Verifica tus credenciales."
    });
  }

  if (request.method === "DELETE") {
    response.setHeader(
      "Set-Cookie",
      "admin_session=; Path=/; SameSite=Lax; Max-Age=0; HttpOnly"
    );
    return response.status(200).json({ ok: true, message: "Sesión cerrada correctamente." });
  }

  response.setHeader("Allow", "GET, POST, DELETE");
  return response.status(405).json({ error: "Método no permitido." });
}
