const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


const loginView = document.getElementById("loginView");

const dashView = document.getElementById("dashView");

const logoutBtn = document.getElementById("logoutBtn");

const loginForm = document.getElementById("loginForm");

const loginError = document.getElementById("loginError");

const dashError = document.getElementById("dashError");

const usersList = document.getElementById("usersList");

const emptyMsg = document.getElementById("emptyMsg");

const searchInput = document.getElementById("searchInput");

const renewalsList = document.getElementById("renewalsList");

const renewalsEmpty = document.getElementById("renewalsEmpty");

let allUsers = [];

let allRenewals = [];


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
  loadRenewals();
}

function showLogin() {
  loginView.hidden = false;
  dashView.hidden = true;
  logoutBtn.hidden = true;
  loginForm.hidden = false;
}

// Login con contraseña: sin enlaces por correo.
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError(loginError);
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;

  if (!email) return showError(loginError, "Pon tu correo.");
  if (!password) return showError(loginError, "Pon tu contraseña.");

  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.textContent = "Entrando…";
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session || data.session.user.email.toLowerCase() !== ADMIN_EMAIL) {
      await client.auth.signOut();
      return showError(loginError, "Esa cuenta no es la del administrador.");
    }
    showDash();
  } catch (err) {
    showError(loginError, "Correo o contraseña incorrectos. Inténtalo de nuevo.");
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
      `<p class="user-meta">Correo: <strong></strong><br>Teléfono: <strong></strong><br>` +
      `Géneros: <strong></strong><br>Artistas: <strong></strong><br>` +
      `Apuntado: <strong></strong> · Vence: <strong></strong></p>` +
      '<div class="user-actions"></div>';

    card.querySelector(".user-name").textContent = user.name || "Sin nombre";

    const strongs = card.querySelectorAll(".user-meta strong");

    strongs[0].textContent = user.email || "—";
    strongs[1].textContent = user.whatsapp || "—";
    strongs[2].textContent = (user.genres || []).join(", ") || "—";
    strongs[3].textContent = user.artists || "—";
    strongs[4].textContent = fmtDate(user.created_at);
    strongs[5].textContent = fmtDate(user.expires_at);

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
  if (!btn.dataset.confirm) {
    btn.dataset.confirm = "1";
    btn.textContent = "¿Seguro? Toca para borrar";
    setTimeout(() => {
      delete btn.dataset.confirm;
      btn.textContent = "Eliminar";
    }, 5000);
    return;
  }

  btn.disabled = true;

  const { error } = await client.from("radar_dj_signups").delete().eq("id", user.id);

  if (error) {
    showError(dashError, "No se pudo eliminar.");
    btn.disabled = false;
    return;
  }

  loadUsers();
}

// Renovaciones: avisos de DJs que ya pagaron por Transfermóvil.
async function loadRenewals() {
  const { data, error } = await client
    .from("radar_dj_renewals")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return;

  allRenewals = data || [];
  renderRenewals();
}

function renderRenewals() {
  renewalsEmpty.hidden = allRenewals.length !== 0;
  renewalsList.innerHTML = "";

  for (const renewal of allRenewals) {
    const card = document.createElement("article");
    card.className = "user";

    card.innerHTML =
      '<div class="user-head">' +
      "<h2 class='user-name'></h2>" +
      "</div>" +
      `<p class="user-meta">Avisó: <strong></strong></p>` +
      '<div class="user-actions"></div>';

    card.querySelector(".user-name").textContent = renewal.email || "Sin correo";
    card.querySelector(".user-meta strong").textContent = fmtDate(renewal.created_at);

    const actions = card.querySelector(".user-actions");

    const activate = document.createElement("button");
    activate.className = "btn activate";
    activate.type = "button";
    activate.textContent = "Activar 30 días";
    activate.addEventListener("click", () => activateRenewal(renewal, activate));
    actions.appendChild(activate);

    const discard = document.createElement("button");
    discard.className = "btn delete";
    discard.type = "button";
    discard.textContent = "Descartar";
    discard.addEventListener("click", () => resolveRenewal(renewal, discard));
    actions.appendChild(discard);

    renewalsList.appendChild(card);
  }
}

async function activateRenewal(renewal, btn) {
  btn.disabled = true;
  const user = allUsers.find((u) => (u.email || "").toLowerCase() === (renewal.email || "").toLowerCase());

  if (!user) {
    showError(dashError, "Ese correo no tiene registro en Radar DJ.");
    btn.disabled = false;
    return;
  }

  const base = user.expires_at ? Math.max(new Date(user.expires_at).getTime(), Date.now()) : Date.now();
  const expiresAt = new Date(base + 30 * DAY).toISOString();

  const { error } = await client
    .from("radar_dj_signups")
    .update({ plan: "paid", expires_at: expiresAt })
    .eq("id", user.id);

  if (error) {
    showError(dashError, "No se pudo activar la renovación.");
    btn.disabled = false;
    return;
  }

  await resolveRenewal(renewal, btn, true);
}

async function resolveRenewal(renewal, btn, silent) {
  if (!silent) btn.disabled = true;

  const { error } = await client
    .from("radar_dj_renewals")
    .update({ status: "done" })
    .eq("id", renewal.id);

  if (error && !silent) {
    showError(dashError, "No se pudo guardar el cambio.");
    btn.disabled = false;
    return;
  }

  loadUsers();
  loadRenewals();
}

searchInput.addEventListener("input", renderUsers);
document.getElementById("refreshBtn").addEventListener("click", () => {
  loadUsers();
  loadRenewals();
});

(async function init() {
  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session && session.user && session.user.email.toLowerCase() === ADMIN_EMAIL) {
      showDash();
    }
  });

  const { data } = await client.auth.getSession();

  if (data.session && data.session.user && data.session.user.email.toLowerCase() === ADMIN_EMAIL) {
    showDash();
  } else {
    showLogin();
  }
})();
