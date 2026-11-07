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

let currentEmail = "";
let selectedGenres = new Set();

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

function showTab(tab) {
  const isLogin = tab === "login";
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
  tabLogin.setAttribute("aria-selected", isLogin ? "true" : "false");
  tabRegister.setAttribute("aria-selected", isLogin ? "false" : "true");
}

ctaSignup.addEventListener("click", () => openModal("register"));
openRegisterBtn.addEventListener("click", () => openModal("register"));
openLoginBtn.addEventListener("click", () => openModal("login"));
goRegisterBtn.addEventListener("click", () => showTab("register"));
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
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const phone = document.getElementById("regPhone").value.trim();
  const password = document.getElementById("regPassword").value;
  const artists = document.getElementById("regArtists").value.trim();

  if (!name) return showError(registerError, "Pon tu nombre de DJ.");
  if (!email) return showError(registerError, "Pon tu correo, ahí te llegan los links.");
  if (password.length < 6) return showError(registerError, "La contraseña tiene que tener 6 caracteres mínimo.");
  if (selectedGenres.size === 0) return showError(registerError, "Marca al menos un género.");

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

// Sesión al cargar
client.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && session && session.user) {
    currentEmail = session.user.email;
    const row = await loadMyRow(currentEmail);
    if (row) showPanel(row);
  } else if (event === "SIGNED_OUT") {
    showLoggedOut();
  }
});

(async function init() {
  const { data } = await client.auth.getSession();
  if (data.session && data.session.user) {
    currentEmail = data.session.user.email;
    const row = await loadMyRow(currentEmail);
    if (row) showPanel(row);
    else showLoggedOut();
  } else {
    showLoggedOut();
  }
})();
