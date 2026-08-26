import React, { useState, useEffect, useMemo } from "react";
import Head from "next/head";

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Datos
  const [families, setFamilies] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [toastMessage, setToastMessage] = useState(null);

  // Modales
  const [familyModal, setFamilyModal] = useState({ open: false, mode: "create", data: null });
  const [rsvpModal, setRsvpModal] = useState({ open: false, family: null, status: "accepted", count: 1, message: "" });
  const [tokenModal, setTokenModal] = useState({ open: false, family: null, tokenUrl: "", rawToken: "" });
  const [deleteModal, setDeleteModal] = useState({ open: false, family: null });
  const [submitting, setSubmitting] = useState(false);

  // Formulario familia
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formRefCode, setFormRefCode] = useState("");
  const [formGuestCount, setFormGuestCount] = useState(2);
  const [formNotes, setFormNotes] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formGenerateToken, setFormGenerateToken] = useState(true);
  const [formError, setFormError] = useState("");

  const showToast = (msg, duration = 3500) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), duration);
  };

  // Helper para headers
  const getAuthHeaders = () => {
    const stored = token || (typeof window !== "undefined" ? localStorage.getItem("invboda_admin_token") : "");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${stored}`
    };
  };

  // Verificar autenticación inicial
  useEffect(() => {
    const stored = localStorage.getItem("invboda_admin_token");
    if (stored) {
      setToken(stored);
      checkSession(stored);
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const checkSession = async (adminToken) => {
    try {
      const res = await fetch("/api/admin/auth", {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        setIsAuthenticated(true);
        loadFamilies(adminToken);
      } else {
        localStorage.removeItem("invboda_admin_token");
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error("Error validando sesión:", err);
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!loginPassword.trim()) {
      setLoginError("Por favor ingresa la contraseña.");
      return;
    }
    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginPassword })
      });
      const data = await res.json();

      if (res.ok && data.authenticated) {
        localStorage.setItem("invboda_admin_token", data.token);
        setToken(data.token);
        setIsAuthenticated(true);
        loadFamilies(data.token);
        showToast("Sesión iniciada con éxito");
      } else {
        setLoginError(data.error || "Contraseña incorrecta.");
      }
    } catch (err) {
      setLoginError("Error de conexión al servidor.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } catch (e) {}
    localStorage.removeItem("invboda_admin_token");
    setToken("");
    setIsAuthenticated(false);
    showToast("Sesión cerrada.");
  };

  const loadFamilies = async (activeToken = token) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/families", {
        headers: {
          Authorization: `Bearer ${activeToken || token || localStorage.getItem("invboda_admin_token")}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setFamilies(data.families || []);
        setStats(data.stats || null);
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      } else {
        showToast("Error al cargar familias.");
      }
    } catch (err) {
      console.error("Error al cargar familias:", err);
      showToast("Error al consultar el servidor.");
    } finally {
      setLoading(false);
    }
  };

  // Autogenerar código de referencia al escribir nombre
  const handleNameChange = (e) => {
    const val = e.target.value;
    setFormDisplayName(val);
    if (familyModal.mode === "create") {
      const slug = val
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setFormRefCode(slug ? `familia-${slug.replace(/^familia-/, "")}` : "");
    }
  };

  const openCreateModal = () => {
    setFormDisplayName("");
    setFormRefCode("");
    setFormGuestCount(2);
    setFormNotes("");
    setFormActive(true);
    setFormGenerateToken(true);
    setFormError("");
    setFamilyModal({ open: true, mode: "create", data: null });
  };

  const openEditModal = (fam) => {
    setFormDisplayName(fam.display_name || "");
    setFormRefCode(fam.reference_code || "");
    setFormGuestCount(fam.invited_guest_count || 2);
    setFormNotes(fam.internal_notes || "");
    setFormActive(fam.active !== false);
    setFormGenerateToken(false);
    setFormError("");
    setFamilyModal({ open: true, mode: "edit", data: fam });
  };

  const handleSaveFamily = async (e) => {
    e.preventDefault();
    if (!formDisplayName.trim()) {
      setFormError("El nombre de la familia es obligatorio.");
      return;
    }
    if (formGuestCount < 1 || formGuestCount > 20) {
      setFormError("El cupo de invitados debe estar entre 1 y 20.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      if (familyModal.mode === "create") {
        const res = await fetch("/api/admin/families", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            display_name: formDisplayName,
            reference_code: formRefCode,
            invited_guest_count: formGuestCount,
            internal_notes: formNotes,
            active: formActive,
            generate_token: formGenerateToken
          })
        });
        const data = await res.json();
        if (res.ok) {
          setFamilyModal({ open: false, mode: "create", data: null });
          loadFamilies();
          showToast(`¡Familia ${formDisplayName} creada con éxito!`);
          if (data.token?.raw_token) {
            const domain = window.location.origin;
            setTokenModal({
              open: true,
              family: data.family,
              rawToken: data.token.raw_token,
              tokenUrl: `${domain}/?token=${data.token.raw_token}`
            });
          }
        } else {
          setFormError(data.error || "Error al crear la familia.");
        }
      } else {
        const res = await fetch("/api/admin/families", {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            id: familyModal.data.family_id || familyModal.data.id,
            display_name: formDisplayName,
            reference_code: formRefCode,
            invited_guest_count: formGuestCount,
            internal_notes: formNotes,
            active: formActive
          })
        });
        const data = await res.json();
        if (res.ok) {
          setFamilyModal({ open: false, mode: "edit", data: null });
          loadFamilies();
          showToast("Familia actualizada correctamente.");
        } else {
          setFormError(data.error || "Error al actualizar la familia.");
        }
      }
    } catch (err) {
      setFormError("Error de comunicación con el servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateToken = async (fam) => {
    const famId = fam.family_id || fam.id;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/token", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ family_id: famId })
      });
      const data = await res.json();
      if (res.ok && data.token?.raw_token) {
        const domain = window.location.origin;
        setTokenModal({
          open: true,
          family: fam,
          rawToken: data.token.raw_token,
          tokenUrl: `${domain}/?token=${data.token.raw_token}`
        });
        loadFamilies();
        showToast("¡Enlace de invitación generado!");
      } else {
        showToast(data.error || "No se pudo generar el token.");
      }
    } catch (err) {
      showToast("Error de conexión al emitir token.");
    } finally {
      setSubmitting(false);
    }
  };

  const openRsvpModal = (fam) => {
    setRsvpModal({
      open: true,
      family: fam,
      status: fam.rsvp_status || "accepted",
      count: fam.confirmed_guest_count || fam.invited_guest_count || 1,
      message: fam.optional_message || ""
    });
  };

  const handleSaveRsvp = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/rsvp", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          token_id: rsvpModal.family.token_id,
          family_id: rsvpModal.family.family_id || rsvpModal.family.id,
          status: rsvpModal.status,
          confirmed_guest_count: rsvpModal.count,
          optional_message: rsvpModal.message
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRsvpModal({ open: false, family: null, status: "accepted", count: 1, message: "" });
        loadFamilies();
        showToast("Estado RSVP actualizado con éxito.");
      } else {
        showToast(data.error || "Error al actualizar RSVP.");
      }
    } catch (err) {
      showToast("Error al guardar confirmación.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFamily = async () => {
    if (!deleteModal.family) return;
    setSubmitting(true);
    try {
      const famId = deleteModal.family.family_id || deleteModal.family.id;
      const res = await fetch(`/api/admin/families?id=${encodeURIComponent(famId)}&permanent=true`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setDeleteModal({ open: false, family: null });
        loadFamilies();
        showToast("Familia eliminada.");
      } else {
        showToast("No se pudo eliminar la familia.");
      }
    } catch (err) {
      showToast("Error de conexión.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast("📋 ¡Enlace copiado al portapapeles!");
  };

  const generateWhatsAppUrl = (fam, url) => {
    const name = fam?.display_name || "Familia";
    const msg = `¡Hola ${name}! 💍 Nos emociona mucho invitarlos a celebrar nuestra boda (Naye & Oscar) el 21 de Noviembre de 2026. ✨\n\nPueden ver los detalles de su invitación personalizada y confirmar su asistencia en el siguiente enlace:\n${url}\n\n¡Esperamos contar con su presencia! ❤️`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  };

  const exportCSV = () => {
    if (!families.length) {
      showToast("No hay familias para exportar.");
      return;
    }
    const headers = [
      "Familia",
      "Codigo Referencia",
      "Pases Invitados",
      "Estado RSVP",
      "Pases Confirmados",
      "Mensaje Familia",
      "Ultima Visita",
      "Notas Internas",
      "Activo"
    ];
    const rows = families.map((f) => [
      `"${(f.display_name || "").replace(/"/g, '""')}"`,
      `"${(f.reference_code || "").replace(/"/g, '""')}"`,
      f.invited_guest_count || 0,
      `"${f.rsvp_status || "pending"}"`,
      f.confirmed_guest_count || 0,
      `"${(f.optional_message || "").replace(/"/g, '""')}"`,
      `"${f.last_visited_at ? new Date(f.last_visited_at).toLocaleString() : "No"}"`,
      `"${(f.internal_notes || "").replace(/"/g, '""')}"`,
      f.active !== false ? "Si" : "No"
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `invitados_boda_naye_oscar_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("📊 Archivo CSV descargado.");
  };

  // Filtrado de familias
  const filteredFamilies = useMemo(() => {
    return families.filter((f) => {
      // Filtro texto
      const search = searchTerm.toLowerCase().trim();
      const matchSearch =
        !search ||
        (f.display_name && f.display_name.toLowerCase().includes(search)) ||
        (f.reference_code && f.reference_code.toLowerCase().includes(search)) ||
        (f.internal_notes && f.internal_notes.toLowerCase().includes(search));

      if (!matchSearch) return false;

      // Filtro pestaña
      if (filterStatus === "accepted") return f.rsvp_status === "accepted";
      if (filterStatus === "declined") return f.rsvp_status === "declined";
      if (filterStatus === "pending") return !f.rsvp_status || f.rsvp_status === "pending";
      if (filterStatus === "visited") return Boolean(f.last_visited_at);
      if (filterStatus === "inactive") return f.active === false;

      return true;
    });
  }, [families, searchTerm, filterStatus]);

  if (checkingAuth) {
    return (
      <div className="admin-loading-screen">
        <div className="spinner"></div>
        <p>Cargando panel de administración...</p>
        <style jsx>{`
          .admin-loading-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: #f8fafc;
            color: #334155;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .spinner {
            width: 44px;
            height: 44px;
            border: 4px solid #e2e8f0;
            border-top: 4px solid #854d0e;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  // Vista de Login
  if (!isAuthenticated) {
    return (
      <div className="login-wrapper">
        <Head>
          <title>Administración · Boda Naye &amp; Oscar</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="login-card">
          <div className="login-header">
            <span className="login-ring">💍</span>
            <h2>Acceso Administrativo</h2>
            <p>Gestión de Familias e Invitaciones · Boda Naye &amp; Oscar</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="admin-pass">Contraseña de Administrador</label>
              <input
                id="admin-pass"
                type="password"
                placeholder="Ingresa la contraseña"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoFocus
              />
            </div>
            {loginError && <div className="error-banner">{loginError}</div>}
            <button type="submit" className="login-btn" disabled={loginLoading}>
              {loginLoading ? "Verificando..." : "Ingresar al Panel"}
            </button>
          </form>
        </div>
        <style jsx>{`
          .login-wrapper {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #fdfbf7 0%, #f3eee6 100%);
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .login-card {
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
            width: 100%;
            max-width: 420px;
            padding: 40px 32px;
            border: 1px solid #ede8df;
          }
          .login-header {
            text-align: center;
            margin-bottom: 28px;
          }
          .login-ring {
            font-size: 40px;
            display: inline-block;
            margin-bottom: 12px;
          }
          .login-header h2 {
            font-size: 24px;
            color: #1e293b;
            margin: 0 0 6px;
            font-weight: 700;
          }
          .login-header p {
            font-size: 14px;
            color: #64748b;
            margin: 0;
          }
          .form-group {
            margin-bottom: 20px;
          }
          .form-group label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 8px;
          }
          .form-group input {
            width: 100%;
            padding: 12px 16px;
            border: 1.5px solid #cbd5e1;
            border-radius: 10px;
            font-size: 15px;
            outline: none;
            transition: all 0.2s;
            box-sizing: border-box;
          }
          .form-group input:focus {
            border-color: #b45309;
            box-shadow: 0 0 0 3px rgba(180, 83, 9, 0.15);
          }
          .error-banner {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #b91c1c;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
            margin-bottom: 18px;
          }
          .login-btn {
            width: 100%;
            padding: 13px;
            background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.15s, opacity 0.15s;
          }
          .login-btn:hover:not(:disabled) {
            opacity: 0.95;
            transform: translateY(-1px);
          }
          .login-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    );
  }

  // Vista Principal de Administración
  return (
    <div className="admin-container">
      <Head>
        <title>Administración de Familias · Boda Naye &amp; Oscar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Toast popup */}
      {toastMessage && <div className="toast-banner">{toastMessage}</div>}

      {/* Barra superior */}
      <header className="admin-nav">
        <div className="nav-brand">
          <span className="brand-logo">💍</span>
          <div>
            <h1 className="brand-title">Panel de Invitaciones</h1>
            <span className="brand-subtitle">Naye &amp; Oscar · 21 Noviembre 2026</span>
          </div>
        </div>
        <div className="nav-actions">
          <button onClick={openCreateModal} className="btn-primary">
            <span>+</span> Nueva Familia
          </button>
          <button onClick={exportCSV} className="btn-secondary" title="Descargar lista en CSV/Excel">
            📥 Exportar CSV
          </button>
          <button onClick={() => loadFamilies()} className="btn-secondary" title="Recargar lista">
            🔄
          </button>
          <button onClick={handleLogout} className="btn-outline" title="Cerrar Sesión">
            Salir
          </button>
        </div>
      </header>

      <main className="admin-content">
        {/* Tarjetas de Métricas / Estadísticas */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon bg-amber">👨‍👩‍👧‍👦</div>
            <div>
              <div className="stat-num">{stats?.totalFamilies ?? families.length}</div>
              <div className="stat-label">Familias Registradas</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-indigo">🎟️</div>
            <div>
              <div className="stat-num">{stats?.totalInvitedGuests ?? 0}</div>
              <div className="stat-label">Pases Totales Contemplados</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-emerald">✅</div>
            <div>
              <div className="stat-num text-emerald">{stats?.confirmedGuests ?? 0}</div>
              <div className="stat-label">Asistentes Confirmados ({stats?.confirmedFamilies ?? 0} fam.)</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-rose">❌</div>
            <div>
              <div className="stat-num text-rose">{stats?.declinedFamilies ?? 0}</div>
              <div className="stat-label">Familias que no asistirán</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-slate">⏳</div>
            <div>
              <div className="stat-num text-slate">{stats?.pendingFamilies ?? 0}</div>
              <div className="stat-label">Familias Pendientes</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-blue">👁️</div>
            <div>
              <div className="stat-num text-blue">{stats?.visitedLinks ?? 0}</div>
              <div className="stat-label">Invitaciones Vistas</div>
            </div>
          </div>
        </section>

        {/* Barra de Búsqueda y Filtros */}
        <section className="filter-section">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar por familia, código o notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-search" onClick={() => setSearchTerm("")}>
                ✕
              </button>
            )}
          </div>
          <div className="filter-tabs">
            <button
              className={`tab-btn ${filterStatus === "all" ? "active" : ""}`}
              onClick={() => setFilterStatus("all")}
            >
              Todos ({families.length})
            </button>
            <button
              className={`tab-btn ${filterStatus === "accepted" ? "active" : ""}`}
              onClick={() => setFilterStatus("accepted")}
            >
              Confirmados ({families.filter((f) => f.rsvp_status === "accepted").length})
            </button>
            <button
              className={`tab-btn ${filterStatus === "declined" ? "active" : ""}`}
              onClick={() => setFilterStatus("declined")}
            >
              No Asisten ({families.filter((f) => f.rsvp_status === "declined").length})
            </button>
            <button
              className={`tab-btn ${filterStatus === "pending" ? "active" : ""}`}
              onClick={() => setFilterStatus("pending")}
            >
              Pendientes ({families.filter((f) => !f.rsvp_status || f.rsvp_status === "pending").length})
            </button>
            <button
              className={`tab-btn ${filterStatus === "visited" ? "active" : ""}`}
              onClick={() => setFilterStatus("visited")}
            >
              Vistos ({families.filter((f) => Boolean(f.last_visited_at)).length})
            </button>
            <button
              className={`tab-btn ${filterStatus === "inactive" ? "active" : ""}`}
              onClick={() => setFilterStatus("inactive")}
            >
              Inactivos ({families.filter((f) => f.active === false).length})
            </button>
          </div>
        </section>

        {/* Tabla / Lista de Familias */}
        <section className="table-wrapper">
          {loading ? (
            <div className="table-loading">
              <div className="spinner"></div>
              <span>Actualizando lista de familias...</span>
            </div>
          ) : filteredFamilies.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <h3>No se encontraron familias</h3>
              <p>
                {searchTerm
                  ? "No hay resultados que coincidan con la búsqueda."
                  : "Comienza agregando tu primera familia con el botón '+ Nueva Familia'."}
              </p>
              {searchTerm ? (
                <button className="btn-secondary" onClick={() => setSearchTerm("")}>
                  Limpiar búsqueda
                </button>
              ) : (
                <button className="btn-primary" onClick={openCreateModal}>
                  + Crear Primera Familia
                </button>
              )}
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Familia / Grupo</th>
                  <th>Pases</th>
                  <th>Estado RSVP</th>
                  <th>Visita Enlace</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredFamilies.map((fam) => {
                  const famId = fam.family_id || fam.id;
                  const isAccepted = fam.rsvp_status === "accepted";
                  const isDeclined = fam.rsvp_status === "declined";
                  const isPending = !fam.rsvp_status || fam.rsvp_status === "pending";

                  return (
                    <tr key={famId} className={fam.active === false ? "row-inactive" : ""}>
                      <td>
                        <div className="family-title-row">
                          <strong className="family-name">{fam.display_name}</strong>
                          {fam.active === false && <span className="badge badge-inactive">Inactivo</span>}
                        </div>
                        <div className="family-sub">
                          <code className="ref-code">{fam.reference_code}</code>
                          {fam.internal_notes && <span className="notes-preview">💬 {fam.internal_notes}</span>}
                        </div>
                      </td>
                      <td>
                        <span className="guest-count-pill">
                          👥 {fam.invited_guest_count}{" "}
                          {fam.invited_guest_count === 1 ? "persona" : "personas"}
                        </span>
                      </td>
                      <td>
                        {isAccepted && (
                          <div className="rsvp-badge-container">
                            <span className="badge badge-accepted">
                              ✅ Confirmó ({fam.confirmed_guest_count || fam.invited_guest_count} pases)
                            </span>
                            {fam.responded_at && (
                              <span className="badge-date">
                                {new Date(fam.responded_at).toLocaleDateString("es-MX", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                            )}
                            {fam.optional_message && (
                              <div className="guest-msg">&ldquo;{fam.optional_message}&rdquo;</div>
                            )}
                          </div>
                        )}
                        {isDeclined && (
                          <div className="rsvp-badge-container">
                            <span className="badge badge-declined">❌ No asistirá</span>
                            {fam.responded_at && (
                              <span className="badge-date">
                                {new Date(fam.responded_at).toLocaleDateString("es-MX", {
                                  day: "numeric",
                                  month: "short"
                                })}
                              </span>
                            )}
                            {fam.optional_message && (
                              <div className="guest-msg">&ldquo;{fam.optional_message}&rdquo;</div>
                            )}
                          </div>
                        )}
                        {isPending && (
                          <span className="badge badge-pending">⏳ Pendiente</span>
                        )}
                      </td>
                      <td>
                        {fam.last_visited_at ? (
                          <div className="visit-info">
                            <span className="badge badge-visited">👁️ Visto</span>
                            <span className="badge-date">
                              {new Date(fam.last_visited_at).toLocaleDateString("es-MX", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-small">No abierto aún</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="action-btn btn-token"
                            onClick={() => handleGenerateToken(fam)}
                            title="Generar o ver enlace de invitación"
                          >
                            🔗 Enlace
                          </button>
                          <button
                            className="action-btn btn-rsvp"
                            onClick={() => openRsvpModal(fam)}
                            title="Modificar estado de confirmación manualmente"
                          >
                            ✍️ RSVP
                          </button>
                          <button
                            className="action-btn btn-edit"
                            onClick={() => openEditModal(fam)}
                            title="Editar familia"
                          >
                            ✏️
                          </button>
                          <button
                            className="action-btn btn-delete"
                            onClick={() => setDeleteModal({ open: true, family: fam })}
                            title="Eliminar familia"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>

      {/* Modal: Crear / Editar Familia */}
      {familyModal.open && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>{familyModal.mode === "create" ? "Nueva Familia Invitada" : "Editar Familia"}</h3>
              <button
                className="close-modal-btn"
                onClick={() => setFamilyModal({ open: false, mode: "create", data: null })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveFamily}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nombre de la Familia o Invitado *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Familia Rodríguez Morales / Sr. Carlos López"
                    value={formDisplayName}
                    onChange={handleNameChange}
                    autoFocus
                  />
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Código de Referencia (slug URL)</label>
                    <input
                      type="text"
                      placeholder="familia-rodriguez-morales"
                      value={formRefCode}
                      onChange={(e) => setFormRefCode(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ width: "130px" }}>
                    <label>Pases / Cupo *</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      required
                      value={formGuestCount}
                      onChange={(e) => setFormGuestCount(parseInt(e.target.value, 10) || 1)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notas Internas (mesa, parentesco, etc.)</label>
                  <textarea
                    rows="2"
                    placeholder="Ej. Mesa 3, tíos de la novia, tienen 2 niños..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                    />
                    <span>Familia activa</span>
                  </label>

                  {familyModal.mode === "create" && (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formGenerateToken}
                        onChange={(e) => setFormGenerateToken(e.target.checked)}
                      />
                      <span>Generar enlace de invitación de inmediato</span>
                    </label>
                  )}
                </div>

                {formError && <div className="error-banner">{formError}</div>}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setFamilyModal({ open: false, mode: "create", data: null })}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Guardando..." : familyModal.mode === "create" ? "Crear Familia" : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Enlace de Invitación Generado */}
      {tokenModal.open && (
        <div className="modal-backdrop">
          <div className="modal-box modal-lg">
            <div className="modal-header">
              <h3>🔗 Enlace de Invitación</h3>
              <button
                className="close-modal-btn"
                onClick={() => setTokenModal({ open: false, family: null, tokenUrl: "", rawToken: "" })}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="token-hero">
                <div className="token-family-name">{tokenModal.family?.display_name}</div>
                <div className="token-passes">
                  Pases autorizados: <strong>{tokenModal.family?.invited_guest_count} personas</strong>
                </div>
              </div>

              <div className="form-group">
                <label>Enlace personalizado para compartir:</label>
                <div className="copy-input-row">
                  <input type="text" readOnly value={tokenModal.tokenUrl} className="token-url-input" />
                  <button
                    type="button"
                    className="btn-primary copy-btn"
                    onClick={() => copyToClipboard(tokenModal.tokenUrl)}
                  >
                    📋 Copiar
                  </button>
                </div>
              </div>

              <div className="whatsapp-preview-box">
                <div className="whatsapp-title">💬 Vista previa del mensaje para WhatsApp:</div>
                <div className="whatsapp-text">
                  ¡Hola {tokenModal.family?.display_name}! 💍 Nos emociona mucho invitarlos a celebrar nuestra boda (Naye &amp; Oscar) el 21 de Noviembre de 2026. ✨
                  <br />
                  <br />
                  Pueden ver los detalles de su invitación personalizada y confirmar su asistencia en el siguiente enlace:
                  <br />
                  <strong>{tokenModal.tokenUrl}</strong>
                  <br />
                  <br />
                  ¡Esperamos contar con su presencia! ❤️
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <a
                href={generateWhatsAppUrl(tokenModal.family, tokenModal.tokenUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp"
              >
                📲 Abrir en WhatsApp
              </a>
              <a
                href={tokenModal.tokenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                👁️ Probar Enlace
              </a>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setTokenModal({ open: false, family: null, tokenUrl: "", rawToken: "" })}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Modificar RSVP Manual */}
      {rsvpModal.open && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>✍️ Modificar Respuesta RSVP</h3>
              <button
                className="close-modal-btn"
                onClick={() => setRsvpModal({ open: false, family: null, status: "accepted", count: 1, message: "" })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveRsvp}>
              <div className="modal-body">
                <p style={{ margin: "0 0 16px", color: "#475569" }}>
                  Actualizar confirmación para: <strong>{rsvpModal.family?.display_name}</strong> (Pases originales: {rsvpModal.family?.invited_guest_count})
                </p>

                <div className="form-group">
                  <label>Estado de Asistencia</label>
                  <select
                    value={rsvpModal.status}
                    onChange={(e) => setRsvpModal({ ...rsvpModal, status: e.target.value })}
                  >
                    <option value="accepted">✅ Asistirá (Confirmado)</option>
                    <option value="declined">❌ No asistirá (Rechazado)</option>
                    <option value="pending">⏳ Pendiente de respuesta</option>
                  </select>
                </div>

                {rsvpModal.status === "accepted" && (
                  <div className="form-group">
                    <label>Personas / Pases Confirmados</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={rsvpModal.count}
                      onChange={(e) => setRsvpModal({ ...rsvpModal, count: parseInt(e.target.value, 10) || 1 })}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Mensaje o Nota de la Familia</label>
                  <textarea
                    rows="2"
                    placeholder="Mensaje de felicitación o notas de confirmación..."
                    value={rsvpModal.message}
                    onChange={(e) => setRsvpModal({ ...rsvpModal, message: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRsvpModal({ open: false, family: null, status: "accepted", count: 1, message: "" })}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Guardando..." : "Actualizar RSVP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación */}
      {deleteModal.open && (
        <div className="modal-backdrop">
          <div className="modal-box modal-sm">
            <div className="modal-header">
              <h3 style={{ color: "#dc2626" }}>🗑️ Eliminar Familia</h3>
              <button
                className="close-modal-btn"
                onClick={() => setDeleteModal({ open: false, family: null })}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: "0 0 12px", color: "#334155", lineHeight: 1.5 }}>
                ¿Estás seguro de que deseas eliminar permanentemente a <strong>{deleteModal.family?.display_name}</strong>?
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                Se eliminarán también todos los enlaces y respuestas de confirmación asociadas a esta familia.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteModal({ open: false, family: null })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteFamily}
                disabled={submitting}
              >
                {submitting ? "Eliminando..." : "Sí, Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-container {
          min-height: 100vh;
          background: #f8fafc;
          color: #1e293b;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }

        .toast-banner {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          background: #1e293b;
          color: #ffffff;
          padding: 12px 20px;
          border-radius: 10px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          font-size: 14px;
          font-weight: 500;
          animation: slideIn 0.2s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        /* Navbar */
        .admin-nav {
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          padding: 14px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          font-size: 30px;
        }

        .brand-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
          color: #0f172a;
        }

        .brand-subtitle {
          font-size: 12px;
          color: #64748b;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Botones generales */
        .btn-primary {
          background: #b45309;
          color: #ffffff;
          border: none;
          padding: 9px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
        }

        .btn-primary:hover:not(:disabled) {
          background: #92400e;
        }

        .btn-secondary {
          background: #f1f5f9;
          color: #334155;
          border: 1px solid #cbd5e1;
          padding: 9px 14px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }

        .btn-secondary:hover {
          background: #e2e8f0;
        }

        .btn-outline {
          background: transparent;
          color: #64748b;
          border: 1px solid #cbd5e1;
          padding: 9px 14px;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        }

        .btn-outline:hover {
          background: #f8fafc;
          color: #0f172a;
        }

        .btn-danger {
          background: #dc2626;
          color: #ffffff;
          border: none;
          padding: 9px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-danger:hover {
          background: #b91c1c;
        }

        .btn-whatsapp {
          background: #25d366;
          color: #ffffff;
          border: none;
          padding: 9px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .btn-whatsapp:hover {
          background: #1eb954;
        }

        /* Layout principal */
        .admin-content {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 20px 60px;
        }

        /* Métricas */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }

        .bg-amber {
          background: #fef3c7;
        }
        .bg-indigo {
          background: #e0e7ff;
        }
        .bg-emerald {
          background: #d1fae5;
        }
        .bg-rose {
          background: #ffe4e6;
        }
        .bg-slate {
          background: #f1f5f9;
        }
        .bg-blue {
          background: #dbeafe;
        }

        .stat-num {
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
        }

        .text-emerald {
          color: #059669;
        }
        .text-rose {
          color: #e11d48;
        }
        .text-slate {
          color: #64748b;
        }
        .text-blue {
          color: #2563eb;
        }

        .stat-label {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }

        /* Filtros y búsqueda */
        .filter-section {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .search-box {
          position: relative;
          width: 100%;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 14px;
        }

        .search-box input {
          width: 100%;
          padding: 10px 38px 10px 38px;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
        }

        .search-box input:focus {
          border-color: #b45309;
        }

        .clear-search {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 14px;
        }

        .filter-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .tab-btn {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 7px 14px;
          border-radius: 20px;
          font-size: 13px;
          color: #475569;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }

        .tab-btn.active {
          background: #b45309;
          color: #ffffff;
          border-color: #b45309;
        }

        /* Tabla */
        .table-wrapper {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .admin-table th {
          background: #f8fafc;
          padding: 14px 18px;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #e2e8f0;
        }

        .admin-table td {
          padding: 16px 18px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 14px;
          vertical-align: middle;
        }

        .admin-table tbody tr:hover {
          background: #fafaf9;
        }

        .row-inactive {
          opacity: 0.55;
        }

        .family-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .family-name {
          font-size: 15px;
          color: #0f172a;
          font-weight: 600;
        }

        .family-sub {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }

        .ref-code {
          background: #f1f5f9;
          color: #64748b;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .notes-preview {
          font-size: 12px;
          color: #64748b;
          font-style: italic;
        }

        .guest-count-pill {
          background: #fef3c7;
          color: #92400e;
          font-weight: 600;
          font-size: 13px;
          padding: 4px 10px;
          border-radius: 12px;
          display: inline-block;
        }

        /* Badges */
        .badge {
          display: inline-block;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 12px;
        }

        .badge-accepted {
          background: #dcfce7;
          color: #15803d;
        }

        .badge-declined {
          background: #fee2e2;
          color: #b91c1c;
        }

        .badge-pending {
          background: #fef3c7;
          color: #b45309;
        }

        .badge-visited {
          background: #e0f2fe;
          color: #0369a1;
        }

        .badge-inactive {
          background: #f1f5f9;
          color: #64748b;
        }

        .badge-date {
          display: block;
          font-size: 11px;
          color: #94a3b8;
          margin-top: 3px;
        }

        .guest-msg {
          font-size: 12px;
          color: #475569;
          background: #f8fafc;
          border-left: 2px solid #cbd5e1;
          padding: 4px 8px;
          margin-top: 6px;
          border-radius: 0 4px 4px 0;
        }

        .text-muted-small {
          font-size: 12px;
          color: #94a3b8;
        }

        .row-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
        }

        .action-btn {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        .btn-token {
          color: #b45309;
          border-color: #fde68a;
          background: #fffbeb;
          font-weight: 500;
        }

        .btn-token:hover {
          background: #fef3c7;
        }

        .btn-rsvp {
          color: #4338ca;
          border-color: #c7d2fe;
          background: #eef2ff;
        }

        .btn-rsvp:hover {
          background: #e0e7ff;
        }

        .btn-delete:hover {
          background: #fee2e2;
          border-color: #fca5a5;
          color: #b91c1c;
        }

        /* Estados vacíos y carga */
        .empty-state {
          padding: 60px 20px;
          text-align: center;
        }

        .empty-icon {
          font-size: 44px;
          display: inline-block;
          margin-bottom: 12px;
        }

        .empty-state h3 {
          font-size: 18px;
          color: #1e293b;
          margin: 0 0 6px;
        }

        .empty-state p {
          font-size: 14px;
          color: #64748b;
          margin: 0 0 18px;
        }

        .table-loading {
          padding: 50px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #64748b;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e2e8f0;
          border-top: 3px solid #b45309;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* Modales */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal-box {
          background: #ffffff;
          border-radius: 16px;
          width: 100%;
          max-width: 520px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: modalPop 0.2s ease-out;
        }

        .modal-lg {
          max-width: 620px;
        }

        .modal-sm {
          max-width: 420px;
        }

        @keyframes modalPop {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .modal-header {
          padding: 18px 24px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }

        .close-modal-btn {
          background: transparent;
          border: none;
          font-size: 18px;
          color: #94a3b8;
          cursor: pointer;
        }

        .close-modal-btn:hover {
          color: #0f172a;
        }

        .modal-body {
          padding: 24px;
        }

        .modal-footer {
          padding: 16px 24px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 6px;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 10px 14px;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: #b45309;
        }

        .form-row {
          display: flex;
          gap: 12px;
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #334155;
          cursor: pointer;
        }

        .checkbox-label input {
          width: 16px;
          height: 16px;
          accent-color: #b45309;
        }

        .token-hero {
          background: #fffbeb;
          border: 1px solid #fef3c7;
          border-radius: 10px;
          padding: 16px;
          text-align: center;
          margin-bottom: 18px;
        }

        .token-family-name {
          font-size: 18px;
          font-weight: 700;
          color: #92400e;
        }

        .token-passes {
          font-size: 13px;
          color: #b45309;
          margin-top: 4px;
        }

        .copy-input-row {
          display: flex;
          gap: 8px;
        }

        .token-url-input {
          font-family: monospace;
          font-size: 13px !important;
          background: #f8fafc;
        }

        .copy-btn {
          white-space: nowrap;
        }

        .whatsapp-preview-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 14px;
          margin-top: 14px;
        }

        .whatsapp-title {
          font-size: 12px;
          font-weight: 700;
          color: #166534;
          margin-bottom: 6px;
        }

        .whatsapp-text {
          font-size: 13px;
          color: #14532d;
          line-height: 1.4;
        }

        .error-banner {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-top: 12px;
        }

        @media (max-width: 768px) {
          .admin-nav {
            flex-direction: column;
            gap: 12px;
            padding: 14px 16px;
            align-items: flex-start;
          }
          .nav-actions {
            width: 100%;
            justify-content: space-between;
          }
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .table-wrapper {
            overflow-x: auto;
          }
          .admin-table th,
          .admin-table td {
            padding: 10px 12px;
          }
        }
      `}</style>
    </div>
  );
}
