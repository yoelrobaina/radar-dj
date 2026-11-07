const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DAY = 24 * 60 * 60 * 1000;

// Elements
const brandBtn = document.getElementById("brandBtn");
const ctaSignup = document.getElementById("ctaSignup");
const openRegisterBtn = document.getElementById("openRegisterBtn");
const openLoginBtn = document.getElementById("openLoginBtn");
const registroSection = document.getElementById("registro");
const panelSection = document.getElementById("panel");
const authModal = document.getElementById("authModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");
const goRegisterBtn = document.getElementById("goRegisterBtn");
const logoutBtn = document.getElementById("logoutBtn");
const renewBtn = document.getElementById("renewBtn");
const renewBox = document.getElementById("renewBox");
const paidBtn = document.getElementById("paidBtn");
const renewMsg = document.getElementById("renewMsg");
const recoverForm = document.getElementById("recoverForm");
const newPasswordForm = document.getElementById("newPasswordForm");
const goRecoverBtn = document.getElementById("goRecoverBtn");
const backToLoginBtn = document.getElementById("backToLoginBtn");
const loginOk = document.getElementById("loginOk");
const recoverError = document.getElementById("recoverError");
const recoverOk = document.getElementById("recoverOk");
const newPasswordError = document.getElementById("newPasswordError");
const newPasswordOk = document.getElementById("newPasswordOk");

let currentEmail = "";
let isRecovery = false;
let selectedGenres = new Set();

// Anti-spam del registro (sin CAPTCHA de pago): campo trampa invisible,
// tiempo mínimo para llenar el formulario y límite de intentos por navegador.
let formOpenedAt = 0;
const MIN_FILL_MS = 3000;
const MAX_ATTEMPTS_PER_HOUR = 3;

function attemptsInLastHour(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]").filter((t) => Date.now() - t < 3600000);
  } catch (e) {
    return [];
  }
}

function recordAttempt(key) {
  const list = attemptsInLastHour(key);
  list.push(Date.now());
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) { /* sin almacenamiento, sigue sin el límite local */ }
}

function tooManyAttempts(key) {
  return attemptsInLastHour(key).length >= MAX_ATTEMPTS_PER_HOUR;
}

function showError(box, message) {
  box.textContent = message;
  box.hidden = false;
}

