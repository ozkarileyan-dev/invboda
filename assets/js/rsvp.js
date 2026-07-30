(function () {
    "use strict";

    const form = document.getElementById("rsvp-form");
    const loading = document.getElementById("invitation-loading");
    const error = document.getElementById("invitation-error");
    const status = document.getElementById("rsvp-status");
    const familyName = document.getElementById("family-name");
    const guestCount = document.getElementById("guest-count");
    const submitButton = form?.querySelector('button[type="submit"]');
    const token = new URLSearchParams(window.location.search).get("token");

    function showError(message) {
        loading.hidden = true;
        error.textContent = message;
        error.hidden = false;
    }

    function guestLabel(count) {
        return `${count} ${count === 1 ? "persona" : "personas"}`;
    }

    async function loadInvitation() {
        if (!token) {
            showError("Este enlace no incluye una invitación válida.");
            return;
        }

        try {
            const response = await fetch(`/api/invitation?token=${encodeURIComponent(token)}`);
            const invitation = await response.json();

            if (!response.ok) {
                throw new Error(invitation.error || "No fue posible cargar la invitación.");
            }

            familyName.textContent = invitation.familyName;
            guestCount.textContent = guestLabel(invitation.guestCount);
            loading.hidden = true;
            form.hidden = false;

            if (invitation.rsvp) {
                const currentChoice = form.querySelector(`input[value="${invitation.rsvp.attendance ? "yes" : "no"}"]`);
                if (currentChoice) currentChoice.checked = true;
                status.textContent = "Ya recibimos su respuesta. Pueden actualizarla si es necesario.";
            }
        } catch (loadError) {
            showError(loadError.message);
        }
    }

    form?.addEventListener("submit", async function (event) {
        event.preventDefault();
        const attendance = form.querySelector('input[name="attendance"]:checked');

        if (!attendance) {
            status.textContent = "Seleccionen una respuesta para continuar.";
            return;
        }

        submitButton.disabled = true;
        status.textContent = "Guardando su respuesta…";

        try {
            const response = await fetch("/api/rsvp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, attendance: attendance.value === "yes" })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "No fue posible guardar la respuesta.");
            }

            status.textContent = result.message;
        } catch (submitError) {
            status.textContent = submitError.message;
        } finally {
            submitButton.disabled = false;
        }
    });

    loadInvitation();
})();
