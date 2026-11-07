// Resuelve el video exacto de YouTube para un tema (título + artista).
// Se ejecuta en el servidor de Vercel: sin el bloqueo entre sitios del navegador.
module.exports = async (req, res) => {
  const q = ((req.query && req.query.q) || "").toString().trim();
  if (!q) {
    res.status(400).json({ error: "Falta q" });
    return;
  }
  const searchUrl = "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);

  // Prefiere el "Official Video" sobre lyric/audio/visualizer; si no hay, el primero.
  function pickOfficial(cands) {
    const list = (cands || []).filter((c) => c && c.videoId);
    if (!list.length) return null;
    const norm = (s) => (s || "").toLowerCase();
    const official = list.filter(
      (c) => norm(c.title).includes("official video") && !norm(c.title).includes("lyric")
    );
    if (official.length) {
      official.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      return official[0];
    }
    return list[0];
  }

  // 1) Invidious (yewtu.be): devuelve varios resultados con título y visitas.
  try {
    const r = await fetch("https://yewtu.be/api/v1/search?q=" + encodeURIComponent(q) + "&type=video", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const d = await r.json();
      const cands = (Array.isArray(d) ? d : [])
        .filter((x) => x && x.type === "video" && x.videoId)
        .map((x) => ({ videoId: x.videoId, title: x.title || "", viewCount: x.viewCount || 0 }));
      const pick = pickOfficial(cands);
      if (pick) {
        res.json({ videoId: pick.videoId, title: pick.title, url: "https://www.youtube.com/watch?v=" + pick.videoId });
        return;
      }
    }
  } catch (e) { /* siguiente vía */ }

  // 2) Página de búsqueda de YouTube: primeros videoIds del HTML, con título por oEmbed.
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
      const ids = [...new Set([...html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)].map((m) => m[1]))].slice(0, 5);
      if (ids.length) {
        const infos = await Promise.all(
          ids.map(async (id) => {
            try {
              const o = await fetch(
                "https://www.youtube.com/oembed?url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id) + "&format=json",
                { signal: AbortSignal.timeout(5000) }
              );
              if (!o.ok) return { videoId: id, title: "" };
              const j = await o.json();
              return { videoId: id, title: j.title || "" };
            } catch (e) {
              return { videoId: id, title: "" };
            }
          })
        );
        const pick = pickOfficial(infos);
        if (pick) {
          res.json({ videoId: pick.videoId, url: "https://www.youtube.com/watch?v=" + pick.videoId });
          return;
        }
      }
    }
  } catch (e) { /* cae al respaldo */ }

  res.json({ url: searchUrl });
};