function hideError(box) {
  box.hidden = true;
  box.textContent = "";
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// Modal
function openModal(tab) {
  authModal.hidden = false;
  showTab(tab || "register");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  authModal.hidden = true;
  document.body.style.overflow = "";
}

function showAuthView(view) {
  loginForm.hidden = view !== "login";
  registerForm.hidden = view !== "register";
  recoverForm.hidden = view !== "recover";
  newPasswordForm.hidden = view !== "newpassword";
  recoverError.hidden = true;
  recoverOk.hidden = true;
  newPasswordError.hidden = true;
  newPasswordOk.hidden = true;
  tabLogin.setAttribute("aria-selected", view === "login" ? "true" : "false");
  tabRegister.setAttribute("aria-selected", view === "register" ? "true" : "false");
}

function showTab(tab) {
  if (tab === "register") formOpenedAt = Date.now();
  showAuthView(tab);
}

ctaSignup.addEventListener("click", () => openModal("register"));
openRegisterBtn.addEventListener("click", () => openModal("register"));
openLoginBtn.addEventListener("click", () => openModal("login"));
goRegisterBtn.addEventListener("click", () => showTab("register"));
goRecoverBtn.addEventListener("click", () => showAuthView("recover"));
backToLoginBtn.addEventListener("click", () => showAuthView("login"));
tabLogin.addEventListener("click", () => showTab("login"));
tabRegister.addEventListener("click", () => showTab("register"));
closeModalBtn.addEventListener("click", closeModal);
authModal.addEventListener("click", (event) => {
  if (event.target === authModal) closeModal();
});

// RADAR DJ = botón de inicio: con sesión lleva al panel, sin sesión arriba del todo.
brandBtn.addEventListener("click", () => {
  if (currentEmail) {
    panelSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

// Géneros en el modal de registro
document.getElementById("genresModal").addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-genre]");
  if (!btn) return;
  const genre = btn.dataset.genre;
  if (selectedGenres.has(genre)) {
    selectedGenres.delete(genre);
    btn.setAttribute("aria-pressed", "false");
  } else {
    selectedGenres.add(genre);
    btn.setAttribute("aria-pressed", "true");
  }
});

// Panel del usuario
function statusOf(row) {
  const expires = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const now = Date.now();
  if (row.plan === "paid") {
    if (expires <= now) return { key: "expired", label: "Vencida" };
    if (expires - now <= 3 * DAY) return { key: "free", label: "Pagando · por vencer" };
    return { key: "paid", label: "Pagando" };
  }
  if (expires && expires <= now) return { key: "expired", label: "Gratis vencida" };
  return { key: "free", label: "Gratis" };
}

function showPanel(row) {
  const status = statusOf(row);
  document.getElementById("panelName").textContent = row.name || "DJ";
  const badge = document.getElementById("panelPlan");
  badge.textContent = status.label;
  badge.className = "badge " + status.key;
  const expires = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const days = expires ? Math.max(0, Math.ceil((expires - Date.now()) / DAY)) : 0;
  document.getElementById("panelDays").textContent = days;
  document.getElementById("panelDaysLabel").textContent = days === 1 ? "día te queda" : "días te quedan";
  document.getElementById("panelExpires").textContent = fmtDate(row.expires_at);
  document.getElementById("panelEmail").textContent = row.email || currentEmail;
  document.getElementById("panelPhone").textContent = row.whatsapp || "—";
  const genresBox = document.getElementById("panelGenres");
  genresBox.innerHTML = "";
  (row.genres || []).forEach((g) => {
    const chip = document.createElement("span");
    chip.className = "chip-static";
    chip.textContent = g;
    genresBox.appendChild(chip);
  });
  if (!(row.genres || []).length) genresBox.textContent = "—";
  document.getElementById("panelArtists").textContent = row.artists || "—";
  registroSection.hidden = true;
  panelSection.hidden = false;
  renewBox.hidden = true;
  renewMsg.hidden = true;
}

function showLoggedOut() {
  currentEmail = "";
  registroSection.hidden = false;
  panelSection.hidden = true;
}

async function loadMyRow(email) {
  const { data, error } = await client
    .from("radar_dj_signups")
    .select("*")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// Registro: cuenta con correo y contraseña + fila de suscripción (solo correo).
registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError(registerError);
  // Anti-spam: un bot llena el campo trampa o manda el formulario al instante.
  const honeypot = (document.getElementById("regWebsite") || {}).value || "";
  if (honeypot.trim()) return showError(registerError, "No se pudo crear la cuenta. Inténtalo de nuevo.");
  if (formOpenedAt && Date.now() - formOpenedAt < MIN_FILL_MS) return showError(registerError, "Espera unos segundos y vuelve a intentarlo.");
  if (tooManyAttempts("rdj_reg_attempts")) return showError(registerError, "Ya intentaste varias veces. Espera una hora e inténtalo de nuevo.");
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const phone = document.getElementById("regPhone").value.trim();
  const password = document.getElementById("regPassword").value;
  const artists = document.getElementById("regArtists").value.trim();

  if (!name) return showError(registerError, "Pon tu nombre de DJ.");
  if (!email) return showError(registerError, "Pon tu correo, ahí te llegan los links.");
  if (password.length < 6) return showError(registerError, "La contraseña tiene que tener 6 caracteres mínimo.");
  if (selectedGenres.size === 0) return showError(registerError, "Marca al menos un género.");

  recordAttempt("rdj_reg_attempts");
  const btn = document.getElementById("registerBtn");
  btn.disabled = true;
  btn.textContent = "Creando tu cuenta…";

  try {
    const { error } = await client.auth.signUp({
      email,
      password,
      options: { data: { name, phone: phone || null } },
    });
    if (error) throw error;

    // Si el correo ya tenía un registro (ej. un DJ apuntado antes), no se duplica: se usa esa fila.
    const existing = await loadMyRow(email);
    if (!existing) {
      const { error: insertError } = await client.from("radar_dj_signups").insert({
        name,
        whatsapp: phone || null,
        email,
        genres: [...selectedGenres],
        artists: artists || null,
        delivery: "email",
        plan: "trial",
      });
      if (insertError) throw insertError;
    }

    currentEmail = email;
    const row = await loadMyRow(email);
    closeModal();
    if (row) {
      showPanel(row);
      panelSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      showLoggedOut();
      openModal("login");
      showError(loginError, "La cuenta se creó, pero no se guardaron tus géneros. Entra con tu correo y contraseña.");
    }
  } catch (err) {
    const msg = ((err && err.message) || "").toLowerCase();
    if (msg.includes("already registered") || msg.includes("already exists")) {
      showError(registerError, "Ese correo ya tiene cuenta. Entra con tu contraseña.");
      showTab("login");
    } else {
      showError(registerError, "No se pudo crear la cuenta. Revisa el correo y la contraseña e inténtalo de nuevo.");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Crear mi cuenta — primera semana gratis";
  }
});

// Entrar
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError(loginError);
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) return showError(loginError, "Pon tu correo y tu contraseña.");

  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.textContent = "Entrando…";
  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentEmail = email;
    const row = await loadMyRow(email);
    closeModal();
    if (row) {
      showPanel(row);
      panelSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (err) {
    showError(loginError, "Correo o contraseña incorrectos. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
});

// Recuperación de contraseña: manda el enlace al correo.
recoverForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError(recoverError);
  recoverOk.hidden = true;
  recoverOk.textContent = "";
  const email = document.getElementById("recoverEmail").value.trim().toLowerCase();
  if (!email) return showError(recoverError, "Pon tu correo.");
  if (tooManyAttempts("rdj_recover_attempts")) return showError(recoverError, "Ya pediste el enlace varias veces. Espera una hora e inténtalo de nuevo.");
  recordAttempt("rdj_recover_attempts");
  const btn = document.getElementById("recoverBtn");
  btn.disabled = true;
  btn.textContent = "Mandando…";
  try {
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: "https://radardj.vercel.app/",
    });
    if (error) throw error;
    recoverOk.textContent = "Listo. Te mandamos un correo con el enlace para poner una contraseña nueva. Revisa también el spam.";
    recoverOk.hidden = false;
  } catch (err) {
    showError(recoverError, "No se pudo mandar el correo. Revisa el correo e inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Mandar el enlace";
  }
});

