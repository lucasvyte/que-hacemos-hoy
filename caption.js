/* Lee la descripción de un reel (o lo que dicte la persona) y saca barrio, nombre del lugar,
   dirección y a qué lista va. Todo pasa en el celular: no se manda a ningún lado. */

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* barrios de CABA + zonas que aparecen seguido. Los más largos primero para que
   "Palermo Soho" gane sobre "Palermo" y "Villa Crespo" sobre nada. */
const ZONAS = [
  "Agronomía","Almagro","Balvanera","Barracas","Belgrano","Belgrano R","Boedo","Caballito","Chacarita",
  "Coghlan","Colegiales","Constitución","Flores","Floresta","La Boca","La Paternal","Liniers","Mataderos",
  "Monte Castro","Monserrat","Montserrat","Nueva Pompeya","Núñez","Palermo","Palermo Soho","Palermo Hollywood",
  "Palermo Chico","Palermo Viejo","Las Cañitas","Parque Avellaneda","Parque Chacabuco","Parque Chas",
  "Parque Patricios","Puerto Madero","Recoleta","Retiro","Saavedra","San Cristóbal","San Nicolás","San Telmo",
  "Vélez Sarsfield","Versalles","Villa Crespo","Villa del Parque","Villa Devoto","Villa General Mitre",
  "Villa Lugano","Villa Luro","Villa Ortúzar","Villa Pueyrredón","Villa Real","Villa Riachuelo",
  "Villa Santa Rita","Villa Soldati","Villa Urquiza","Microcentro","Costanera Sur","Costanera Norte",
  "Tigre","San Isidro","Vicente López","Olivos","Martínez","Acassuso","Beccar","San Fernando","Nordelta",
  "Pilar","Florida","Munro","Quilmes","Bernal","Avellaneda","Lanús","Banfield","Lomas de Zamora","Temperley",
  "Adrogué","Burzaco","Ezeiza","Canning","Ramos Mejía","Haedo","Morón","Castelar","Ituzaingó","San Justo",
  "Caseros","Ciudadela","San Martín","Villa Ballester","La Plata","City Bell","Gonnet","Luján","Escobar",
  "Zárate","Campana","Cañuelas","San Antonio de Areco","Chascomús","Mar del Plata","Pinamar","Cariló",
  "Colonia","Montevideo"
];
/* palabras comunes que solo cuentan como barrio si están escritas con mayúscula */
const AMBIGUAS = new Set(["flores","olivos","tigre","florida","colonia","campana","constitucion"]);
/* calles con nombre de barrio: "Av. Belgrano 1200" no es Belgrano */
const ANTES_CALLE = /(?:\bav(?:enida)?\.?|\bcalle|\bpasaje|\bpje\.?|\bdiagonal|\bboulevard|\bbv\.?)\s*$/i;

const PALABRAS_NO_CALLE = new Set(["desde","hasta","hace","mas","de","del","el","la","los","las","con","por","para",
  "cada","abierto","abrimos","horario","horarios","ano","anos","precio","precios","promo","combo","menu","solo","todos",
  "lunes","martes","miercoles","jueves","viernes","sabado","sabados","domingo","domingos","enero","febrero","marzo",
  "abril","mayo","junio","julio","agosto","septiembre","setiembre","octubre","noviembre","diciembre","son","somos",
  "fue","hay","top","parte","dia","dias","solo","entrada","entradas","mesa","mesas","personas","pax","nos","te","les",
  "cuesta","sale","salen","vale","valor","total","ticket","edicion","temporada","capitulo","episodio","n","no","nro"]);

const COMER = /\b(?:resto|restaurante|restaurant|bodegon|parrilla|asado|pizza|pizzeria|empanada|cafe|cafeteria|brunch|desayuno|merienda|almuerzo|cena|medialuna|helado|heladeria|burger|hamburguesa|sushi|ramen|tacos?|cerveceria|cerveza|birra|vermu|vermut|vino|vinoteca|bar|tragos?|cocteles?|panaderia|pasteleria|torta|comida|comer|menu|plato|bodega|degustacion|bife|milanesa|pasta|trattoria|bistro|food|delivery|vegan[oa]?|cocina)(?:s|es)?\b/;
const VISITAR = /\b(?:museo|parque|plaza|feria|mirador|reserva|jardin|botanico|biblioteca|iglesia|catedral|palacio|monumento|barrio|recorrido|paseo|isla|playa|cerro|cascada|laguna|estancia|pueblo|escapada|galeria|arte|exposicion|muestra|teatro|cine|libreria)(?:s|es)?\b/;
const ACTIVIDAD = /\b(?:clase|taller|curso|show|recital|concierto|fiesta|evento|kayak|bici|bicicleta|trekking|caminata|escape|bowling|karaoke|juego|juegos|spa|yoga|picnic|patin|patinaje|cine|obra|stand ?up|festival|actividad|plan)(?:s|es)?\b/;

