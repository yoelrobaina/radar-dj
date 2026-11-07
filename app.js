const form = document.getElementById("signup");
const errorBox = document.getElementById("error");
const submitBtn = document.getElementById("submitBtn");
const doneBox = document.getElementById("done");

const selectedGenres = new Set();

document.getElementById("genres").addEventListener("click", (event) => {
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

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;

  const data = new FormData(form);
  const name = (data.get("name") || "").toString().trim();
  const whatsapp = (data.get("whatsapp") || "").toString().trim();
  const email = (data.get("email") || "").toString().trim();
  const artists = (data.get("artists") || "").toString().trim();
  const delivery = (data.get("delivery") || "whatsapp").toString();

  if (!name) return showError("Pon tu nombre artístico.");
  if (!whatsapp && !email) return showError("Pon tu WhatsApp o tu correo pa' saber dónde mandarte los links.");
  if (selectedGenres.size === 0) return showError("Marca al menos un género.");
  if (SUPABASE_URL.includes("REPLACE_WITH")) {
    return showError("El registro todavía no está conectado. Inténtalo en un rato.");
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Apuntándote…";

  try {
    const response = await fetch(SUPABASE_URL + "/rest/v1/radar_dj_signups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        name,
        whatsapp: whatsapp || null,
        email: email || null,
        genres: [...selectedGenres],
        artists: artists || null,
        delivery,
        plan: "trial",
      }),
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    document.getElementById("doneChannel").textContent =
      delivery === "email" ? "correo" : delivery === "ambos" ? "el grupo de WhatsApp y correo" : "el grupo de WhatsApp";
    form.hidden = true;
    doneBox.hidden = false;
    doneBox.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (err) {
    showError("No se pudo guardar el registro. Revisa tu conexión e inténtalo de nuevo.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Apuntarme — primera semana gratis";
  }
});
