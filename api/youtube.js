// Resuelve el video exacto de YouTube para un tema (título + artista).
// Se ejecuta en el servidor de Vercel: sin el bloqueo entre sitios del navegador.
module.exports = async (req, res) => {
  const q = ((req.query && req.query.q) || "").toString().trim();
  if (!q) {
    res.status(400).json({ error: "Falta q" });
    return;
  }
  const searchUrl = "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);

  // 1) Invidious (yewtu.be): devuelve el videoId directo.
  try {
    const r = await fetch("https://yewtu.be/api/v1/search?q=" + encodeURIComponent(q) + "&type=video", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const d = await r.json();
      const hit = (Array.isArray(d) ? d : []).find((x) => x && x.type === "video" && x.videoId);
      if (hit) {
        res.json({ videoId: hit.videoId, title: hit.title || "", url: "https://www.youtube.com/watch?v=" + hit.videoId });
        return;
      }
    }
  } catch (e) { /* siguiente vía */ }

  // 2) Página de búsqueda de YouTube: primer videoId del HTML.
  try {
    const r = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const html = await r.text();
      const m = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
      if (m) {
        res.json({ videoId: m[1], url: "https://www.youtube.com/watch?v=" + m[1] });
        return;
      }
    }
  } catch (e) { /* cae al respaldo */ }

  res.json({ url: searchUrl });
};
