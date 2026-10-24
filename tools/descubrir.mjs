/* Robot de "Para descubrir": junta propuestas de Turismo BA y Baires Secreta y las guarda en
   data/descubrir.json. Corre todos los días en GitHub Actions (.github/workflows/descubrir.yml).
   De cada propuesta guarda lo justo (nombre, tipo, cuándo, dónde, link al original): no copia
   textos ni fotos de Baires Secreta. */
import fs from "node:fs";
import { parseCaption } from "../caption.js";

const UA = "Mozilla/5.0 (compatible; QueHacemosHoy/1.0; +https://lucasvyte.github.io/que-hacemos-hoy/)";
const get = async (url, as = "text") => {
  const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "es-AR,es" } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return as === "json" ? r.json() : r.text();
};
const clean = s => String(s ?? "").replace(/\s+/g, " ").trim();
const cut = (s, n) => { s = clean(s); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

/* tipo de Turismo BA → categoría de la app */
const CAT = { "Teatro":"teatro", "Música":"musica", "Danza":"teatro", "Cine":"cine", "Gastronomía":"comer",
  "Visita guiada":"visitar", "Artes visuales":"visitar", "Exposición":"visitar", "Museo":"visitar",
  "Deporte":"deporte", "Feria":"actividad", "Infantil":"actividad", "Evento":"actividad" };

async function turismo(){
  const html = await get("https://turismo.buenosaires.gob.ar/es/article/que-hacer-esta-semana");
  const m = html.match(/const json = `([\s\S]*?)`/);
  if (!m) throw new Error("Turismo BA: no encontré la lista (¿cambió la página?)");
  const list = JSON.parse(m[1]);
  return list.map(x => {
    const tipo = clean(x.categoria_actividad_filtro);
    const lugar = [clean(x.proveedor), clean(x.calle_altura)].filter(v => v && v !== "-").join(" — ");
    const barrio = clean(x.barrio);
    return {
      id: "tba-" + clean(x.orden + "-" + x.nombre_actividad).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").slice(0, 60),
      src: "turismo",
      title: cut(x.nombre_actividad, 120),
      tipo: tipo || "Actividad",
      cat: CAT[tipo] || "actividad",
      when: cut(x.dias_horarios, 160),
      days: clean(x.dias_filtro).split(",").map(clean).filter(Boolean),
      from: /^\d{4}-\d{2}-\d{2}$/.test(clean(x.fecha_inicio)) ? clean(x.fecha_inicio) : "",
      free: clean(x.precio_filtro) === "0",
      place: cut(lugar, 160),
      zona: barrio && barrio !== "CABA" ? barrio : "",
      lat: num(x.latitud), lng: num(x.longitud),
      link: clean(x.url_boton) || "https://turismo.buenosaires.gob.ar/es/article/que-hacer-esta-semana",
      img: /^https:\/\//.test(clean(x.foto)) ? clean(x.foto) : ""
    };
  }).filter(x => x.title);
}

/* "concierto-inmersivo-vivaldi-templo" → "Concierto inmersivo vivaldi templo" */
const titleFromLink = u => {
  try {
    const slug = new URL(u).pathname.split("/").filter(Boolean).pop() || "";
    const t = decodeURIComponent(slug).replace(/[-_]+/g, " ").replace(/\s+(buenos aires|caba)$/i, "").trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  } catch { return ""; }
};
async function secreta(){
  const page = await get("https://api-prod.linkin.bio/api/v2/pages?nickname=baires-secreta", "json");
  const pid = JSON.stringify(page).match(/"social_profile_id"\s*:\s*(\d+)/)?.[1] || "8454539";
  const out = [];
  let start = "";
  for (let n = 0; n < 3; n++) {
    const d = await get(`https://api-prod.linkin.bio/api/v2/linkinbio_posts?social_profile_id=${pid}&start_time=${start}`, "json");
    const posts = d.linkinbio_posts || [];
    if (!posts.length) break;
    for (const p of posts) {
      let link = p.link_url || "";
      try { const u = new URL(link); [...u.searchParams.keys()].filter(k => k.startsWith("utm_")).forEach(k => u.searchParams.delete(k)); link = u.href; } catch { continue; }
      if (!/^https:\/\//.test(link)) continue;
      // nombre corto: lo que está entre comillas en la publicación, si no el del link, si no las primeras palabras
      const cap = String(p.caption || "").replace(/[\p{Extended_Pictographic}‍️⁠]/gu, " ");
      const quoted = (cap.match(/["“«]([^"”»\n]{4,70})["”»]/) || [])[1];
      const fromLink = titleFromLink(link);
      const words = cap.replace(/[#@]\S+/g, " ").replace(/[^\p{L}\p{N}\s.,¡!¿?:'-]/gu, " ").split(/\s+/).filter(Boolean);
      const q = clean(quoted), title0 = (q.includes(" ") ? q : "") || ((fromLink.match(/\p{L}{3,}/gu) || []).length >= 2 ? fromLink : "") || words.slice(0, 8).join(" ");
      const title = title0 ? title0.charAt(0).toUpperCase() + title0.slice(1) : "";
      if (!title) continue;
      const info = parseCaption(p.caption || "", []);   // solo para adivinar barrio y tipo; el texto no se guarda
      out.push({
        id: "bs-" + p.id, src: "secreta", title: cut(title, 80), tipo: "Baires Secreta",
        cat: info.list || "actividad", zona: info.zona || "", posted: (p.posted_time || p.created_time || 0) * 1000,
        link
      });
    }
    start = posts[posts.length - 1].created_time;
  }
  const seen = new Set();
  return out.filter(x => !seen.has(x.link) && seen.add(x.link)).slice(0, 40);
}

const prev = (() => { try { return JSON.parse(fs.readFileSync("data/descubrir.json", "utf8")); } catch { return { sources:{} }; } })();
const result = { sources:{} };
for (const [name, fn] of [["turismo", turismo], ["secreta", secreta]]) {
  try { result.sources[name] = { ok:true, updated:new Date().toISOString(), items: await fn() }; console.log(name, result.sources[name].items.length); }
  catch (e) {   // si una fuente falla, se queda con lo que tenía y lo avisa
    console.error(name, e.message);
    result.sources[name] = { ...(prev.sources?.[name] || { items:[] }), ok:false, error:String(e.message).slice(0, 200) };
  }
}
const itemsOf = r => JSON.stringify(Object.fromEntries(Object.entries(r.sources || {}).map(([k, v]) => [k, v.items])));
if (itemsOf(prev) === itemsOf(result)) { console.log("sin cambios"); process.exit(0); }
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/descubrir.json", JSON.stringify(result));