// Contraseña nueva (tras abrir el enlace del correo).
newPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError(newPasswordError);
  newPasswordOk.hidden = true;
  newPasswordOk.textContent = "";
  const p1 = document.getElementById("newPassword").value;
  const p2 = document.getElementById("newPassword2").value;
  if (p1.length < 6) return showError(newPasswordError, "La contraseña tiene que tener 6 caracteres mínimo.");
  if (p1 !== p2) return showError(newPasswordError, "Las contraseñas no coinciden.");
  const btn = document.getElementById("newPasswordBtn");
  btn.disabled = true;
  btn.textContent = "Cambiando…";
  try {
    const { error } = await client.auth.updateUser({ password: p1 });
    if (error) throw error;
    await client.auth.signOut();
    isRecovery = false;
    showAuthView("login");
    loginOk.textContent = "Contraseña cambiada. Entra con la nueva.";
    loginOk.hidden = false;
  } catch (err) {
    showError(newPasswordError, "No se pudo cambiar la contraseña. El enlace pudo haber vencido: pide uno nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Cambiar mi contraseña";
  }
});

// Salir
logoutBtn.addEventListener("click", async () => {
  await client.auth.signOut();
  showLoggedOut();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Renovar: el DJ paga por Transfermóvil y avisa; Yoel activa desde el panel admin.
renewBtn.addEventListener("click", () => {
  renewBox.hidden = false;
  renewBox.scrollIntoView({ behavior: "smooth", block: "center" });
});

paidBtn.addEventListener("click", async () => {
  paidBtn.disabled = true;
  paidBtn.textContent = "Avisando…";
  try {
    const { error } = await client.from("radar_dj_renewals").insert({ email: currentEmail });
    if (error) throw error;
    renewMsg.textContent = "Aviso enviado. En cuanto Yoel confirme el pago, tu suscripción se activa por 30 días.";
    renewMsg.hidden = false;
    paidBtn.textContent = "Aviso enviado ✓";
  } catch (err) {
    renewMsg.textContent = "No se pudo mandar el aviso. Inténtalo de nuevo en un rato.";
    renewMsg.hidden = false;
    paidBtn.disabled = false;
    paidBtn.textContent = "Ya pagué, avisar";
  }
});

// Recuperación de contraseña: el enlace del correo trae un token en la URL.
function showNewPasswordView() {
  isRecovery = true;
  openModal("login");
  showAuthView("newpassword");
  history.replaceState(null, "", window.location.pathname);
}

// Sesión al cargar
client.auth.onAuthStateChange(async (event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    showNewPasswordView();
    return;
  }
  if (event === "SIGNED_IN" && session && session.user) {
    if (isRecovery) {
      showNewPasswordView();
      return;
    }
    currentEmail = session.user.email;
    const row = await loadMyRow(currentEmail);
    if (row) showPanel(row);
  } else if (event === "SIGNED_OUT") {
    showLoggedOut();
  }
});

(async function init() {
  if ((window.location.hash || "").includes("type=recovery")) {
    showNewPasswordView();
  }
  const { data } = await client.auth.getSession();
  if (data.session && data.session.user) {
    if (isRecovery) {
      showNewPasswordView();
      return;
    }
    currentEmail = data.session.user.email;
    const row = await loadMyRow(currentEmail);
    if (row) showPanel(row);
    else showLoggedOut();
  } else {
    showLoggedOut();
  }
})();
