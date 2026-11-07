const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginView = document.getElementById("loginView");
const dashView = document.getElementById("dashView");
const logoutBtn = document.getElementById("logoutBtn");
const loginForm = document.getElementById("loginForm");
const codeForm = document.getElementById("codeForm");
const loginError = document.getElementById("loginError");
const codeError = document.getElementById("codeError");
const dashError = document.getElementById("dashError");
const usersList = document.getElementById("usersList");
const emptyMsg = document.getElementById("emptyMsg");
const searchInput = document.getElementById("searchInput");

let allUsers = [];
let loginEmail = "";

const DAY = 24 * 60 * 60 * 1000;

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

function statusOf(user) {
  const expires = user.expires_at ? new Date(user.expires_at).getTime() : 0;
  const now = Date.now();
  if (user.plan === "paid") {
    if (expires <= now) return { key: "expired", label: "Vencido" };
    if (expires - now <= 3 * DAY) return { key: "expiring", label: "Por vencer" };
    return { key: "paid", label: "Pagando" };
  }
  if (expires && expires <= now) return { key: "expired", label: "Gratis vencido" };
  return { key: "free", label: "Gratis" };
}

function showDash() {
  loginView.hidden = true;
  dashView.hidden = false;
  logoutBtn.hidden = false;
  loadUsers();
}

function showLogin() {
  loginView.hidden = false;
  dashView.hidden = true;
  logoutBtn.hidden = true;
  loginForm.hidden = false;
  codeForm.hidden = true;
}

async function sendCode(email) {
  hideError(loginError);
  hideError(codeError);
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw error;
  loginEmail = email;
  document.getElementById("sentTo").textContent = email;
  loginForm.hidden = true;
  codeForm.hidden = false;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  if (!email) return showError(loginError, "Pon tu correo.");
  const btn = document.getElementById("sendCodeBtn");
  btn.disabled = true;
  btn.textContent = "Mandando…";
  try {
    await sendCode(email);
  } catch (err) {
    showError(loginError, "No se pudo mandar el código. Revisa el correo e inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Mandar código";
  }
});

document.getElementById("resendBtn").addEventListener("click", async () => {
  try {
    await sendCode(loginEmail);
  } catch (err) {
    showError(codeError, "No se pudo mandar el código de nuevo.");
  }
});

codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = document.getElementById("codeInput").value.trim();
  if (token.length !== 6) return showError(codeError, "El código tiene 6 dígitos.");
  const btn = document.getElementById("verifyBtn");
  btn.disabled = true;
  btn.textContent = "Entrando…";
  try {
    const { data, error } = await client.auth.verifyOtp({ email: loginEmail, token, type: "email" });
    if (error) throw error;
    if (!data.user || data.user.email.toLowerCase() !== ADMIN_EMAIL) {
      await client.auth.signOut();
      throw new Error("not admin");
    }
    showDash();
  } catch (err) {
    showError(codeError, "Código incorrecto o vencido. Pide uno nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
});

logoutBtn.addEventListener("click", async () => {
  await client.auth.signOut();
  showLogin();
});

async function loadUsers() {
  hideError(dashError);
  const { data, error } = await client
    .from("radar_dj_signups")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    showError(dashError, "No se pudo cargar la lista. Inténtalo de nuevo.");
    return;
  }
  allUsers = data || [];
  renderUsers();
}

function renderUsers() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = allUsers.filter((u) => {
    if (!query) return true;
    return (u.email || "").toLowerCase().includes(query) || (u.whatsapp || "").toLowerCase().includes(query) || (u.name || "").toLowerCase().includes(query);
  });

  const total = allUsers.length;
  const free = allUsers.filter((u) => statusOf(u).key === "free").length;
  const paid = allUsers.filter((u) => statusOf(u).key === "paid").length;
  const expiring = allUsers.filter((u) => ["expiring", "expired"].includes(statusOf(u).key)).length;
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statFree").textContent = free;
  document.getElementById("statPaid").textContent = paid;
  document.getElementById("statExpiring").textContent = expiring;

  emptyMsg.hidden = filtered.length !== 0;
  usersList.innerHTML = "";
  for (const user of filtered) {
    const status = statusOf(user);
    const card = document.createElement("article");
    card.className = "user";
    card.innerHTML =
      '<div class="user-head">' +
      "<h2 class='user-name'></h2>" +
      `<span class="badge ${status.key}">${status.label}</span>` +
      "</div>" +
      `<p class="user-meta">Correo: <strong></strong><br>WhatsApp: <strong></strong><br>` +
      `Géneros: <strong></strong><br>Artistas: <strong></strong><br>` +
      `Recibe por: <strong></strong> · Apuntado: <strong></strong> · Vence: <strong></strong></p>` +
      '<div class="user-actions"></div>';
    card.querySelector(".user-name").textContent = user.name || "Sin nombre";
    const strongs = card.querySelectorAll(".user-meta strong");
    strongs[0].textContent = user.email || "—";
    strongs[1].textContent = user.whatsapp || "—";
    strongs[2].textContent = (user.genres || []).join(", ") || "—";
    strongs[3].textContent = user.artists || "—";
    strongs[4].textContent = user.delivery || "whatsapp";
    strongs[5].textContent = fmtDate(user.created_at);
    strongs[6].textContent = fmtDate(user.expires_at);

    const actions = card.querySelector(".user-actions");
    if (user.plan !== "paid") {
      const activate = document.createElement("button");
      activate.className = "btn activate";
      activate.type = "button";
      activate.textContent = "Activar 30 días";
      activate.addEventListener("click", () => setSubscription(user, "activate", activate));
      actions.appendChild(activate);
    } else {
      const renew = document.createElement("button");
      renew.className = "btn renew";
      renew.type = "button";
      renew.textContent = "Renovar +30 días";
      renew.addEventListener("click", () => setSubscription(user, "renew", renew));
      actions.appendChild(renew);
    }
    const del = document.createElement("button");
    del.className = "btn delete";
    del.type = "button";
    del.textContent = "Eliminar";
    del.addEventListener("click", () => deleteUser(user, del));
    actions.appendChild(del);

    usersList.appendChild(card);
  }
}

async function setSubscription(user, mode, btn) {
  btn.disabled = true;
  const base = mode === "renew" && user.expires_at ? Math.max(new Date(user.expires_at).getTime(), Date.now()) : Date.now();
  const expiresAt = new Date(base + 30 * DAY).toISOString();
  const { error } = await client
    .from("radar_dj_signups")
    .update({ plan: "paid", expires_at: expiresAt })
    .eq("id", user.id);
  if (error) {
    showError(dashError, "No se pudo guardar el cambio.");
    btn.disabled = false;
    return;
  }
  loadUsers();
}

async function deleteUser(user, btn) {
  if (!window.confirm(`¿Eliminar a ${user.name || user.email || "este usuario"}?`)) return;
  btn.disabled = true;
  const { error } = await client.from("radar_dj_signups").delete().eq("id", user.id);
  if (error) {
    showError(dashError, "No se pudo eliminar.");
    btn.disabled = false;
    return;
  }
  loadUsers();
}

searchInput.addEventListener("input", renderUsers);
document.getElementById("refreshBtn").addEventListener("click", loadUsers);

(async function init() {
  const { data } = await client.auth.getSession();
  if (data.session && data.session.user && data.session.user.email.toLowerCase() === ADMIN_EMAIL) {
    loginEmail = data.session.user.email;
    showDash();
  } else {
    showLogin();
  }
})();