/* ¿la zona aparece en el texto? devuelve la posición o -1 */
function findZona(text, zona){
  const t = norm(text), z = norm(zona);
  const re = new RegExp(`(^|[^a-z0-9])${z.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "g");
  let m;
  while((m = re.exec(t))){
    const at = m.index + m[1].length;
    const after = t.slice(at + z.length);
    const before = text.slice(0, at);
    if(ANTES_CALLE.test(before)) continue;                 // "Av. Belgrano"
    if(/^\s*\d{2,5}\b/.test(after)) continue;              // "Belgrano 1200"
    if(AMBIGUAS.has(z) && !/^[A-ZÁÉÍÓÚÑ]/.test(text.charAt(at))) continue;
    return at;
  }
  return -1;
}

function pickZona(text, extra){
  const all = [...new Set(ZONAS.concat(extra || []).map(s => String(s || "").trim()).filter(Boolean))];
  const pinLine = (text.match(/[📍📌][^\n]*/u) || [""])[0];
  let best = null;
  for(const z of all){
    let at = pinLine ? findZona(pinLine, z) : -1;
    const onPin = at >= 0;
    if(!onPin) at = findZona(text, z);
    if(at < 0) continue;
    // primero lo que está en la línea del 📍, después lo que aparece antes, y a igual posición el nombre más largo
    const score = [onPin ? 0 : 1, at, -z.length];
    if(!best || score[0] < best.score[0] || (score[0] === best.score[0] && (score[1] < best.score[1] || (score[1] === best.score[1] && score[2] < best.score[2]))))
      best = { zona: z, score };
  }
  if(!best) return "";
  // si la persona ya usa ese barrio en la lista, devolverlo como lo escribió ella
  const mine = (extra || []).find(e => norm(e) === norm(best.zona));
  return mine || best.zona;
}

const ADDR_RE = /((?:Av(?:enida)?\.?\s+|Calle\s+|Pje\.?\s+|Pasaje\s+|Diagonal\s+)?[A-ZÁÉÍÓÚÑ][\p{L}'´]+(?:\.(?=\s)(?<=\b\p{L}{1,4}\.))?(?:\s+(?:de|del|la|las|los|y|[A-ZÁÉÍÓÚÑ0-9][\p{L}'´]*(?:\.(?=\s)(?<=\b\p{L}{1,4}\.))?)){0,4})\s+(?:N[°º]\s*)?(\d{2,5})(?!\d|[.,]\d|[:%]|\s*(?:hs|h\b|horas|pesos|personas|pax|k\b|mil|km|mts|m2|metros|años|anos|seguidores))/gu;

function pickAddress(text){
  const lines = text.split(/\n/);
  const pin = lines.filter(l => /[📍📌]|\bdirecci[oó]n\b|\bdir\s*[:.]|\bubicad[oa]s? en\b|\bestamos en\b/iu.test(l));
  for(const src of [pin.join("\n"), text]){
    if(!src) continue;
    ADDR_RE.lastIndex = 0;
    let m;
    while((m = ADDR_RE.exec(src))){
      const street = m[1].replace(/\s+/g, " ").trim();
      const first = norm(street.split(" ")[0].replace(/\.$/, ""));
      if(PALABRAS_NO_CALLE.has(first) && !/^(av|avenida|calle|pje|pasaje|diagonal)$/.test(first)) continue;
      return `${street} ${m[2]}`;
    }
  }
  return "";
}

const HANDLE_COLA = /(?:[._]?(?:ok|ba|bsas|baires|arg|ar|caba|oficial|official|resto|bar|cafe|ok_|uy))+$/i;
function nameFromHandle(h){
  let s = h.replace(/^@/, "");
  const sinCola = s.replace(HANDLE_COLA, "");
  if(sinCola.length >= 3) s = sinCola;
  const words = s.split(/[._]+/).filter(Boolean);
  if(!words.length) return "";
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const titulo = s => s === s.toLowerCase() ? s.replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : s;

function pickName(text, zona, address){
  // 1) frases explícitas
  const m = text.match(/(?:se llama|el lugar es|el nombre es|lugar\s*:|nombre\s*:|local\s*:)\s*["“«]?([^\n,.;!?"”»]{2,60})/i);
  if(m) return titulo(m[1].trim());
  // 2) la línea del 📍: el primer pedazo que no sea barrio ni dirección
  const pinLine = (text.match(/[📍📌]\s*([^\n]*)/u) || [])[1];
  if(pinLine){
    for(let seg of pinLine.split(/\s*(?:[,|–—·•]|\s-\s)\s*/)){
      seg = seg.replace(/^[\s:]+|[\s:]+$/g, "");
      if(seg.length < 2 || seg.length > 60) continue;
      if(/\d{2,}/.test(seg)) continue;                                  // dirección
      if(norm(seg) === norm(zona) || pickZona(seg, []) === seg) continue; // barrio
      if(/^(caba|buenos aires|bs\.? ?as\.?|argentina|gba|zona (norte|sur|oeste))$/i.test(norm(seg))) continue;
      if(seg.startsWith("@")) return nameFromHandle(seg.split(/\s/)[0]);
      if(address && norm(address).startsWith(norm(seg))) continue;
      return titulo(seg);
    }
  }
  // 3) la primera @cuenta mencionada (suele ser el lugar)
  const h = text.match(/@([A-Za-z0-9._]{3,30})/);
  if(h) return nameFromHandle(h[1]);
  return "";
}

function pickList(text){
  const t = norm(text);
  const c = (t.match(new RegExp(COMER.source, "g")) || []).length;
  const v = (t.match(new RegExp(VISITAR.source, "g")) || []).length;
  const a = (t.match(new RegExp(ACTIVIDAD.source, "g")) || []).length;
  const max = Math.max(c, v, a);
  if(!max) return "";
  if(c === max) return "comer";
  if(a === max) return "actividad";
  return "visitar";
}

/* text: lo pegado; misZonas: los barrios que ya hay en la lista */
export function parseCaption(text, misZonas){
  text = String(text || "").slice(0, 5000);
  if(!text.trim()) return { zona:"", name:"", address:"", list:"" };
  const zona = pickZona(text, misZonas);
  const address = pickAddress(text);
  const name = pickName(text, zona, address).slice(0, 120);
  return { zona, name, address, list: pickList(text) };
}
