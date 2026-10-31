/* ¿Qué hacemos hoy? — app instalable (PWA) con Firebase */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, onSnapshot, writeBatch, arrayUnion, arrayRemove,
  deleteField, query, where }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { parseCaption } from "./caption.js";

const firebaseConfig = {
  apiKey: "AIzaSyBB2YeVAAisCXTyfRAPm0MIHLUPv_JP9eg",
  authDomain: "que-hacemos-hoy-59b81.firebaseapp.com",
  projectId: "que-hacemos-hoy-59b81",
  storageBucket: "que-hacemos-hoy-59b81.firebasestorage.app",
  messagingSenderId: "484182237158",
  appId: "1:484182237158:web:62d2b437e50df691e14027"
};

const VERSION = "0.21.2";
/* Avisos: dirección del servidor de avisos (worker/avisos.js en Cloudflare). Vacío = los avisos no aparecen. */
const PUSH_URL = "https://avisos.978-llv.workers.dev/";
const VAPID_PUBLIC = "BNUj_Mhm11xCQ71kQFeJQJGWNhmlROka8QDX1-XwzV2GxAR9XiLn_28GFIthtoSYvlNR7qS1oP4pnsu5rIa2yHM";
const CHANGELOG = [
  ["0.21.2","Más fácil de leer y de tocar: textos de ayuda y números con más contraste, links de las tarjetas (Cómo llegar, Ver reel) y botones chicos con más lugar para el dedo. Al agregar algo o armar un plan, el día se elige con un botón “📅 Elegir día”, como en Para descubrir."],
  ["0.21.1","Las ventanas de tus listas (cambiar, crear, sumarse) y del menú de la lista también se cierran deslizándolas para abajo."],
  ["0.21.0","Cerca tuyo: en el Mapa, “¿Qué tenemos cerca?” también muestra propuestas de Para descubrir (con ✨ en el mapa y “+ A mi lista”). En Para descubrir hay un botón “📍 Cerca” que ordena todo por distancia."],
  ["0.20.5","Calendario: lo que ya pasó no aparece en la lista de abajo (si tocás un día pasado, sí). En actividades y planes, “✕ Sacar fecha” para dejarlos sin día."],
  ["0.20.4","Calendario: en la lista de abajo cada cosa tiene su marca, punto para las actividades y triángulo para los planes."],
  ["0.20.2","Calendario más claro: cada día muestra un punto si hay actividades y un triángulo amarillo si hay un plan, sin importar cuántos sean."],
  ["0.20.1","Los filtros de zonas y actividades miden lo que dice su texto."],
  ["0.20.0","Más simple: arriba ya no está el cuadro de tipos. Abajo del buscador quedan dos filtros: “Todas las zonas” y “Actividades”, que al tocarlo te deja elegir un tipo (Para comer, Peli…) o una etiqueta (Cena, Con amigos…)."],
  ["0.19.6","Para descubrir: menos filtros, se sacó el de la fuente (Turismo BA / Baires Secreta)."],
  ["0.19.5","Para descubrir, el dado, los recuerdos y los barrios se cierran deslizándolos para abajo (tienen una rayita arriba)."],
  ["0.19.4","Para descubrir: “📅 Elegir día” vuelve a ser un botón simple; al tocarlo se abre el calendario."],
  ["0.19.3","Todo entra en la pantalla: las pestañas de tipos y los filtros ya no se deslizan de costado, se acomodan en varias filas."],
  ["0.19.2","Para descubrir: los días quedan más simples, Hoy, Mañana o elegir el día que quieras."],
  ["0.19.1","Para descubrir: elegí un día puntual (los próximos 14 o cualquier otro) para ver qué hay. Planes: si el otro cambia un plan mientras lo tenés abierto, se actualiza solo; ya no hace falta tocar Guardar para verlo, y al guardar no se pisan los cambios de los dos."],
  ["0.19.0","Todo lo que agregan es una actividad, así que la pestaña “Actividades” pasa a ser “Todas”: muestra todo junto. El tipo (Para comer, Para visitar, Música…) ahora es opcional."],
  ["0.18.1","Los ♥ también avisan: cuando alguien le pone ♥ a algo, a los demás les llega una notificación (y si les copa a los dos, te lo dice)."],
  ["0.18.0","Avisos de todo: ahora también te llega una notificación cuando alguien cambia algo de la lista, lo marca como hecho, sube una foto, escribe el recuerdo, pone su puntaje o cambia un plan."],
  ["0.17.1","Puntaje de cada uno: en un recuerdo, cada persona de la lista toca las estrellas y pone su propio puntaje, sin tener que editar nada. Se ve el de todos y el promedio."],
  ["0.16.2","Arreglo: al tocar un aviso con la app abierta en segundo plano quedaba la pantalla en negro. Ahora se abre directo en lo nuevo."],
  ["0.16.1","Los avisos ya funcionan: tocá “🔔 Activar avisos” para que te lleguen."],
  ["0.16.0","Avisos: cuando alguien suma algo o arma un plan en una lista compartida, a los demás les llega una notificación al celular. Tocándola se abre eso mismo. Se activan con “🔔 Activar avisos”."],
  ["0.15.0","Las secciones pasan abajo, como en cualquier app: Para hacer, Mapa y Calendario. Los barrios están adentro del Mapa, con “¿Qué tenemos cerca?”. Arriba aparece lo que tienen hoy y el finde, con una idea. Cada uno marca con ♥ lo que le copa, y lo que les gusta a los dos sube primero. Lo que agregás desde Para descubrir entra con su fecha al Calendario. Hechos ahora es un álbum de recuerdos por mes."],
  ["0.14.2","El botón Atrás del celular cierra lo que tengas abierto (una ventana, el reloj, Juntar ideas, otra pestaña) en vez de salir de la app."],
  ["0.14.1","Para descubrir y el dado ordenan las propuestas por día (hoy, mañana, y así), con un título por día, y ya no muestran las que pasaron."],
  ["0.14.0","Planes ahora está adentro de “Para hacer”. Con “Juntar ideas” marcás varias cosas de tu lista y se arma un plan con ellas. Arriba quedan menos pestañas."],
  ["0.13.0","Más simple: “Hechos” ahora está adentro de “Para hacer”, con un interruptor Por hacer / Hechos. Una pestaña menos arriba."],
  ["0.12.0","El dado de “¿Qué hacemos hoy?” ahora te sugiere algo al azar de lo que pasa en Buenos Aires (Turismo BA y Baires Secreta), no de lo que ya agregaron. Si te gusta, lo sumás a tu lista."],
  ["0.11.1","La pestaña “Pendientes” ahora se llama “Para hacer”."],
  ["0.11.0","Para descubrir: las propuestas de la semana de Turismo Buenos Aires y lo último de Baires Secreta, actualizadas todos los días. Las agregás a tu lista con un toque."],
  ["0.10.3","Reloj propio para elegir la hora, igual al del celular pero con todos los botones a la vista."],
  ["0.10.2","Vuelve el reloj del celular para elegir la hora."],
  ["0.10.0","Al agregar algo se puede poner día y hora (“Cuándo”). Lo que tiene día aparece en el Calendario junto con los planes, de todas tus listas."],
  ["0.9.1","Al crear un plan se elige el día y la hora juntos, arriba de todo."],
  ["0.9.0","Más categorías además de Actividades, Para comer y Para visitar: Música, Cine, Teatro, Bares y Deporte, y podés crear las tuyas con “+ Otra”."],
  ["0.8.0","Al agregar algo, barrio, ubicación y mapa están juntos en “Dónde”: buscás el lugar o pegás un link de Maps y se pone el pin y el barrio solos."],
  ["0.7.1","Cambiar el nombre de la lista es más fácil: tocás el nombre arriba y lo editás ahí mismo."],
  ["0.7.0","Calendario: todos tus planes de todas tus listas (privadas y compartidas) en un mes, con los días marcados. Tocás un plan y se abre, aunque sea de otra lista."],
  ["0.6.3","Las actualizaciones llegan apenas se publican (antes podían tardar hasta 10 minutos)."],
  ["0.6.2","La opción de lista privada ahora se llama “Mi lista”."],
  ["0.6.1","Al crear una lista nueva, viene elegida “Privada” de entrada."],
  ["0.6.0","Varias listas: cada uno puede tener su lista privada (solo la ve quien la creó) y listas compartidas con hasta 10 personas; se cambia de lista tocando el nombre arriba. Planes: elegí lugares, ordenalos como recorrido del día, miralos numerados en el mapa y abrí el camino en Google Maps."],
  ["0.5.0","Completar solo: pegá o dictá la descripción del reel y la app llena el barrio, el nombre del lugar, la lista y la ubicación si dice la dirección."],
  ["0.4.1","Más seguridad: la lista admite hasta 2 personas, solo vale el código vigente, se controlan los datos que se guardan y se verifica la librería del mapa."],
  ["0.4.0","App instalable para Android: entrar con Google, lista compartida con código de invitación, compartir reels desde Instagram, mapa con un pin por lugar y funciona sin conexión."],
  ["0.3.0","Vista Barrios, links de Instagram reconocidos y campo aparte para la ubicación en Maps."],
  ["0.2.0","Barrio o zona, etiquetas, buscador y filtros, foto y recuerdo al marcar algo como hecho, número de versión."],
  ["0.1.1","Paleta nueva: verdes, amarillo y azul."],
  ["0.1.0","Primera versión: tres listas compartidas, “¿Qué hacemos hoy?”, marcar como hecho con fecha y estrellas."]
];
const LISTS = {
  /* Nomenclatura (0.19.0): todo lo de la lista es una "actividad". "actividad" es el tipo vacío
     (sin tipo): no tiene pestaña propia, se ve en "Todas", y en las tarjetas no se muestra. */
  actividad:{label:"Otras", one:""},
  comer:{label:"Para comer", one:"Para comer"},
  visitar:{label:"Para visitar", one:"Para visitar"},
  musica:{label:"Música", one:"Música"},
  cine:{label:"Cine", one:"Cine"},
  teatro:{label:"Teatro", one:"Teatro"},
  bares:{label:"Bares", one:"Bar"},
  deporte:{label:"Deporte", one:"Deporte"}
};
const CORE = ["comer","visitar"];   // siempre visibles; las demás aparecen cuando tienen algo
/* categoría propia: se guarda como "c:Nombre" */
const catOf = k => LISTS[k] || (String(k||"").startsWith("c:") ? { label:k.slice(2), one:k.slice(2) } : LISTS.actividad);
function catKeys(...extra){
  const used = new Set(state.items.map(i=>i.list).filter(Boolean).concat(extra.filter(Boolean)));
  return Object.keys(LISTS).filter(k=>CORE.includes(k) || used.has(k))
    .concat([...used].filter(k=>!LISTS[k] && String(k).startsWith("c:")).sort((a,b)=>a.localeCompare(b,"es")));
}
const BASE_TAGS = ["Día de lluvia","Aniversario","Con amigos","Al aire libre","Romántico","Para el finde"];
const BA = [-34.6037, -58.3816];
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const MAX_MEMBERS = 10;   // tiene que coincidir con maxMembers() en firestore.rules
const state = { items:[], plans:[], lists:[], plansLoaded:false, calPlans:{}, selecting:false, sel:new Set(), calItems:{}, pendingItem:null, calMonth:"", calDay:"", pendingPlan:null, tab:"todas", view:"pend", q:"", zona:"", tag:"",
  me:null, group:null, gid:null, loaded:false, lastPick:null, share:null, installEvt:null,
  mapShowDone:false, mapHidden:new Set(), mapFitted:false, mapZona:"", near:null, findeIdea:"" };
const $ = id => document.getElementById(id);
/* pestaña "Todas" = sin filtro de tipo */
const inTab = i => state.tab==="todas" || i.list===state.tab;
const tabKeys = () => ["todas"].concat(catKeys().filter(k=>k!=="actividad"));

/* ---------- utilidades ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = u => { try{ const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; }catch{ return ""; } };
const fmtDate = ms => new Date(ms).toLocaleDateString("es-AR",{day:"numeric",month:"short",year:"numeric"});
const priceHtml = p => p ? `<span class="price" aria-label="Precio ${p} de 3">${"$".repeat(p)}<i>${"$".repeat(3-p)}</i></span>` : "";
const starsTxt = r => "★".repeat(r) + "☆".repeat(5-r);
/* puntaje de cada persona: ratings = { uid: 1..5 } (0 = lo sacó). El puntaje viejo (rating, de antes de 0.17.0)
   cuenta como de quien lo agregó, hasta que esa persona ponga el suyo. */
function ratingsOf(i){
  const r = {};
  if(i.rating > 0){ const o = i.createdBy || "_"; if(!(i.ratings && o in i.ratings)) r[o] = i.rating; }
  for(const [u,n] of Object.entries(i.ratings || {})) if(n > 0) r[u] = n;
  return r;
}
function avgRating(i){ const v = Object.values(ratingsOf(i)); return v.length ? v.reduce((a,b)=>a+b,0) / v.length : 0; }
const myRating = i => ratingsOf(i)[state.me?.uid] || 0;
/* "★★★★☆ 4,5 · 2" para mostrar el promedio */
function avgHtml(i, small){
  const v = Object.values(ratingsOf(i)); if(!v.length) return "";
  const a = avgRating(i), n = Math.round(a);
  return `<span class="stars" aria-label="Promedio ${a.toFixed(1).replace(".",",")} de 5${v.length>1?`, ${v.length} puntajes`:""}">${small ? "★".repeat(n) : starsTxt(n)}</span>${v.length>1 ? `<span class="rcount"> ${a.toFixed(1).replace(".",",")} · ${v.length}</span>` : ""}`;
}
function rateItem(i, n){
  const uid = state.me.uid;
  i.ratings = { ...(i.ratings || {}), [uid]: n };
  store.save(i.id, { ratings: { [uid]: n } });
  notifySoon(state.gid, "item", { ...i }, "rate");
}
const initial = n => (n || "?").trim().charAt(0).toUpperCase() || "?";
const norm = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
const tagsOf = i => Array.isArray(i.tags) ? i.tags : [];
const hasLoc = i => typeof i.lat === "number" && typeof i.lng === "number";
const hostOf = u => { try{ return new URL(u).hostname.replace(/^www\./,""); }catch{ return ""; } };
const isIG = u => /(^|\.)instagram\.com$/.test(hostOf(u)) || hostOf(u)==="instagr.am";
const isMaps = u => { const h = hostOf(u); return h==="maps.app.goo.gl" || h==="goo.gl" || (/(^|\.)google\.[a-z.]+$/.test(h) && /\/maps/.test(u)) || /^maps\.google\./.test(h); };
const EXTRA_COLORS = ["#8E5BB5","#C2477E","#3A9C9C","#B8862B","#5B6FC2","#7A8B3A"];
const listColor = k => {
  const v = LISTS[k] ? getComputedStyle(document.documentElement).getPropertyValue("--c-"+k).trim() : "";
  if(v) return v;
  let h = 0; for(const c of String(k||"")) h = (h*31 + c.charCodeAt(0)) >>> 0;
  return EXTRA_COLORS[h % EXTRA_COLORS.length];
};
const PIN = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`;
const IGICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M10 8.5v7l6-3.5z" fill="currentColor" stroke="none"/></svg>`;
const CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="M5 12l5 5L19 7"/></svg>`;

function uniq(values){
  const m = new Map();
  values.forEach(v=>{ const t = String(v||"").trim(); if(t && !m.has(norm(t))) m.set(norm(t), t); });
  return [...m.values()].sort((a,b)=>a.localeCompare(b,"es"));
}
const allZonas = () => uniq(state.items.map(i=>i.zona));
const allTags = () => uniq(BASE_TAGS.concat(...state.items.map(tagsOf)));
function linksOf(i){
  let link = safeUrl(i.link), maps = safeUrl(i.maps);
  if(link && !maps && isMaps(link)){ maps = link; link = ""; }
  return {link, maps};
}
function linksHtml(i){
  const {link, maps} = linksOf(i), out = [];
  if(link) out.push(isIG(link)
    ? `<a class="iglink" href="${esc(link)}" target="_blank" rel="noopener">${IGICON}${/\/(reel|reels|tv)\//.test(link)?"Ver reel":"Ver en Instagram"} ↗</a>`
    : `<a href="${esc(link)}" target="_blank" rel="noopener">Abrir link ↗</a>`);
  if(maps) out.push(`<a href="${esc(maps)}" target="_blank" rel="noopener">Ver en Maps ↗</a>`);
  else if(hasLoc(i)) out.push(`<a href="https://www.google.com/maps/search/?api=1&query=${i.lat},${i.lng}" target="_blank" rel="noopener">Cómo llegar ↗</a>`);
  return out.join("");
}
/* coordenadas dentro de un link largo de Google Maps */
function coordsFromUrl(u){
  const s = decodeURIComponent(String(u||""));
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if(!m) return null;
  const lat = +m[1], lng = +m[2];
  return Math.abs(lat)<=90 && Math.abs(lng)<=180 ? {lat, lng} : null;
}
function toast(msg){ const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(()=>t.hidden=true, 3200); }
function show(view){ ["vLoading","vLogin","vGroup","vMain"].forEach(v=>$(v).hidden = v!==view); $("addBtn").hidden = $("bnav").hidden = view!=="vMain"; }
function genCode(){ const a = new Uint32Array(6); crypto.getRandomValues(a); return [...a].map(n=>CODE_CHARS[n % CODE_CHARS.length]).join(""); }

/* lo que llega desde "Compartir" de otra app (Instagram manda el link en "text" o "url") */
function readShare(){
  const p = new URLSearchParams(location.search);
  if(!p.has("url") && !p.has("text") && !p.has("title")) return null;
  const raw = [p.get("url"), p.get("text"), p.get("title")].filter(Boolean).join(" ");
  const m = raw.match(/https?:\/\/[^\s]+/);
  const url = m ? safeUrl(m[0]) : "";
  let text = (p.get("text")||"").replace(/https?:\/\/[^\s]+/g,"").trim();
  const title = (p.get("title")||"").trim();
  return { url, text, title: title && !/^https?:/.test(title) ? title : "" };
}

/* ---------- capa de datos: Firebase o demo local ---------- */
const DEMO_MODE = location.hash === "#demo";
let store;

function firebaseStore(){
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  let fs;
  try{ fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch{ fs = getFirestore(app); }
  let unsubItems = null, unsubGroup = null, unsubPlans = null;
  const itemsPath = (gid = state.gid) => `groups/${gid}/items`;
  const plansPath = () => `groups/${state.gid}/plans`;
  const report = e => { console.error(e); toast(e && e.code==="permission-denied" ? "No tenés permiso para cambiar esta lista." : "No se pudo guardar. Se reintenta cuando vuelva la conexión."); };
  return {
    start(onUser){
      getRedirectResult(auth).catch(e=>loginError(e));
      onAuthStateChanged(auth, u => onUser(u ? { uid:u.uid, name:u.displayName||"", photo:u.photoURL||"" } : null));
    },
    async login(){
      const prov = new GoogleAuthProvider();
      prov.setCustomParameters({ prompt:"select_account" });
      try{ await signInWithPopup(auth, prov); }
      catch(e){
        if(["auth/popup-blocked","auth/operation-not-supported-in-this-environment","auth/cancelled-popup-request"].includes(e.code)) return signInWithRedirect(auth, prov);
        if(e.code !== "auth/popup-closed-by-user") throw e;
      }
    },
    logout(){ this.stop(); return signOut(auth); },
    stop(){ [unsubItems, unsubGroup, unsubPlans].forEach(u=>u && u()); unsubItems = unsubGroup = unsubPlans = null; },
    async myGroupId(){ const s = await getDoc(doc(fs, "users", state.me.uid)); return s.exists() ? (s.data().groupId || null) : null; },
    async myLists(){
      const s = await getDocs(query(collection(fs, "groups"), where("members", "array-contains", state.me.uid)));
      return s.docs.map(d=>({ id:d.id, ...d.data() }));
    },
    setCurrent(gid){ setDoc(doc(fs, "users", state.me.uid), { groupId:gid }).catch(()=>{}); },
    async createGroup(name, priv){
      const gref = doc(collection(fs, "groups"));
      const code = priv ? "" : genCode();
      const b = writeBatch(fs);
      b.set(gref, { name, members:[state.me.uid], memberInfo:{ [state.me.uid]:{ name:state.me.name, photo:state.me.photo } }, inviteCode:code, private:!!priv, createdAt:Date.now() });
      if(code) b.set(doc(fs, "invites", code), { groupId:gref.id });
      b.set(doc(fs, "users", state.me.uid), { groupId:gref.id });
      await b.commit();
      return gref.id;
    },
    async joinGroup(code){
      const inv = await getDoc(doc(fs, "invites", code));
      if(!inv.exists()) throw { code:"not-found" };
      const gid = inv.data().groupId;
      if(state.lists.some(l=>l.id===gid)) return gid;   // ya estaba en esa lista
      try{
        await updateDoc(doc(fs, "groups", gid), { members:arrayUnion(state.me.uid), ["memberInfo."+state.me.uid]:{ name:state.me.name, photo:state.me.photo }, lastJoinCode:code });
      }catch(e){ if(e && e.code==="permission-denied") throw { code:"full" }; throw e; }
      await setDoc(doc(fs, "users", state.me.uid), { groupId:gid });
      return gid;
    },
    rename(name){ return updateDoc(doc(fs, "groups", state.gid), { name }); },
    async makeShared(){
      const code = genCode(), b = writeBatch(fs);
      b.update(doc(fs, "groups", state.gid), { private:false, inviteCode:code });
      b.set(doc(fs, "invites", code), { groupId:state.gid });
      await b.commit();
    },
    async makePrivate(){
      const old = state.group.inviteCode, b = writeBatch(fs);
      b.update(doc(fs, "groups", state.gid), { private:true, inviteCode:"" });
      if(old) b.delete(doc(fs, "invites", old));
      await b.commit();
    },
    async leave(){
      // antes de irse, deja de recibir avisos de esta lista
      try{ const s = await getDocs(collection(fs, `groups/${state.gid}/push`)); await Promise.all(s.docs.filter(d=>d.data().uid===state.me.uid).map(d=>deleteDoc(d.ref))); }catch(e){ console.error(e); }
      return updateDoc(doc(fs, "groups", state.gid), { members:arrayRemove(state.me.uid), ["memberInfo."+state.me.uid]:deleteField() });
    },
    async deleteGroup(){
      const gid = state.gid, code = state.group && state.group.inviteCode;
      const refs = [];
      for(const sub of ["items", "plans", "photos", "push"]){
        const s = await getDocs(collection(fs, `groups/${gid}/${sub}`));
        s.docs.forEach(d=>refs.push(d.ref));
      }
      this.stop();
      for(let n=0; n<refs.length; n+=400){
        const b = writeBatch(fs); refs.slice(n, n+400).forEach(r=>b.delete(r)); await b.commit();
      }
      const b = writeBatch(fs);
      b.delete(doc(fs, "groups", gid));
      if(code) b.delete(doc(fs, "invites", code));
      await b.commit();
    },
    async newCode(){
      const old = state.group.inviteCode, code = genCode();
      const b = writeBatch(fs);
      b.update(doc(fs, "groups", state.gid), { inviteCode:code });
      b.set(doc(fs, "invites", code), { groupId:state.gid });
      if(old) b.delete(doc(fs, "invites", old));
      await b.commit();
    },
    watch(gid, onGroup, onItems, onPlans, onError){
      this.stop();
      unsubGroup = onSnapshot(doc(fs, "groups", gid), s => onGroup(s.exists() ? s.data() : null), onError);
      unsubItems = onSnapshot(collection(fs, `groups/${gid}/items`), s => onItems(s.docs.map(d=>({ id:d.id, ...d.data() }))), onError);
      unsubPlans = onSnapshot(collection(fs, `groups/${gid}/plans`), s => onPlans(s.docs.map(d=>({ id:d.id, ...d.data() }))), e=>console.error(e));
    },
    newId(){ return doc(collection(fs, itemsPath())).id; },
    save(id, data, gid){ setDoc(doc(fs, itemsPath(gid || state.gid), id), data, { merge:true }).catch(report); },
    newPlanId(){ return doc(collection(fs, plansPath())).id; },
    watchPlansOf(gid, cb){ return onSnapshot(collection(fs, `groups/${gid}/plans`), s => cb(s.docs.map(d=>({ id:d.id, ...d.data() }))), e=>{ console.error(e); cb([]); }); },
    watchDatedOf(gid, cb){ return onSnapshot(query(collection(fs, `groups/${gid}/items`), where("date", ">", "")), s => cb(s.docs.map(d=>({ id:d.id, ...d.data() }))), e=>{ console.error(e); cb([]); }); },
    savePlan(id, data){ setDoc(doc(fs, plansPath(), id), data, { merge:true }).catch(report); },
    removePlan(id){ deleteDoc(doc(fs, plansPath(), id)).catch(report); },
    remove(id){ deleteDoc(doc(fs, itemsPath(), id)).catch(report); deleteDoc(doc(fs, `groups/${state.gid}/photos`, id)).catch(()=>{}); },
    async getPhoto(id){ const s = await getDoc(doc(fs, `groups/${state.gid}/photos`, id)); return s.exists() ? s.data().data : ""; },
    setPhoto(id, data){ return setDoc(doc(fs, `groups/${state.gid}/photos`, id), { data }); },
    delPhoto(id){ deleteDoc(doc(fs, `groups/${state.gid}/photos`, id)).catch(()=>{}); },
    // avisos: a qué celulares avisar en cada lista (groups/{gid}/push/{uid_xxxx})
    async pushSubs(gid){ const s = await getDocs(collection(fs, `groups/${gid}/push`)); return s.docs.map(d=>({ id:d.id, ...d.data() })); },
    setPush(gid, id, data){ return setDoc(doc(fs, `groups/${gid}/push`, id), data); },
    delPush(gid, id){ return deleteDoc(doc(fs, `groups/${gid}/push`, id)); },
    idToken(){ return auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(""); }
  };
}

function demoStore(){
  const photos = new Map();
  let items = [
    { id:"d1", list:"comer", title:"Ejemplo: pizzería de barrio", note:"La de muzza al molde que nos recomendaron", zona:"Almagro", tags:["Con amigos"], price:1, done:false, createdAt:Date.now()-5e8, lat:-34.6097, lng:-58.4206, likes:["ana"], date:ymd(new Date()), time:"21:00" },
    { id:"d2", list:"actividad", title:"Ejemplo: picnic en los bosques", note:"Llevar mate y manta", zona:"Palermo", tags:["Al aire libre","Para el finde"], price:1, done:false, createdAt:Date.now()-4e8, link:"https://www.instagram.com/reel/EJEMPLO/", lat:-34.5711, lng:-58.4170, likes:["demo","ana"] },
    { id:"d5", list:"comer", title:"Ejemplo: heladería artesanal", zona:"Palermo", tags:[], price:1, done:false, createdAt:Date.now()-2e8, lat:-34.5880, lng:-58.4300, likes:["demo"] },
    { id:"d6", list:"comer", title:"Ejemplo: parrilla de barrio", zona:"San Telmo", tags:[], price:2, done:true, rating:5, ratings:{ ana:4 }, doneAt:Date.now()-3e9, memory:"La mejor provoleta.", createdAt:Date.now()-9e9, lat:-34.6212, lng:-58.3731 },
    { id:"d3", list:"visitar", title:"Ejemplo: un museo nuevo", zona:"Recoleta", tags:["Día de lluvia"], price:2, done:true, rating:4, doneAt:Date.now()-2e8, memory:"Nos quedamos dos horas en la sala de arriba.", createdAt:Date.now()-9e8, lat:-34.5837, lng:-58.3931 },
    { id:"d4", list:"comer", title:"Ejemplo: café de especialidad", zona:"Palermo", tags:[], price:2, done:false, createdAt:Date.now()-3e8 }
  ];
  const me = { name:"Demo" }, ana = { name:"Ana" };
  const groups = {
    demo:{ name:"Lista de prueba", members:["demo","ana"], memberInfo:{ demo:me, ana }, inviteCode:"DEMO42", private:false },
    mia:{ name:"Mi lista", members:["demo"], memberInfo:{ demo:me }, inviteCode:"", private:true }
  };
  const data = { demo:{ items, plans:[{ id:"p1", title:"Ejemplo: sábado en Palermo", date:ymd(new Date(Date.now()+2*864e5)), stops:["d4","d2"], note:"Café y después picnic", createdAt:Date.now()-1e8, updatedAt:Date.now()-1e8 }] },
    mia:{ items:[{ id:"m1", list:"visitar", title:"Ejemplo: algo solo para mí", zona:"San Telmo", tags:[], price:0, done:false, createdAt:Date.now()-1e8 }], plans:[{ id:"p2", title:"Ejemplo: museo a solas", date:ymd(new Date(Date.now()+5*864e5)), stops:["m1"], note:"", updatedAt:Date.now() }] } };
  let cur = "demo", onItems = ()=>{}, onPlans = ()=>{}, onGroup = ()=>{};
  const D = (gid = cur) => data[gid] || (data[gid] = { items:[], plans:[] });
  const emit = ()=>{ if(!groups[cur]) return; onGroup({ ...groups[cur] }); onItems(D().items.map(i=>({...i}))); onPlans(D().plans.map(p=>({...p, stops:[...p.stops]}))); };
  const put = (arr, id, d)=>{ const i = arr.findIndex(x=>x.id===id); if(i>=0) arr[i] = {...arr[i], ...d, ...(d.ratings ? { ratings:{ ...(arr[i].ratings||{}), ...d.ratings } } : {})}; else arr.push({ id, ...d }); };
  return {
    start(onUser){ setTimeout(()=>onUser({ uid:"demo", name:"Demo", photo:"" }), 200); },
    async login(){}, async logout(){ location.hash=""; location.reload(); }, stop(){},
    async myGroupId(){ return cur; },
    async myLists(){ return Object.entries(groups).map(([id,g])=>({ id, ...g })); },
    setCurrent(gid){ cur = gid; },
    async createGroup(name, priv){ const id = "g"+Math.random().toString(36).slice(2,7); groups[id] = { name, members:["demo"], memberInfo:{ demo:me }, inviteCode: priv ? "" : genCode(), private:!!priv }; cur = id; return id; },
    async joinGroup(){ throw { code:"not-found" }; },
    async newCode(){ groups[cur].inviteCode = genCode(); emit(); },
    async rename(name){ groups[cur].name = name; emit(); },
    async makeShared(){ Object.assign(groups[cur], { private:false, inviteCode:genCode() }); emit(); },
    async makePrivate(){ Object.assign(groups[cur], { private:true, inviteCode:"" }); emit(); },
    async leave(){ delete groups[cur]; },
    async deleteGroup(){ delete groups[cur]; delete data[cur]; },
    watch(gid, og, oi, op){ cur = gid; onGroup = og; onItems = oi; onPlans = op; if(!groups[gid]) return og(null); emit(); },
    newId(){ return "d"+Math.random().toString(36).slice(2,9); },
    save(id, d, gid){ put(D(gid || cur).items, id, d); emit(); },
    remove(id){ D().items = D().items.filter(x=>x.id!==id); photos.delete(id); emit(); },
    newPlanId(){ return "p"+Math.random().toString(36).slice(2,9); },
    watchPlansOf(gid, cb){ cb(D(gid).plans.map(p=>({...p}))); return ()=>{}; },
    watchDatedOf(gid, cb){ cb(D(gid).items.filter(i=>i.date).map(i=>({...i}))); return ()=>{}; },
    savePlan(id, d){ put(D().plans, id, d); emit(); },
    removePlan(id){ D().plans = D().plans.filter(x=>x.id!==id); emit(); },
    async getPhoto(id){ return photos.get(id) || ""; },
    async setPhoto(id, data){ photos.set(id, data); },
    delPhoto(id){ photos.delete(id); },
    async pushSubs(){ return []; }, async setPush(){}, async delPush(){}, async idToken(){ return ""; }
  };
}

/* ---------- arranque y sesión ---------- */
function loginError(e){
  if(!e) return;
  const m = $("loginErr"); m.hidden = false;
  m.textContent = e.code==="auth/unauthorized-domain" ? "Esta dirección todavía no está autorizada en Firebase (Authentication → Configuración → Dominios autorizados)."
    : e.code==="auth/network-request-failed" ? "No hay conexión. Probá de nuevo cuando tengas internet."
    : "No se pudo entrar. Probá de nuevo.";
  console.error(e);
}

async function onUser(u){
  if(!u){ state.me = null; show("vLogin"); return; }
  state.me = u;
  refreshLists().then(()=>syncPush(sharedGids()));
  if(openTarget(state.openAt)){ state.openAt = null; return; }
  try{
    const gid = await store.myGroupId();
    if(gid) return enterGroup(gid);
  }catch(e){ console.error(e); }
  goToAnotherList(null);
}

async function refreshLists(){
  try{ state.lists = sortLists(await store.myLists()); }catch(e){ console.error(e); }
  return state.lists;
}
const sortLists = ls => ls.slice().sort((a,b)=>(a.private?1:0)-(b.private?1:0) || String(a.name).localeCompare(String(b.name),"es"));

/* si la lista abierta ya no está (te fuiste, la borraron), abre otra tuya o la pantalla de inicio */
async function goToAnotherList(badGid){
  if(goToAnotherList.busy) return;
  goToAnotherList.busy = true;
  store.stop();
  const lists = (await refreshLists()).filter(l=>l.id!==badGid);
  goToAnotherList.busy = false;
  state.lists = lists;
  if(lists.length){ state.view = "pend"; return enterGroup(lists[0].id); }
  state.gid = null; state.group = null; state.items = []; state.plans = [];
  $("helloName").textContent = state.me && state.me.name ? ", " + state.me.name.split(" ")[0] : "";
  show("vGroup");
}

function enterGroup(gid){
  if(state.gid !== gid){
    state.items = []; state.plans = []; state.group = null; state.zona = state.tag = state.q = ""; $("q").value = "";
    state.mapFitted = false; state.mapZona = ""; state.near = null; photoCache.clear(); banner("");
  }
  state.gid = gid; state.loaded = false; state.plansLoaded = false;
  store.setCurrent(gid);
  show("vMain"); render();
  store.watch(gid,
    g => {
      if(state.gid !== gid) return;
      if(!g || !(g.members||[]).includes(state.me.uid)){ goToAnotherList(gid); return; }
      state.group = g;
      if(isShared(g)) syncPush([gid]);
      const l = state.lists.find(x=>x.id===gid); if(l) Object.assign(l, g); else state.lists = sortLists(state.lists.concat({ id:gid, ...g }));
      renderHeader(); render();
    },
    items => { if(state.gid !== gid) return; state.items = items; state.loaded = true; render(); maybeOpenShare(); maybeOpenPendingPlan(); },
    plans => { if(state.gid !== gid) return; state.plans = plans; state.plansLoaded = true; if(planSync) planSync(); if(["pend","done","planes"].includes(state.view)) render(); maybeOpenPendingPlan(); },
    e => { console.error(e); if(state.gid !== gid) return; if(e && e.code==="permission-denied") goToAnotherList(gid); else banner("Se cortó la conexión con la lista. Volvé a abrir la app."); });
}

/* Abre el ítem o plan pendiente (desde el Calendario o un aviso). Si todavía no llegó
   (lo primero que se muestra puede ser la copia guardada en el celular, sin lo recién creado),
   lo sigue esperando unos segundos antes de rendirse. */
const PENDING_WAIT = 10000;
function maybeOpenPendingPlan(){
  const pi = state.pendingItem;
  if(pi && pi.gid === state.gid && state.loaded){
    pi.at = pi.at || Date.now();
    const it = state.items.find(x=>x.id===pi.id);
    if(it){ state.pendingItem = null; itemForm(it); }
    else if(Date.now() - pi.at > PENDING_WAIT){ state.pendingItem = null; toast("No encontré eso en la lista. Puede que lo hayan borrado."); }
    else { clearTimeout(maybeOpenPendingPlan.t); maybeOpenPendingPlan.t = setTimeout(maybeOpenPendingPlan, PENDING_WAIT + 200); }
  }
  const pp = state.pendingPlan;
  if(!pp || pp.gid !== state.gid || !state.loaded || !state.plansLoaded) return;
  pp.at = pp.at || Date.now();
  const p = state.plans.find(x=>x.id===pp.pid);
  if(p){ state.pendingPlan = null; planSheet(p); }
  else if(Date.now() - pp.at > PENDING_WAIT){ state.pendingPlan = null; toast("No encontré ese plan. Puede que lo hayan borrado."); }
  else { clearTimeout(maybeOpenPendingPlan.tp); maybeOpenPendingPlan.tp = setTimeout(maybeOpenPendingPlan, PENDING_WAIT + 200); }
}

/* ---------- avisos (notificaciones al celular) ----------
   Cada celular que activa los avisos se guarda en groups/{gid}/push de sus listas compartidas.
   Al sumar algo o crear un plan, la app le pide al servidor de avisos (PUSH_URL) que avise a los celulares de los demás. */
const PUSH_KEY = "qhh-push";   // en este celular: "on", "off" o "later" (dijo "Ahora no")
const pushPref = () => { try{ return localStorage.getItem(PUSH_KEY) || ""; }catch{ return ""; } };
const setPushPref = v => { try{ localStorage.setItem(PUSH_KEY, v); }catch{} };
const pushCapable = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const pushAvailable = () => !!(PUSH_URL || DEMO_MODE);
const pushOn = () => pushPref()==="on" && (DEMO_MODE || (pushCapable() && Notification.permission==="granted"));
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const isShared = g => !!g && !g.private;
const sharedGids = () => state.lists.filter(isShared).map(l=>l.id);
const firstName = n => String(n || "").trim().split(/\s+/)[0] || "Alguien";
function b64uBytes(s){ s = s.replace(/-/g, "+").replace(/_/g, "/"); const b = atob(s + "===".slice((s.length + 3) % 4)); return Uint8Array.from(b, c=>c.charCodeAt(0)); }
async function pushDocId(endpoint){
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)));
  return state.me.uid + "_" + [...h.slice(0, 8)].map(x=>x.toString(16).padStart(2, "0")).join("");
}
async function currentSub(create){
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if(!sub && create) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:b64uBytes(VAPID_PUBLIC) });
  return sub;
}
const pushSynced = new Set();
// anota este celular en esas listas (una vez por sesión), para que los demás le puedan avisar
async function syncPush(gids){
  if(DEMO_MODE || !pushAvailable() || !pushOn() || !state.me) return;
  gids = gids.filter(g=>g && !pushSynced.has(g)); if(!gids.length) return;
  try{
    const sub = await currentSub(true); if(!sub) return;
    const j = sub.toJSON(), id = await pushDocId(j.endpoint);
    await Promise.all(gids.map(async g=>{
      await store.setPush(g, id, { uid:state.me.uid, endpoint:j.endpoint, p256dh:j.keys.p256dh, auth:j.keys.auth, at:Date.now() });
      pushSynced.add(g);
    }));
  }catch(e){ console.error(e); }
}
async function enablePush(){
  if(DEMO_MODE){ setPushPref("on"); toast("Listo (en la demo no llegan avisos de verdad)"); return true; }
  if(!pushCapable()){ toast(isIOS ? "En iPhone, primero agregá la app a la pantalla de inicio (Compartir → Agregar a inicio) y abrila desde ahí." : "Este navegador no permite avisos."); return false; }
  let perm = Notification.permission;
  if(perm==="default") perm = await Notification.requestPermission();
  if(perm!=="granted"){ toast(perm==="denied" ? "Los avisos están bloqueados. Activalos en Ajustes del celular → Notificaciones de la app." : "No se activaron los avisos."); return false; }
  setPushPref("on");
  try{ await currentSub(true); }
  catch(e){ console.error(e); setPushPref(""); toast("No se pudieron activar los avisos. Probá de nuevo con conexión."); return false; }
  pushSynced.clear(); await syncPush(sharedGids().concat(isShared(state.group) ? [state.gid] : []));
  toast("🔔 Listo, te vamos a avisar"); return true;
}
async function disablePush(){
  setPushPref("off"); pushSynced.clear();
  if(DEMO_MODE || !pushCapable()) return;
  try{
    const sub = await currentSub(false); if(!sub) return;
    const id = await pushDocId(sub.endpoint);
    await Promise.all(state.lists.map(l=>store.delPush(l.id, id).catch(()=>{})));
    await sub.unsubscribe();
  }catch(e){ console.error(e); }
}
// kind: "item" o "plan"; obj: lo que se acaba de guardar (con su id)
// act: "new" (default), "edit", "done", "undone", "photo", "memory", "rate"
async function notifyOthers(gid, kind, obj, act = "new"){
  if(!PUSH_URL || DEMO_MODE || !state.me) return;
  const g = gid===state.gid && state.group ? state.group : state.lists.find(l=>l.id===gid);
  const members = (g && g.members) || [];
  if(!isShared(g) || members.length < 2) return;
  try{
    const subs = (await store.pushSubs(gid)).filter(s=>s.uid!==state.me.uid && members.includes(s.uid));
    if(!subs.length) return;
    const where = g.name ? ` en “${g.name}”` : "";
    const when = obj.date ? (obj.date===todayStr() ? "hoy" : fmtDay(obj.date)) + (obj.time ? " " + obj.time : "") : "";
    const n = (obj.stops||[]).length;
    const who = firstName(state.me.name), cat = obj.list ? catOf(obj.list).one : "";
    const stars = obj.ratings && obj.ratings[state.me.uid] ? "★".repeat(obj.ratings[state.me.uid]) : "";
    const mem = obj.memory ? "“" + (obj.memory.length > 70 ? obj.memory.slice(0, 68).trim() + "…" : obj.memory) + "”" : "";
    const ITEM = {
      new:    [`${who} sumó algo${where}`, [obj.title, cat, when]],
      edit:   [`${who} cambió algo${where}`, [obj.title, cat, when]],
      done:   [`${who} marcó como hecho${where}`, [obj.title, stars, obj.hasPhoto ? "con foto 📷" : ""]],
      undone: [`${who} volvió a poner por hacer${where}`, [obj.title, cat]],
      photo:  [`${who} subió una foto 📷${where}`, [obj.title, mem]],
      memory: [`${who} escribió el recuerdo${where}`, [obj.title, mem]],
      like:   [`${who} le puso ♥ a algo${where}`, [obj.title, cat, likesOf(obj).length >= 2 && (g.members||[]).every(u=>likesOf(obj).includes(u)) ? (members.length > 2 ? "¡Les copa a todos!" : "¡A los dos les copa!") : ""]],
      rate:   [`${who} puso su puntaje${where}`, [obj.title, stars || "lo sacó"]]
    };
    const [t, b] = kind==="plan"
      ? [`${who} ${act==="edit" ? "cambió el plan" : "armó un plan"}${where}`, [obj.title, when, n ? `${n} parada${n===1?"":"s"}` : ""]]
      : (ITEM[act] || ITEM.edit);
    const msg = { title:t, body:b.filter(Boolean).join(" · "),
      url: kind==="plan" ? `./?g=${gid}&p=${obj.id}` : `./?g=${gid}&i=${obj.id}`, tag:(kind==="plan" ? "plan-" : "item-") + obj.id };
    const r = await fetch(PUSH_URL, { method:"POST", headers:{ "Content-Type":"application/json", Authorization:"Bearer " + await store.idToken() },
      body:JSON.stringify({ ...msg, subs:subs.map(s=>({ id:s.id, endpoint:s.endpoint, p256dh:s.p256dh, auth:s.auth })) }) });
    if(!r.ok){ console.error("avisos:", r.status); return; }
    const { results = [] } = await r.json();
    // celulares que ya no existen (desinstalaron, sacaron el permiso): se borran
    results.filter(x=>x.status===404 || x.status===410).forEach(x=>store.delPush(gid, x.id).catch(()=>{}));
  }catch(e){ console.error(e); }
}
// para cosas que se tocan seguido (estrellas): espera unos segundos y manda solo el último
const notifyTimers = new Map();
function notifySoon(gid, kind, obj, act, ms = 4000){
  const k = gid + "/" + obj.id;
  clearTimeout(notifyTimers.get(k));
  notifyTimers.set(k, setTimeout(()=>{ notifyTimers.delete(k); notifyOthers(gid, kind, obj, act); }, ms));
}
function cancelNotify(gid, id){ const k = gid + "/" + id; clearTimeout(notifyTimers.get(k)); notifyTimers.delete(k); }
// tarjeta "¿Te avisamos?" en Por hacer (una sola vez por celular)
function renderPushAsk(show){
  const box = $("pushAsk"), g = state.group;
  const others = g && state.me ? (g.members||[]).filter(u=>u!==state.me.uid) : [];
  const can = show && state.loaded && pushAvailable() && isShared(g) && others.length && !pushPref()
    && (DEMO_MODE || isIOS || (pushCapable() && Notification.permission!=="denied"));
  if(!can){ box.hidden = true; return; }
  const who = others.length===1 ? firstName((g.memberInfo||{})[others[0]]?.name) : "alguien";
  box.hidden = false;
  box.innerHTML = `<span class="pi" aria-hidden="true">🔔</span><div class="pb"><b>¿Te avisamos?</b>
    <span>Cuando ${esc(who)} sume, cambie o marque algo como hecho, te llega una notificación al celular.</span>
    <div class="fact"><button type="button" class="linkbtn" data-pnot>Ahora no</button><button type="button" class="dadd" data-pon>Activar avisos</button></div></div>`;
}
// abrir lo que dice el aviso (?g=lista&i=ítem o &p=plan)
function readOpen(){ const p = new URLSearchParams(location.search), g = p.get("g"); return g ? { gid:g, i:p.get("i"), p:p.get("p") } : null; }
function openTarget(t){
  const ok = s => /^[\w-]{1,64}$/.test(s || "");
  if(!t || !ok(t.gid) || !state.me) return false;
  if(ok(t.i)) state.pendingItem = { gid:t.gid, id:t.i };
  else if(ok(t.p)) state.pendingPlan = { gid:t.gid, pid:t.p };
  if(!["pend","done","planes"].includes(state.view)) state.view = "pend";
  if(state.gid===t.gid){ render(); maybeOpenPendingPlan(); } else enterGroup(t.gid);
  return true;
}

/* borra un ítem y lo saca de los planes donde estaba */
function removeItem(id){
  store.remove(id);
  state.plans.filter(p=>(p.stops||[]).includes(id)).forEach(p=>store.savePlan(p.id, { stops:p.stops.filter(x=>x!==id), updatedAt:Date.now() }));
}

function maybeOpenShare(){
  if(!state.share) return;
  const s = state.share; state.share = null;
  const guessList = state.tab==="todas" ? "actividad" : state.tab;
  itemForm(null, { link:s.url, note:s.text, title:s.title, list:guessList, fromShare:true, caption:s.text });
}

function banner(msg, actionLabel, action){
  const b = $("banner");
  if(!msg){ b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = esc(msg) + (actionLabel ? ` <button type="button" class="linkbtn" id="bannerAct" style="display:inline;padding:0 0 0 6px">${esc(actionLabel)}</button>` : "");
  if(action) $("bannerAct").onclick = action;
}

/* ---------- render ---------- */
function renderHeader(){
  const g = state.group; if(!g) return;
  const info = g.memberInfo || {};
  $("menuBtn").innerHTML = (g.members||[]).slice(0,3).map(id=>{
    const m = info[id] || {};
    return `<span class="av" title="${esc(m.name||"")}">${m.photo ? `<img src="${esc(m.photo)}" alt="" referrerpolicy="no-referrer">` : esc(initial(m.name))}</span>`;
  }).join("");
}

function matches(i){
  if(state.zona && norm(i.zona)!==norm(state.zona)) return false;
  if(state.tag && !tagsOf(i).some(t=>norm(t)===norm(state.tag))) return false;
  if(state.q){
    const hay = norm([i.title, i.note, i.zona, i.memory, ...tagsOf(i)].join(" "));
    if(!norm(state.q).split(/\s+/).every(w=>hay.includes(w))) return false;
  }
  return true;
}

/* cada desplegable mide lo que dice la opción elegida (no la más larga) */
function fitSelects(box){
  box.querySelectorAll("select").forEach(sel=>{
    const m = document.createElement("span"), cs = getComputedStyle(sel);
    m.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font};letter-spacing:${cs.letterSpacing}`;
    m.textContent = sel.options[sel.selectedIndex]?.text || "";
    document.body.appendChild(m);
    sel.style.width = Math.ceil(m.getBoundingClientRect().width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 24) + "px";
    m.remove();
  });
}
function renderFilters(showDone){
  const zonas = allZonas();
  const usedTags = uniq([].concat(...state.items.map(tagsOf)));
  if(state.zona && !zonas.some(z=>norm(z)===norm(state.zona))) state.zona = "";
  if(state.tag && !usedTags.some(t=>norm(t)===norm(state.tag))) state.tag = "";
  const types = tabKeys().filter(k=>k!=="todas");
  const n = k => state.items.filter(i=>i.list===k && !!i.done===!!showDone).length;
  const actVal = state.tab!=="todas" ? "t:" + state.tab : state.tag ? "g:" + state.tag : "";
  const active = state.zona || state.tag || state.q || state.tab!=="todas";
  $("filters").innerHTML =
    (zonas.length ? `<select id="fZona" aria-label="Filtrar por zona"><option value="">Todas las zonas</option>${zonas.map(z=>`<option value="${esc(z)}" ${norm(z)===norm(state.zona)?"selected":""}>${esc(z)}</option>`).join("")}</select>` : "") +
    `<select id="fAct" aria-label="Filtrar actividades"><option value="">Actividades</option>`
      + (types.length ? `<optgroup label="Tipo">${types.map(k=>`<option value="t:${esc(k)}" ${actVal==="t:"+k?"selected":""}>${esc(catOf(k).label)} (${n(k)})</option>`).join("")}</optgroup>` : "")
      + (usedTags.length ? `<optgroup label="Etiquetas">${usedTags.map(t=>`<option value="g:${esc(t)}" ${actVal==="g:"+t?"selected":""}>${esc(t)}</option>`).join("")}</optgroup>` : "")
      + `</select>` +
    (active ? `<button type="button" class="fchip clear" id="fClear">Limpiar</button>` : "");
  $("filters").hidden = false;
  fitSelects($("filters"));
}

function itemMeta(i, opts={}){
  const by = (state.group && state.group.memberInfo && state.group.memberInfo[i.createdBy] || {}).name || "";
  return [
    opts.showList && i.list!=="actividad" ? `<span class="zone" style="font-weight:500"><span class="dot" style="background:${listColor(i.list)}"></span>${esc(catOf(i.list).label)}</span>` : "",
    i.date && !i.done ? `<span class="chip">📅 ${esc(i.date===todayStr() ? "Hoy" : fmtDay(i.date))}${i.time?" · "+esc(i.time)+" h":""}</span>` : "",
    i.zona ? `<span class="zone">${PIN}${esc(i.zona)}</span>` : "",
    priceHtml(i.price),
    ...tagsOf(i).map(t=>`<span class="tag">${esc(t)}</span>`),
    linksHtml(i),
    i.done ? `<span class="chip">Hecho ${i.doneAt?fmtDate(i.doneAt):""}</span>` : "",
    i.done ? avgHtml(i) : "",
    !opts.short && by ? `<span>Agregó ${esc(by.split(" ")[0])}</span>` : ""
  ].filter(Boolean).join("");
}

function render(){
  if(hasLayer()) ensureGuard(); else releaseGuard();
  $("ver").textContent = VERSION;
  const pend = state.items.filter(i=>!i.done).length, done = state.items.filter(i=>i.done).length;
  $("listName").textContent = state.group?.name || (state.loaded ? "Lista" : "");
  const who = !state.group ? "" : state.group.private ? "🔒 Privada · " : (state.group.members||[]).length > 1 ? `👥 ${(state.group.members||[]).length} personas · ` : "";
  $("summary").textContent = state.loaded ? `${who}${pend} por hacer · ${done} hecho${done===1?"":"s"}` : "Cargando…";
  $("addLbl").textContent = state.view==="planes" ? "Nuevo plan" : state.view==="calendario" ? "Nuevo plan" : "Agregar";

  if(state.view==="zonas") state.view = "mapa";   // Barrios ahora está adentro del Mapa
  const inParaHacer = ["pend","done","planes"].includes(state.view);
  if(state.selecting && state.view!=="pend") stopSelecting(true);
  document.querySelectorAll(".bnav [data-view]").forEach(b=>b.setAttribute("aria-pressed", b.dataset.view===state.view || (b.dataset.view==="pend" && inParaHacer)));
  const listView = state.view==="pend" || state.view==="done";
  $("heroBtn").hidden = $("discBtn").hidden = !inParaHacer;
  renderFinde(state.view==="pend" && !state.selecting);
  renderPushAsk(state.view==="pend" && !state.selecting);
  $("tools").hidden = $("list").hidden = !listView;
  $("tabs").hidden = true;   // 0.20.0: el tipo se elige en el filtro "Todas las actividades" (abajo del buscador)
  $("doneSw").hidden = !inParaHacer;
  $("juntarBtn").hidden = !(inParaHacer && state.view!=="done") || state.selecting || (state.loaded && !state.items.some(i=>!i.done));
  $("nPlans").textContent = state.plansLoaded ? state.plans.length : "";
  $("selBar").hidden = !state.selecting; $("addBtn").hidden = state.selecting || $("vMain").hidden || state.view==="planes";
  if(state.selecting){ const n = state.sel.size; $("selGo").textContent = n ? `Armar plan con ${n}` : "Elegí ideas"; $("selGo").disabled = !n; }
  document.querySelectorAll("#doneSw [data-dv]").forEach(b=>b.setAttribute("aria-pressed", b.dataset.dv===state.view));
  $("nPend").textContent = state.loaded ? pend : ""; $("nDone").textContent = state.loaded ? done : "";
  $("mapWrap").hidden = state.view!=="mapa";
  $("planes").hidden = state.view!=="planes";
  $("cal").hidden = state.view!=="calendario";
  if(state.view!=="calendario") stopCal();
  if(state.view==="mapa") return renderMap();
  if(state.view==="planes") return renderPlanes();
  if(state.view==="calendario") return renderCal();

  const showDone = state.view==="done", searching = !!state.q;
  if(!tabKeys().includes(state.tab)) state.tab = "todas";
  renderFilters(showDone);

  const album = showDone && !searching;
  const shared = (state.group?.members||[]).length > 1;
  const loved = i => shared && likesOf(i).length >= 2;
  const rows = state.items.filter(i=>inTab(i) && !!i.done===showDone && matches(i))
    .sort((a,b)=> showDone ? (b.doneAt||0)-(a.doneAt||0) : (loved(b)?1:0)-(loved(a)?1:0) || (b.createdAt||0)-(a.createdAt||0));
  const rn = $("resnote"); rn.hidden = !searching;
  if(searching) rn.textContent = `${rows.length} resultado${rows.length===1?"":"s"} en ${showDone?"hechos":"por hacer"} de esta lista`;

  const list = $("list");
  if(!state.loaded){ list.innerHTML = `<li class="empty"><b>Cargando la lista…</b>Un segundo.</li>`; return; }
  if(!rows.length){
    list.innerHTML = (state.zona || state.tag || state.q || state.tab!=="todas")
      ? `<li class="empty"><b>Nada con ese filtro</b>Probá con otra búsqueda o tocá <strong>Limpiar</strong>.</li>`
      : showDone ? `<li class="empty"><b>Todavía nada hecho acá</b>Cuando completen algo, tóquenle el círculo y queda guardado con fecha, puntaje, foto y recuerdo.</li>`
      : `<li class="empty"><b>Lista vacía</b>Tocá <strong>+ Agregar</strong> o compartí un reel desde Instagram.</li>`;
    return;
  }
  if(album){ list.innerHTML = albumHtml(rows); hydratePhotos(list); return; }
  const nLoved = showDone || searching ? 0 : rows.filter(loved).length;
  const lovedHead = (state.group?.members||[]).length===2 ? "♥ A los dos les copa" : "♥ Les copa a varios";
  list.innerHTML = rows.map((i, n)=>{
    const meta = itemMeta(i, { showList:searching || state.tab==="todas" });
    const on = state.selecting && state.sel.has(i.id);
    const head = nLoved && n===0 ? `<li class="lsec love">${lovedHead}</li>` : nLoved && n===nLoved && rows.length>nLoved ? `<li class="lsec">El resto</li>` : "";
    return head + `<li class="item ${i.done?"is-done":""} ${state.selecting?"selecting":""} ${on?"picked":""} ${n<nLoved?"loved":""}" ${state.selecting?`data-sel="${esc(i.id)}"`:""}>
      ${state.selecting
        ? `<button class="selbox" type="button" data-sel="${esc(i.id)}" aria-pressed="${on}" aria-label="${on?"Sacar del plan":"Sumar al plan"}">${on?CHECK:""}</button>`
        : `<button class="check" type="button" data-check="${esc(i.id)}" aria-label="${i.done?"Volver a por hacer":"Marcar como hecho"}">${i.done?CHECK:""}</button>`}
      <div class="body"><div class="title">${esc(i.title)}</div>${i.note?`<div class="note">${esc(i.note)}</div>`:""}${meta?`<div class="meta">${meta}</div>`:""}
        ${i.done && i.memory ? `<div class="memory">${esc(i.memory)}</div>` : ""}
        ${i.done && i.hasPhoto ? `<button type="button" class="thumb" data-photo="${esc(i.id)}" aria-label="Ver foto"><img data-ph="${esc(i.id)}" alt="Foto de ${esc(i.title)}"></button>` : ""}
      </div>
      ${state.selecting ? "" : `<div class="side"><button class="more" type="button" data-edit="${esc(i.id)}" aria-label="Editar">⋯</button>${shared && !i.done ? heartHtml(i) : ""}</div>`}
    </li>`;
  }).join("");
  hydratePhotos(list);
}

/* ---------- ganas: cada uno marca con ♥ lo que le copa ---------- */
const likesOf = i => Array.isArray(i.likes) ? i.likes.filter(u=>(state.group?.members||[]).includes(u)) : [];
function heartHtml(i){
  const lk = likesOf(i), mine = lk.includes(state.me?.uid), info = state.group?.memberInfo || {};
  const who = lk.map(u=>u===state.me?.uid ? "vos" : (info[u]?.name||"").split(" ")[0]).filter(Boolean).join(" y ");
  return `<button type="button" class="heart ${mine?"on":""}" data-like="${esc(i.id)}" aria-pressed="${mine}" aria-label="${mine?"Sacar mi ♥":"Me copa"}${who?` (les copa a ${esc(who)})`:""}">${mine?"♥":"♡"}${lk.length?`<span class="hav">${lk.map(u=>`<i>${esc(initial(u===state.me?.uid ? state.me.name : info[u]?.name))}</i>`).join("")}</span>`:""}</button>`;
}
function toggleLike(id){
  const it = state.items.find(x=>x.id===id); if(!it || !state.me) return;
  const cur = Array.isArray(it.likes) ? it.likes : [], me = state.me.uid;
  const likes = cur.includes(me) ? cur.filter(u=>u!==me) : cur.concat(me);
  it.likes = likes; store.save(id, { likes }); render();
  // avisa solo al poner ♥ (si lo saca enseguida, no avisa)
  if(likes.includes(me)) notifySoon(state.gid, "item", { ...it }, "like");
  else cancelNotify(state.gid, id);
}

/* ---------- recuerdos: Hechos como álbum, por mes ---------- */
function albumHtml(rows){
  const months = new Map();
  rows.forEach(i=>{
    const d = new Date(i.doneAt || i.createdAt || Date.now());
    const k = d.getFullYear()*100 + d.getMonth();
    if(!months.has(k)) months.set(k, { label:d.toLocaleDateString("es-AR",{ month:"long", year:"numeric" }).replace(/^./, c=>c.toUpperCase()).replace(" de ", " "), items:[] });
    months.get(k).items.push(i);
  });
  return [...months.values()].map(m=>`<li class="lsec">${esc(m.label)} · ${m.items.length}</li><li class="alb">${m.items.map(i=>`
    <button type="button" class="acard" data-mem="${esc(i.id)}">
      <span class="aimg" style="--cc:${listColor(i.list)}">${i.hasPhoto ? `<img data-ph="${esc(i.id)}" alt="">` : ""}<span class="acat">${esc(catOf(i.list).one)}</span></span>
      <span class="at">${esc(i.title)}</span>
      <span class="as">${avgRating(i) ? avgHtml(i, true) + " " : ""}${i.doneAt ? esc(new Date(i.doneAt).toLocaleDateString("es-AR",{ day:"numeric", month:"short" })) : ""}${i.zona ? " · " + esc(i.zona) : ""}</span>
    </button>`).join("")}</li>`).join("");
}

/* ---------- hoy y el finde: lo que ya tienen con fecha + una idea de Para descubrir ---------- */
function findeDays(){
  const t = todayStr(), days = [t];
  weekendDays().forEach(d=>{ const k = ymd(d); if(!days.includes(k)) days.push(k); });
  return days;
}
function findeIdea(){
  const pool = discItems().filter(d=>discMatchesWhen(d, "finde") && !inMyList(d));
  if(!pool.length) return null;
  let d = pool.find(x=>x.id===state.findeIdea);
  if(!d){ d = pool[Math.floor(Math.random()*pool.length)]; state.findeIdea = d.id; }
  return d;
}
function renderFinde(show){
  const box = $("finde");
  if(!show || !state.loaded){ box.hidden = true; return; }
  const days = findeDays(), t = todayStr();
  const dayLbl = d => d===t ? "Hoy" : new Date(d+"T12:00:00").toLocaleDateString("es-AR",{ weekday:"short" }).replace(".","").replace(/^./, c=>c.toUpperCase());
  const rows = state.items.filter(i=>!i.done && i.date && days.includes(i.date)).map(i=>({ k:i.date+(i.time||"99"), d:i.date, time:i.time, title:i.title, attr:`data-fitem="${esc(i.id)}"`, ic:"📅" }))
    .concat(state.plans.filter(p=>p.date && days.includes(p.date)).map(p=>({ k:p.date+(p.time||"99"), d:p.date, time:p.time, title:p.title, attr:`data-fplan="${esc(p.id)}"`, ic:"🧭" })))
    .sort((a,b)=>a.k.localeCompare(b.k));
  const idea = findeIdea();
  if(!rows.length && !idea){ box.hidden = true; return; }
  const wd = new Date().getDay(), title = [5,6,0].includes(wd) ? "Este finde" : "Hoy y el finde";
  const ideaDay = idea ? (weekendDays().find(x=>occursOn(idea, x))) : null;
  box.hidden = false;
  box.innerHTML = `<div class="fh"><b>${title}</b>${rows.length ? `<span>${rows.length} agendado${rows.length===1?"":"s"}</span>` : ""}</div>
    ${rows.length ? rows.slice(0, 5).map(r=>`<button type="button" class="frow" ${r.attr}><span aria-hidden="true">${r.ic}</span><span class="fd">${esc(dayLbl(r.d))}${r.time?" "+esc(r.time):""}</span><span class="ft">${esc(r.title)}</span></button>`).join("")
      + (rows.length>5 ? `<span class="hint">y ${rows.length-5} más en el Calendario</span>` : "")
      : `<span class="hint">Nada agendado todavía. Poné día a algo de la lista o armá un plan.</span>`}
    ${idea ? `<div class="fidea"><span class="fk">💡 Idea${ideaDay ? " · " + esc(dayLbl(ymd(ideaDay))) : ""}${idea.free ? " · gratis" : ""}</span>
      <a href="${esc(safeUrl(idea.link))}" target="_blank" rel="noopener">${esc(idea.title)}</a>
      <div class="fact"><button type="button" class="linkbtn" data-fother>Otra</button><button type="button" class="dadd" data-fadd>+ A mi lista</button></div></div>` : ""}`;
}

const photoCache = new Map();
const hidePh = img => { const t = img.closest(".thumb"); if(t) t.hidden = true; else img.remove(); };
function hydratePhotos(root){
  root.querySelectorAll("img[data-ph]").forEach(async img=>{
    const id = img.dataset.ph;
    try{
      if(!photoCache.has(id)) photoCache.set(id, store.getPhoto(id));
      const src = await photoCache.get(id);
      if(src) img.src = src; else hidePh(img);
    }catch{ photoCache.delete(id); hidePh(img); }
  });
}

/* ---------- barrios ---------- */
const NOZONA = "__sin__";
function zonaGroups(){
  const g = new Map();
  state.items.forEach(i=>{
    const k = i.zona && i.zona.trim() ? norm(i.zona) : NOZONA;
    if(!g.has(k)) g.set(k, { key:k, name: k===NOZONA ? "Sin barrio" : i.zona.trim(), items:[] });
    g.get(k).items.push(i);
  });
  return [...g.values()].sort((a,b)=>{
    if(a.key===NOZONA) return 1; if(b.key===NOZONA) return -1;
    return b.items.filter(i=>!i.done).length - a.items.filter(i=>!i.done).length || a.name.localeCompare(b.name,"es");
  });
}
function zonaSheet(key){
  let showDone = false;
  const draw = ()=>{
    const g = zonaGroups().find(x=>x.key===key);
    if(!g){ closeSheet(); return; }
    const rows = g.items.filter(i=>!!i.done===showDone).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const secs = catKeys().map(k=>[k, catOf(k)]).map(([k,v])=>{
      const r = rows.filter(i=>i.list===k);
      if(!r.length) return "";
      return `<div class="sec">${v.label}</div>` + r.map(i=>{
        const meta = itemMeta(i, { short:true });
        return `<div class="mini ${i.done?"is-done":""}"><button type="button" class="linkbtn" style="color:var(--ink);padding:0" data-zedit="${esc(i.id)}"><span class="title">${esc(i.title)}</span></button>${i.note?`<div class="note">${esc(i.note)}</div>`:""}${meta?`<div class="meta">${meta}</div>`:""}</div>`;
      }).join("");
    }).join("");
    const nDone = g.items.filter(i=>i.done).length;
    openSheet(`
      <i class="grab" aria-hidden="true"></i><h2>${esc(g.name)}</h2>
      <div class="pills"><button type="button" class="pill" id="zP" aria-pressed="${!showDone}">Por hacer</button><button type="button" class="pill" id="zD" aria-pressed="${showDone}">Hechos (${nDone})</button></div>
      ${secs || `<div class="empty"><b>${showDone?"Nada hecho todavía":"Nada por hacer"}</b></div>`}
      <div class="row"><button type="button" class="btn ghost" id="zClose">Cerrar</button><button type="button" class="btn primary" id="zAdd">+ Agregar${g.key===NOZONA?"":" en "+esc(g.name)}</button></div>`);
    $("zP").onclick = ()=>{ showDone=false; draw(); };
    $("zD").onclick = ()=>{ showDone=true; draw(); };
    $("zClose").onclick = closeSheet;
    $("zAdd").onclick = ()=>itemForm(null, { zona: g.key===NOZONA ? "" : g.name });
    $("sheet").querySelectorAll("[data-zedit]").forEach(b=>b.onclick=()=>{ const it = state.items.find(x=>x.id===b.dataset.zedit); if(it) itemForm(it); });
  };
  draw();
}

/* ---------- mapa ---------- */
let bigMap = null, bigLayer = null;
function tiles(){ return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }); }
function marker(i){
  return L.circleMarker([i.lat, i.lng], { radius:i.done?7:10, color:"#ffffff", weight:2.5, fillColor:listColor(i.list), fillOpacity:i.done?.55:1 });
}
const zkey = i => i.zona && i.zona.trim() ? norm(i.zona) : NOZONA;
const distM = (a, b) => { const R = 6371e3, r = x=>x*Math.PI/180, dLa = r(b.lat-a.lat), dLo = r(b.lng-a.lng);
  const h = Math.sin(dLa/2)**2 + Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };
const NEAR_M = 5000;   // "cerca" = a menos de 5 km
const fmtDist = m => m < 1000 ? `${Math.max(50, Math.round(m/50)*50)} m` : `${(m/1000).toFixed(1).replace(".", ",")} km`;
function findNear(){
  if(!navigator.geolocation) return toast("Este celular no comparte la ubicación.");
  $("nearBtn").textContent = "Buscando dónde estás…";
  navigator.geolocation.getCurrentPosition(p=>{
    state.near = { lat:p.coords.latitude, lng:p.coords.longitude, at:Date.now() }; state.mapZona = ""; state.mapFitted = true;
    renderMap(); if(bigMap) bigMap.setView([state.near.lat, state.near.lng], 14);
    $("nearBox").scrollIntoView({ block:"nearest", behavior:"smooth" });
  }, ()=>{ toast("No pude saber dónde estás. Revisá el permiso de ubicación."); renderMap(); }, { enableHighAccuracy:true, timeout:12000, maximumAge:60000 });
}
/* propuestas de Para descubrir (solo las que tienen dirección) que todavía no pasaron, ordenadas por distancia */
function discNear(me, maxM){
  return discItems().filter(d=>typeof d.lat==="number" && typeof d.lng==="number" && nextDate(d) !== false)
    .map(d=>({ d, m:distM(me, d) })).filter(x=>x.m <= maxM).sort((a,b)=>a.m-b.m);
}
const discWhenShort = d => { const nd = nextDate(d); return nd ? (ymd(nd)===todayStr() ? "hoy" : fmtDay(ymd(nd))) : ""; };
/* pide la ubicación (o usa la última si es de hace menos de 5 minutos) */
function getHere(){
  if(state.near && Date.now() - (state.near.at||0) < 300000) return Promise.resolve(state.near);
  if(!navigator.geolocation) return Promise.reject(new Error("geo"));
  return new Promise((ok, no)=>navigator.geolocation.getCurrentPosition(p=>ok({ lat:p.coords.latitude, lng:p.coords.longitude, at:Date.now() }), no,
    { enableHighAccuracy:true, timeout:12000, maximumAge:60000 }));
}
function renderNear(){
  const box = $("nearBox"), me = state.near;
  $("nearBtn").textContent = "📍 ¿Qué tenemos cerca?";
  $("nearBtn").hidden = !!me;
  if(!me){ box.hidden = true; return; }
  const close = state.items.filter(i=>!i.done && hasLoc(i) && !state.mapHidden.has(i.list))
    .map(i=>({ i, d:distM(me, i) })).filter(x=>x.d <= 5000).sort((a,b)=>a.d-b.d).slice(0, 6);
  const disc = discNear(me, 5000).slice(0, 6);
  box.hidden = false;
  box.innerHTML = `<div class="fh"><b>Cerca tuyo</b><button type="button" class="linkbtn" data-nearoff>Cerrar</button></div>`
    + `<div class="sec">De tu lista</div>`
    + (close.length ? close.map(({ i, d })=>`<button type="button" class="frow" data-near="${esc(i.id)}"><span class="dot" style="background:${listColor(i.list)}"></span><span class="ft">${esc(i.title)}<small>${esc([catOf(i.list).one, i.zona].filter(Boolean).join(" · "))}</small></span><span class="fd">${fmtDist(d)}</span></button>`).join("")
      : `<span class="hint">No tienen nada por hacer a menos de 5 km.</span>`)
    + `<div class="sec">✨ Para descubrir</div>`
    + (disc.length ? disc.map(({ d, m })=>`<div class="frow"><span class="dot" style="background:${listColor(d.cat)}"></span><span class="ft"><a href="${esc(safeUrl(d.link))}" target="_blank" rel="noopener">${esc(d.title)}</a><small>${esc([d.tipo, d.free ? "Gratis" : "", discWhenShort(d)].filter(Boolean).join(" · "))}</small></span><span class="fd">${fmtDist(m)}<br>${inMyList(d) ? `<span class="hint">✓ En tu lista</span>` : `<button type="button" class="linkbtn" data-neardisc="${esc(d.id)}">+ A mi lista</button>`}</span></div>`).join("")
      : `<span class="hint">${discData ? "No hay propuestas a menos de 5 km." : "Cargando propuestas…"}</span>`);
  if(!discData) loadDisc().then(()=>{ if(state.near && state.view==="mapa") renderNear(); });
}
function renderMap(){
  const zg = zonaGroups().map(g=>({ ...g, n:g.items.filter(i=>state.mapShowDone || !i.done).length })).filter(g=>g.n);
  if(state.mapZona && !zg.some(g=>g.key===state.mapZona)) state.mapZona = "";
  $("zonaChips").hidden = !zg.length;
  $("zonaChips").innerHTML = `<button type="button" class="fchip" data-mz="" aria-pressed="${!state.mapZona}">Todos los barrios</button>`
    + zg.map(g=>`<button type="button" class="fchip" data-mz="${esc(g.key)}" aria-pressed="${state.mapZona===g.key}">${esc(g.name)} <b>${g.n}</b></button>`).join("");
  renderNear();
  $("mapFilters").innerHTML =
    catKeys().filter(k=>state.items.some(i=>i.list===k && hasLoc(i)) || CORE.includes(k)).map(k=>`<button type="button" class="pill" data-ml="${esc(k)}" aria-pressed="${!state.mapHidden.has(k)}"><span class="dot" style="background:${listColor(k)}"></span>${esc(catOf(k).label)}</button>`).join("") +
    `<button type="button" class="pill" id="mlDone" aria-pressed="${state.mapShowDone}">Incluir hechos</button>`;
  if(!window.L){ $("mapNote").textContent = "El mapa necesita conexión a internet para cargar."; return; }
  if(!bigMap){
    bigMap = L.map("map", { zoomControl:true, attributionControl:true }).setView(BA, 12);
    tiles().addTo(bigMap);
    bigLayer = L.layerGroup().addTo(bigMap);
    bigMap.on("popupopen", e=>{
      const b = e.popup.getElement().querySelector("[data-mapedit]");
      if(b) b.onclick = ()=>{ const it = state.items.find(x=>x.id===b.dataset.mapedit); if(it) itemForm(it); };
      const a = e.popup.getElement().querySelector("[data-mapdisc]");
      if(a) a.onclick = ()=>{ const d = discItems().find(x=>x.id===a.dataset.mapdisc); if(d && addDisc(d)){ bigMap.closePopup(); renderMap(); } };
    });
  }
  setTimeout(()=>bigMap.invalidateSize(), 60);
  bigLayer.clearLayers();
  const visible = state.items.filter(i=>!state.mapHidden.has(i.list) && (state.mapShowDone || !i.done) && (!state.mapZona || zkey(i)===state.mapZona));
  const pts = visible.filter(hasLoc);
  if(state.near) L.circleMarker([state.near.lat, state.near.lng], { radius:8, color:"#ffffff", weight:3, fillColor:"#378ADD", fillOpacity:1 }).bindPopup("Estás acá").addTo(bigLayer);
  pts.forEach(i=>{
    marker(i).bindPopup(`<div class="title">${esc(i.title)}</div>${i.zona?`<div class="note">${esc(i.zona)}</div>`:""}<div class="links" style="margin-top:6px">${linksHtml(i)}</div><button type="button" class="linkbtn" data-mapedit="${esc(i.id)}">Ver y editar →</button>`).addTo(bigLayer);
  });
  if(state.near) discNear(state.near, 5000).slice(0, 15).forEach(({ d, m })=>{
    L.marker([d.lat, d.lng], { icon:L.divIcon({ className:"discpin", html:"<span>✨</span>", iconSize:[26,26], iconAnchor:[13,13] }) })
      .bindPopup(`<div class="title">${esc(d.title)}</div><div class="note">${esc([d.tipo, discWhenShort(d), fmtDist(m)].filter(Boolean).join(" · "))}</div><div class="links" style="margin-top:6px"><a href="${esc(safeUrl(d.link))}" target="_blank" rel="noopener">Ver más ↗</a></div>${inMyList(d) ? `<span class="hint">✓ En tu lista</span>` : `<button type="button" class="linkbtn" data-mapdisc="${esc(d.id)}">+ A mi lista</button>`}`).addTo(bigLayer);
  });
  if(pts.length && !state.mapFitted){ bigMap.fitBounds(L.latLngBounds(pts.map(i=>[i.lat,i.lng])).pad(.2), { maxZoom:15 }); state.mapFitted = true; }
  const sin = visible.filter(i=>!hasLoc(i));
  const zg1 = state.mapZona && zg.find(g=>g.key===state.mapZona);
  $("mapNote").innerHTML = `${pts.length} en el mapa` + (sin.length ? ` · ${sin.length} sin ubicar <button type="button" class="linkbtn" id="mapSin" style="display:inline">Ubicarlos</button>` : "")
    + (zg1 ? ` · <button type="button" class="linkbtn" id="mapZList" style="display:inline">Ver la lista de ${esc(zg1.name)}</button>` : "");
  if($("mapSin")) $("mapSin").onclick = ()=>sinUbicarSheet();
  if($("mapZList")) $("mapZList").onclick = ()=>zonaSheet(state.mapZona);
}
function sinUbicarSheet(){
  const sin = state.items.filter(i=>!hasLoc(i) && !state.mapHidden.has(i.list) && (state.mapShowDone || !i.done));
  openSheet(`<h2>Sin ubicar</h2><p class="hint" style="margin:-6px 0 0">Tocá uno para ponerle su lugar en el mapa.</p>
    ${sin.map(i=>`<button type="button" class="mini" data-sin="${esc(i.id)}"><span class="title">${esc(i.title)}</span><span class="note">${esc([catOf(i.list).one, i.zona].filter(Boolean).join(" · "))}</span></button>`).join("")}
    <div class="row"><button type="button" class="btn ghost" id="sClose">Cerrar</button></div>`);
  $("sClose").onclick = closeSheet;
  $("sheet").querySelectorAll("[data-sin]").forEach(b=>b.onclick=()=>{ const it = state.items.find(x=>x.id===b.dataset.sin); if(it) itemForm(it, { openMap:true }); });
}

/* ---------- reloj para elegir la hora (el del sistema corta los botones en algunos celulares) ---------- */
/* día: botón simple que abre el calendario del celular (el campo nativo no se muestra) */
const dateBtn = (id, v) => `<span class="datebox"><button type="button" class="tbtn ${v?"set":""}" id="${id}Btn">📅 ${v ? esc(fmtDay(v)) : "Elegir día"}</button><input id="${id}" type="date" class="ghostdate" tabindex="-1" aria-hidden="true" value="${esc(v||"")}"></span>`;
function wireDate(id){
  const inp = $(id), btn = $(id+"Btn");
  if(!inp || !btn) return;
  const paint = ()=>{ btn.textContent = "📅 " + (inp.value ? fmtDay(inp.value) : "Elegir día"); btn.classList.toggle("set", !!inp.value); };
  inp.addEventListener("change", paint); inp.addEventListener("input", paint);
  btn.onclick = ()=>{ try{ inp.showPicker(); }catch{ inp.focus(); inp.click(); } };
}
const timeBtn = (id, v) => `<input type="hidden" id="${id}" value="${esc(v||"")}"><button type="button" class="tbtn ${v?"set":""}" id="${id}Btn">${v ? esc(v) : "--:--"}</button>`;
/* "✕ Sacar fecha": borra día y hora (la fecha es opcional) */
function wireDateClear(dateId, timeId){
  const d = $(dateId), x = $(dateId + "X"), tm = $(timeId), tb = $(timeId + "Btn");
  if(!d || !x) return;
  const show = ()=>{ x.hidden = !d.value; };
  d.addEventListener("change", show); d.addEventListener("input", show); show();
  x.onclick = ()=>{
    d.value = ""; if(tm) tm.value = ""; if(tb){ tb.textContent = "--:--"; tb.classList.remove("set"); }
    d.dispatchEvent(new Event("change", { bubbles:true })); show();
  };
}
function wireTime(id){
  const inp = $(id), btn = $(id+"Btn");
  if(!inp || !btn) return;
  const paint = ()=>{ btn.textContent = inp.value || "--:--"; btn.classList.toggle("set", !!inp.value); };
  btn.onclick = ()=>clockPick(inp.value, v=>{ inp.value = v; paint(); });
}
function clockPick(cur, done){
  const now = new Date();
  let [h, m] = cur ? cur.split(":").map(Number) : [now.getHours(), 0];
  let mode = "h";
  const ov = document.createElement("div");
  ov.className = "clk-ov";
  ov.innerHTML = `<div class="clk" role="dialog" aria-modal="true" aria-label="Elegir hora">
    <div class="clk-head"><button type="button" data-cm="h"></button><span>:</span><button type="button" data-cm="m"></button></div>
    <div class="clk-dial"><svg viewBox="0 0 260 260" aria-hidden="true"></svg></div>
    <div class="clk-btns"><button type="button" data-cx="clear">Borrar</button><button type="button" data-cx="cancel">Cancelar</button><button type="button" data-cx="ok">Listo</button></div></div>`;
  document.body.appendChild(ov);
  const svg = ov.querySelector("svg"), C = 130;
  const pos = (deg, r) => [C + r*Math.sin(deg*Math.PI/180), C - r*Math.cos(deg*Math.PI/180)];
  const two = n => String(n).padStart(2, "0");
  const draw = ()=>{
    ov.querySelectorAll("[data-cm]").forEach(b=>{ b.textContent = two(b.dataset.cm==="h" ? h : m); b.setAttribute("aria-pressed", b.dataset.cm===mode); });
    let marks = "", sel;
    if(mode==="h"){
      for(let i=0; i<12; i++){
        const outer = i===0 ? 12 : i, inner = i===0 ? 0 : i+12;
        const [ox, oy] = pos(i*30, 104), [ix, iy] = pos(i*30, 68);
        marks += `<text x="${ox}" y="${oy}" class="clk-n ${h===outer?"on":""}">${outer}</text><text x="${ix}" y="${iy}" class="clk-n in ${h===inner?"on":""}">${two(inner)}</text>`;
      }
      const isInner = h===0 || h>12;
      sel = pos((h%12)*30, isInner ? 68 : 104).concat(isInner ? 17 : 20);
    } else {
      for(let i=0; i<12; i++){ const [x, y] = pos(i*30, 104); marks += `<text x="${x}" y="${y}" class="clk-n ${m===i*5?"on":""}">${two(i*5)}</text>`; }
      sel = pos(m*6, 104).concat(m%5 ? 6 : 20);
    }
    svg.innerHTML = `<circle cx="${C}" cy="${C}" r="128" class="clk-face"/>
      <line x1="${C}" y1="${C}" x2="${sel[0]}" y2="${sel[1]}" class="clk-hand"/><circle cx="${C}" cy="${C}" r="4" class="clk-dot"/>
      <circle cx="${sel[0]}" cy="${sel[1]}" r="${sel[2]}" class="clk-sel"/>${marks}`;
  };
  const pick = (e, end)=>{
    const r = svg.getBoundingClientRect(), k = 260 / r.width;
    const dx = (e.clientX - r.left)*k - C, dy = (e.clientY - r.top)*k - C;
    let deg = Math.atan2(dx, -dy) * 180 / Math.PI; if(deg < 0) deg += 360;
    if(mode==="h"){
      const i = Math.round(deg/30) % 12, inner = Math.hypot(dx, dy) < 86;
      h = inner ? (i===0 ? 0 : i+12) : (i===0 ? 12 : i);
      draw(); if(end){ mode = "m"; setTimeout(draw, 180); }
    } else { m = Math.round(deg/6) % 60; draw(); }
  };
  let dragging = false;
  svg.addEventListener("pointerdown", e=>{ dragging = true; svg.setPointerCapture(e.pointerId); pick(e); });
  svg.addEventListener("pointermove", e=>{ if(dragging) pick(e); });
  svg.addEventListener("pointerup", e=>{ if(dragging){ dragging = false; pick(e, true); } });
  const close = v=>{ ov.remove(); window.removeEventListener("keydown", key, true); if(v !== null) done(v); if(!$("scrim").hidden) ensureGuard(); else releaseGuard(); };
  ensureGuard();
  const key = e=>{ if(e.key==="Escape"){ e.stopPropagation(); close(null); } };
  window.addEventListener("keydown", key, true);
  ov.addEventListener("click", e=>{
    if(e.target===ov) return close(null);
    const cm = e.target.closest("[data-cm]"); if(cm){ mode = cm.dataset.cm; draw(); return; }
    const cx = e.target.closest("[data-cx]"); if(!cx) return;
    if(cx.dataset.cx==="ok") close(two(h) + ":" + two(m));
    else if(cx.dataset.cx==="clear") close("");
    else close(null);
  });
  draw();
}

/* ---------- planes (itinerarios) ---------- */
const todayStr = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset()*6e4).toISOString().slice(0,10); };
const fmtDay = d => new Date(d+"T12:00:00").toLocaleDateString("es-AR",{ weekday:"short", day:"numeric", month:"short" });
function sortedPlans(){
  const t = todayStr();
  const rank = p => !p.date ? 1 : p.date >= t ? 0 : 2;   // próximos, sin fecha, pasados
  return state.plans.slice().sort((a,b)=> rank(a)-rank(b)
    || (rank(a)===0 ? (a.date+(a.time||"")).localeCompare(b.date+(b.time||"")) : rank(a)===2 ? (b.date+(b.time||"")).localeCompare(a.date+(a.time||"")) : 0)
    || (b.updatedAt||0)-(a.updatedAt||0));
}
function renderPlanes(){
  const box = $("planes");
  if(!state.plansLoaded){ box.innerHTML = `<div class="empty"><b>Cargando…</b></div>`; return; }
  if(!state.plans.length){
    box.innerHTML = `<div class="empty"><b>Todavía no hay planes</b>Tocá <strong>🧩 Juntar ideas</strong>, marcá varias cosas de tu lista y se arma el recorrido del día, en orden y en el mapa.</div>`;
    return;
  }
  const t = todayStr();
  box.innerHTML = sortedPlans().map(p=>{
    const stops = (p.stops||[]).map(id=>state.items.find(i=>i.id===id)).filter(Boolean);
    const when = p.date ? (p.date===t ? "Hoy" : fmtDay(p.date)) + (p.time ? " · " + p.time + " h" : "") : "Sin fecha";
    return `<button type="button" class="pcard" data-plan="${esc(p.id)}">
      <span class="pd ${p.date && p.date<t ? "past" : ""}">${esc(when)} · ${stops.length} parada${stops.length===1?"":"s"}</span>
      <b>${esc(p.title)}</b>
      ${stops.length ? `<ol>${stops.slice(0,4).map(i=>`<li>${esc(i.title)}</li>`).join("")}${stops.length>4?`<li>y ${stops.length-4} más…</li>`:""}</ol>` : ""}
    </button>`;
  }).join("");
}

/* link de Google Maps con el recorrido (Maps acepta hasta 9 paradas intermedias) */
function routeUrl(pts){
  if(!pts.length) return "";
  if(pts.length===1) return `https://www.google.com/maps/search/?api=1&query=${pts[0].lat},${pts[0].lng}`;
  const ll = i => `${i.lat},${i.lng}`, use = pts.slice(0, 11);
  return `https://www.google.com/maps/dir/?api=1&origin=${ll(use[0])}&destination=${ll(use[use.length-1])}`
    + (use.length>2 ? `&waypoints=${encodeURIComponent(use.slice(1,-1).map(ll).join("|"))}` : "");
}

/* paradas: mis cambios (mine, desde base) sobre lo último guardado (theirs) */
function mergeStops(base, mine, theirs){
  const keep = mine.filter(id=>!(base.includes(id) && !theirs.includes(id)));   // lo que el otro sacó, se va
  return keep.concat(theirs.filter(id=>!base.includes(id) && !keep.includes(id))); // lo que el otro sumó, al final
}
let planSync = null;   // si hay un plan abierto: función que lo actualiza cuando cambia en la base
function planSheet(plan, preStop, preDate){
  let stops = (plan ? plan.stops||[] : []).slice();
  let base = plan ? { ...plan, stops:(plan.stops||[]).slice() } : null, touched = new Set();
  [].concat(preStop || []).forEach(id=>{ if(id && !stops.includes(id)) stops.push(id); });
  let layer = null;
  openSheet(`
    <h2>${plan ? "Plan" : "Nuevo plan"}</h2>
    <label>Nombre<input id="plTitle" type="text" maxlength="80" value="${esc(plan ? plan.title : "")}" placeholder="Ej.: Sábado en San Telmo"></label>
    <div class="lbl">Cuándo
      <div class="row" style="gap:8px">${dateBtn("plDate", plan ? plan.date || "" : preDate || "")}${timeBtn("plTime", plan && plan.time)}</div>
      <button type="button" class="linkbtn dclear" id="plDateX">✕ Sacar fecha</button>
      <span class="hint">Día y hora son opcionales: podés dejarlo sin fecha.</span></div>
    <div class="lbl">Paradas, en orden
      <ol class="stops" id="plStops"></ol>
      <button type="button" class="linkbtn" id="plAdd">+ Sumar una parada de la lista</button>
      <div id="plPick" hidden style="display:flex;flex-direction:column;gap:8px">
        <input id="plQ" type="search" placeholder="Buscar en la lista" aria-label="Buscar parada">
        <div class="picker" id="plPickList"></div>
      </div>
    </div>
    <div id="plMapBox" hidden style="display:flex;flex-direction:column;gap:8px">
      <div id="plMap" class="map small"></div>
      <div class="links" id="plRoute"></div>
    </div>
    <label>Nota<textarea id="plNote" maxlength="500" placeholder="Horarios, qué llevar, reservas…">${esc(plan && plan.note || "")}</textarea></label>
    <div class="err" id="plErr" hidden></div>
    <div class="row"><button type="button" class="btn ghost" id="plCancel">Cancelar</button><button type="button" class="btn primary" id="plSave">${plan?"Guardar cambios":"Crear plan"}</button></div>
    ${plan ? `<span class="hint" style="text-align:center">Lo que cambie el otro aparece solo. Guardá solo si cambiaste algo vos.</span>` : ""}
    ${plan ? `<div class="row" id="plDelRow"><button type="button" class="btn danger" id="plDel">Borrar plan</button></div>` : ""}`);

  wireDate("plDate"); wireTime("plTime"); wireDateClear("plDate", "plTime");
  const byId = id => state.items.find(i=>i.id===id);
  const FIELDS = { title:"plTitle", date:"plDate", time:"plTime", note:"plNote" };
  const timeTouched = ()=> $("plTime").value !== ((base && base.time) || "");
  const dirty = ()=>{ if(plan){ if(timeTouched()) touched.add("time"); $("plSave").disabled = !touched.size; } };
  if(plan){
    Object.entries(FIELDS).forEach(([k, id])=>{ const el = $(id); const mark = ()=>{ touched.add(k); dirty(); };
      el.addEventListener("input", mark); el.addEventListener("change", mark); });
    new MutationObserver(dirty).observe($("plTimeBtn"), { childList:true, characterData:true, subtree:true });
    dirty();
    const sheetEl = $("plSave");
    planSync = ()=>{
      if(!document.body.contains(sheetEl)){ planSync = null; return; }
      const now = state.plans.find(p=>p.id===plan.id);
      if(!now){ planSync = null; closeSheet(); toast("Borraron este plan."); return; }
      const ns = (now.stops||[]).slice();
      stops = touched.has("stops") ? mergeStops(base.stops, stops, ns) : ns.slice();
      Object.entries(FIELDS).forEach(([k, id])=>{ if(!touched.has(k) && (now[k]||"")!==(base[k]||"")){ $(id).value = now[k] || "";
        if(k==="time"){ const b = $("plTimeBtn"); b.textContent = now.time || "--:--"; b.classList.toggle("set", !!now.time); }
        if(k==="date"){ const b = $("plDateBtn"); b.textContent = "📅 " + (now.date ? fmtDay(now.date) : "Elegir día"); b.classList.toggle("set", !!now.date); $("plDateX").hidden = !now.date; } } });
      base = { ...now, stops:ns };
      paintStops();
    };
  }
  const paintMap = ()=>{
    const pts = stops.map(byId).filter(i=>i && hasLoc(i));
    $("plMapBox").hidden = !pts.length;
    if(!pts.length) return;
    const url = routeUrl(pts);
    $("plRoute").innerHTML = `<a href="${esc(url)}" target="_blank" rel="noopener">${pts.length>1?"Abrir el recorrido en Google Maps":"Ver en Google Maps"} ↗</a>`
      + (pts.length>11 ? `<span class="hint">Maps muestra las primeras 11 paradas.</span>` : "")
      + (pts.length < stops.length ? `<span class="hint">${stops.length-pts.length} sin ubicar: no están en el mapa.</span>` : "");
    if(!window.L){ $("plMap").hidden = true; return; }
    if(!sheetMap){ sheetMap = L.map("plMap").setView(BA, 12); tiles().addTo(sheetMap); layer = L.layerGroup().addTo(sheetMap); }
    layer.clearLayers();
    const line = [];
    stops.forEach((id, n)=>{
      const i = byId(id); if(!i || !hasLoc(i)) return;
      line.push([i.lat, i.lng]);
      L.marker([i.lat, i.lng], { icon:L.divIcon({ className:"stopnum", html:`<span>${n+1}</span>`, iconSize:[28,28], iconAnchor:[14,14] }) })
        .bindPopup(`<div class="title">${n+1}. ${esc(i.title)}</div>${i.zona?`<div class="note">${esc(i.zona)}</div>`:""}`).addTo(layer);
    });
    if(line.length>1) L.polyline(line, { color:listColor("visitar"), weight:3, dashArray:"6 8", opacity:.85 }).addTo(layer);
    setTimeout(()=>{ if(!sheetMap) return; sheetMap.invalidateSize(); sheetMap.fitBounds(L.latLngBounds(line).pad(.25), { maxZoom:15 }); }, 80);
  };
  const paintStops = ()=>{
    $("plStops").innerHTML = stops.length ? stops.map((id, n)=>{
      const i = byId(id);
      const sub = i ? [catOf(i.list).one, i.zona, hasLoc(i) ? "" : "sin ubicar", i.done ? "ya lo hicieron" : ""].filter(Boolean).join(" · ") : "Lo borraron de la lista";
      return `<li class="stop ${i?"":"gone"}"><span class="num">${n+1}</span>
        <div class="body"><div class="title">${esc(i ? i.title : "Parada borrada")}</div><div class="note">${esc(sub)}</div></div>
        <div class="sbtns"><button type="button" data-up="${n}" aria-label="Subir" ${n===0?"disabled":""}>↑</button><button type="button" data-down="${n}" aria-label="Bajar" ${n===stops.length-1?"disabled":""}>↓</button><button type="button" data-rm="${n}" aria-label="Quitar">✕</button></div></li>`;
    }).join("") : `<li class="hint">Todavía no hay paradas. Sumá lugares de la lista.</li>`;
    $("plAdd").hidden = stops.length >= 30;
    paintMap();
    if(!$("plPick").hidden) paintPick();
  };
  const paintPick = ()=>{
    const q = norm($("plQ").value);
    const cand = state.items.filter(i=>!stops.includes(i.id) && (!q || norm([i.title, i.zona, i.note].join(" ")).includes(q)))
      .sort((a,b)=>(a.done?1:0)-(b.done?1:0) || (b.createdAt||0)-(a.createdAt||0)).slice(0, 60);
    $("plPickList").innerHTML = cand.length ? cand.map(i=>`<button type="button" class="mini ${i.done?"is-done":""}" data-pk="${esc(i.id)}"><span class="title">${esc(i.title)}</span><span class="note">${esc([catOf(i.list).one, i.zona, hasLoc(i)?"":"sin ubicar"].filter(Boolean).join(" · "))}</span></button>`).join("")
      : `<span class="hint">${state.items.length ? "No hay más para sumar con esa búsqueda." : "La lista está vacía: primero agregá lugares."}</span>`;
  };
  $("plStops").onclick = e=>{
    const b = e.target.closest("button"); if(!b) return;
    const n = +(b.dataset.up ?? b.dataset.down ?? b.dataset.rm);
    if(b.dataset.up!=null && n>0) [stops[n-1], stops[n]] = [stops[n], stops[n-1]];
    else if(b.dataset.down!=null && n<stops.length-1) [stops[n+1], stops[n]] = [stops[n], stops[n+1]];
    else if(b.dataset.rm!=null) stops.splice(n, 1);
    touched.add("stops"); dirty(); paintStops();
  };
  $("plAdd").onclick = ()=>{ const open = $("plPick").hidden; $("plPick").hidden = !open; $("plAdd").textContent = open ? "Listo" : "+ Sumar una parada de la lista"; if(open) paintPick(); };
  $("plQ").addEventListener("input", paintPick);
  $("plPickList").onclick = e=>{ const b = e.target.closest("[data-pk]"); if(b && stops.length<30){ stops.push(b.dataset.pk); touched.add("stops"); dirty(); paintStops(); } };
  $("plCancel").onclick = closeSheet;
  if(plan) $("plCancel").textContent = "Cerrar";
  $("plSave").onclick = ()=>{
    const title = $("plTitle").value.trim() || ($("plDate").value ? "Plan del " + fmtDay($("plDate").value) : "");
    if(!title){ $("plErr").hidden = false; $("plErr").textContent = "Ponele un nombre o un día."; return; }
    const now = plan && state.plans.find(p=>p.id===plan.id);
    const fin = now && touched.has("stops") ? mergeStops(base.stops, stops, now.stops||[]) : now ? (now.stops||[]) : stops;
    const data = { title, date:$("plDate").value || "", note:$("plNote").value.trim(), stops:fin.filter(id=>byId(id) || (now && (now.stops||[]).includes(id))), updatedAt:Date.now() };
    const time = $("plTime").value || "";
    if(time && !data.date){ $("plErr").hidden = false; $("plErr").textContent = "Elegí también el día."; return; }
    if(time || (plan && plan.time)) data.time = time;
    if(plan){ store.savePlan(plan.id, data); notifyOthers(state.gid, "plan", { ...plan, ...data }, "edit"); }
    else {
      const pid = store.newPlanId();
      store.savePlan(pid, { ...data, createdAt:Date.now(), createdBy:state.me.uid });
      notifyOthers(state.gid, "plan", { id:pid, ...data });
    }
    closeSheet(); toast(plan ? "Plan guardado" : "Plan creado");
    if(!plan && state.view!=="calendario"){ stopSelecting(true); state.view = "planes"; render(); }
  };
  if(plan) $("plDel").onclick = ()=>{
    $("plDelRow").innerHTML = `<button type="button" class="btn ghost" id="plNo">No, dejarlo</button><button type="button" class="btn danger" id="plYes">Sí, borrar el plan</button>`;
    $("plNo").onclick = ()=>planSheet(plan);
    $("plYes").onclick = ()=>{ store.removePlan(plan.id); closeSheet(); toast("Plan borrado"); };
  };
  paintStops();
}

/* ---------- calendario: los planes de todas tus listas ---------- */
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const calSubs = new Map();   // gid -> cortar la escucha
const calItemSubs = new Map();
function stopCal(){ calSubs.forEach(u=>u()); calSubs.clear(); calItemSubs.forEach(u=>u()); calItemSubs.clear(); }
function watchCal(){
  const ids = new Set(state.lists.map(l=>l.id));
  calSubs.forEach((u, gid)=>{ if(!ids.has(gid)){ u(); calSubs.delete(gid); delete state.calPlans[gid]; } });
  calItemSubs.forEach((u, gid)=>{ if(!ids.has(gid)){ u(); calItemSubs.delete(gid); delete state.calItems[gid]; } });
  ids.forEach(gid=>{
    if(calItemSubs.has(gid)) return;
    calItemSubs.set(gid, ()=>{});
    calItemSubs.set(gid, store.watchDatedOf(gid, items=>{ state.calItems[gid] = items; calRedraw(); }));
  });
  ids.forEach(gid=>{
    if(calSubs.has(gid)) return;
    calSubs.set(gid, ()=>{});
    calSubs.set(gid, store.watchPlansOf(gid, plans=>{ state.calPlans[gid] = plans; calRedraw(); }));
  });
}
let calQueued = false;
function calRedraw(){
  if(calQueued) return; calQueued = true;
  setTimeout(()=>{ calQueued = false; if(state.view==="calendario") renderCal(); }, 0);
}
function renderCal(){
  if(!state.calMonth) state.calMonth = todayStr().slice(0,7);
  if(!state.listsChecked){ state.listsChecked = true; refreshLists().then(()=>{ if(state.view==="calendario") renderCal(); }); }
  watchCal();
  const listOf = gid => state.lists.find(l=>l.id===gid) || {};
  const all = [];
  Object.entries(state.calPlans).forEach(([gid, ps])=>{ if(calSubs.has(gid)) ps.forEach(p=>all.push({ ...p, gid })); });
  Object.entries(state.calItems).forEach(([gid, its])=>{ if(calItemSubs.has(gid)) its.forEach(i=>{ if(i.date) all.push({ ...i, gid, isItem:true }); }); });
  const byDay = new Map();
  all.filter(p=>p.date).forEach(p=>{ if(!byDay.has(p.date)) byDay.set(p.date, []); byDay.get(p.date).push(p); });
  const [y, m] = state.calMonth.split("-").map(Number);
  const first = new Date(y, m-1, 1), days = new Date(y, m, 0).getDate(), lead = (first.getDay()+6)%7, t = todayStr();
  const title = first.toLocaleDateString("es-AR", { month:"long" }).replace(/^./, c=>c.toUpperCase()) + " " + y;
  let cells = "";
  for(let n=0; n<lead; n++) cells += `<span></span>`;
  for(let d=1; d<=days; d++){
    const key = `${state.calMonth}-${String(d).padStart(2,"0")}`, ps = byDay.get(key) || [];
    const nAct = ps.filter(p=>p.isItem).length, nPlan = ps.length - nAct;
    const lab = [nAct ? `${nAct} actividad${nAct===1?"":"es"}` : "", nPlan ? `${nPlan} plan${nPlan===1?"":"es"}` : ""].filter(Boolean).join(" y ");
    // una marca por tipo: punto = actividad, triángulo amarillo = plan (no importa cuántas haya)
    cells += `<button type="button" class="cday ${key===t?"today":""} ${ps.length?"has":""}" data-day="${key}" aria-pressed="${key===state.calDay}" aria-label="${d}${lab?", "+lab:""}">${d}${ps.length?`<i>${nAct?`<b class="mact"></b>`:""}${nPlan?`<b class="mplan"></b>`:""}</i>`:""}</button>`;
  }
  const card = p=>{
    const l = listOf(p.gid), n = (p.stops||[]).length;
    if(p.isItem) return `<button type="button" class="pcard ${p.done?"is-done":""}" data-calitem="${esc(p.gid)}|${esc(p.id)}">
      <span class="pd ${p.date<t ? "past" : ""}"><b class="mact" aria-label="Actividad"></b> ${esc(p.date===t ? "Hoy" : fmtDay(p.date)) + (p.time ? " · " + esc(p.time) + " h" : "")}${catOf(p.list).one ? " · " + esc(catOf(p.list).one) : ""}${p.done?" · hecho":""}</span>
      <b>${esc(p.title)}</b>
      <span class="hint">${l.private?"🔒":"👥"} ${esc(l.name||"Lista")}${p.zona?" · "+esc(p.zona):""}</span></button>`;
    return `<button type="button" class="pcard" data-calplan="${esc(p.gid)}|${esc(p.id)}">
      <span class="pd ${p.date && p.date<t ? "past" : ""}"><b class="mplan" aria-label="Plan"></b> ${p.date ? esc(p.date===t ? "Hoy" : fmtDay(p.date)) + (p.time ? " · " + esc(p.time) + " h" : "") + " · " : ""}${n} parada${n===1?"":"s"}</span>
      <b>${esc(p.title)}</b>
      <span class="hint">${l.private?"🔒":"👥"} ${esc(l.name||"Lista")}${p.gid===state.gid?" · abierta":""}</span>
      ${p.note?`<span class="note">${esc(p.note)}</span>`:""}</button>`;
  };
  const inMonth = all.filter(p=>p.date && p.date.startsWith(state.calMonth)).sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")) || String(a.title).localeCompare(String(b.title),"es"));
  // lo que ya pasó no se lista (salvo que toques ese día en la grilla)
  const shown = state.calDay ? inMonth.filter(p=>p.date===state.calDay) : inMonth.filter(p=>p.date >= t);
  const undated = all.filter(p=>!p.date && !p.isItem).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  const loading = state.lists.some(l=>!(l.id in state.calPlans) || !(l.id in state.calItems));
  $("cal").innerHTML = `
    <div class="calhead"><button type="button" class="calnav" data-calnav="-1" aria-label="Mes anterior">‹</button><b>${esc(title)}</b><button type="button" class="calnav" data-calnav="1" aria-label="Mes siguiente">›</button></div>
    <div class="calgrid">${["L","M","M","J","V","S","D"].map(d=>`<span class="cdow">${d}</span>`).join("")}${cells}</div>
    <div class="callegend"><span><b class="mact"></b>Actividad</span><span><b class="mplan"></b>Plan</span>${state.calMonth!==t.slice(0,7) || (state.calDay && state.calDay!==t)?`<button type="button" class="linkbtn" data-caltoday>Ir a hoy</button>`:""}</div>
    <div class="sec">${state.calDay ? esc(fmtDay(state.calDay)) : "Todo " + esc(first.toLocaleDateString("es-AR",{ month:"long" }).replace(/^/, "en "))}</div>
    ${shown.length ? shown.map(card).join("") : `<div class="empty"><b>${loading ? "Cargando…" : state.calDay ? "Nada ese día" : "Nada este mes"}</b>${loading ? "" : state.calDay ? "Tocá <strong>+ Nuevo plan</strong> para armar uno para ese día." : "Los planes y lo que tenga día aparecen acá, de todas tus listas."}</div>`}
    ${undated.length && !state.calDay ? `<div class="sec">Sin fecha</div>${undated.map(card).join("")}` : ""}`;
}

/* ---------- listas: cambiar, crear, sumarse ---------- */
function listsSheet(){
  let priv = true;
  const draw = ()=>{
    const curName = state.group ? state.group.name || "" : "";
    openSheet(`<i class="grab" aria-hidden="true"></i>
      ${state.group ? `<div class="lbl">Nombre de esta lista
        <div class="addtag"><input id="rnName" type="text" maxlength="40" value="${esc(curName)}" aria-label="Nombre de esta lista" enterkeyhint="done"><button type="button" id="rnOk">Guardar</button></div></div>` : ""}
      <h2>Tus listas</h2>
      <div style="display:flex;flex-direction:column;gap:6px">${state.lists.map(l=>{
        const n = (l.members||[]).length;
        return `<button type="button" class="lrow" data-gl="${esc(l.id)}" aria-current="${l.id===state.gid}">
          <span class="ic" aria-hidden="true">${l.private?"🔒":"👥"}</span>
          <span style="min-width:0"><span class="t">${esc(l.name||"Lista")}</span><span class="s">${l.private ? "Privada · solo vos" : n>1 ? `Compartida · ${n} personas` : "Compartida · todavía solo vos"}${l.id===state.gid?" · abierta":""}</span></span></button>`;
      }).join("") || `<span class="hint">Cargando…</span>`}</div>
      <div class="sec">Nueva lista</div>
      <label>Nombre<input id="nlName" type="text" maxlength="40" placeholder="Ej.: Con amigos, Mis cosas"></label>
      <div class="pills" role="group" aria-label="Quién la ve"><button type="button" class="pill" data-np="1" aria-pressed="${priv}">🔒 Mi lista</button><button type="button" class="pill" data-np="0" aria-pressed="${!priv}">👥 Compartida</button></div>
      <span class="hint" id="nlHint">${priv ? "Solo vos la ves. Si después querés, la podés compartir." : `Se suma gente con un código (hasta ${MAX_MEMBERS} personas).`}</span>
      <button type="button" class="btn primary" id="nlCreate">Crear lista</button>
      <div class="sec">Sumarme a otra lista</div>
      <div class="addtag"><input id="nlCode" type="text" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="Código, ej.: K7M2QX" aria-label="Código de invitación" style="text-transform:uppercase;letter-spacing:.12em"><button type="button" id="nlJoin">Unirme</button></div>
      <div class="err" id="nlErr" hidden></div>
      <div class="row"><button type="button" class="btn ghost" id="nlClose">Cerrar</button></div>`);
    const err = m => { $("nlErr").hidden = false; $("nlErr").textContent = m; };
    if($("rnName")){
      const rename = async ()=>{
        const v = $("rnName").value.trim();
        if(!v) return err("La lista necesita un nombre.");
        if(v === curName) return closeSheet();
        $("rnOk").disabled = true;
        try{ await store.rename(v); const l = state.lists.find(x=>x.id===state.gid); if(l) l.name = v; toast("Nombre cambiado"); closeSheet(); }
        catch(e){ console.error(e); $("rnOk").disabled = false; err("No se pudo cambiar el nombre. Revisá la conexión."); }
      };
      $("rnOk").onclick = rename;
      $("rnName").addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); rename(); } });
    }
    $("sheet").querySelectorAll("[data-gl]").forEach(b=>b.onclick=()=>{ closeSheet(); if(b.dataset.gl!==state.gid){ state.view = ["planes","calendario"].includes(state.view) ? state.view : "pend"; enterGroup(b.dataset.gl); } });
    $("sheet").querySelectorAll("[data-np]").forEach(b=>b.onclick=()=>{ priv = b.dataset.np==="1"; const name = $("nlName").value; draw(); $("nlName").value = name; });
    $("nlCreate").onclick = async ()=>{
      const name = $("nlName").value.trim();
      if(!name) return err("Ponele un nombre a la lista.");
      $("nlCreate").disabled = true;
      try{ const gid = await store.createGroup(name, priv); closeSheet(); state.view = "pend"; enterGroup(gid); refreshLists(); toast(priv ? "Lista privada creada" : "Lista creada. Tocá tu foto arriba para invitar."); }
      catch(e){ console.error(e); $("nlCreate").disabled = false; err("No se pudo crear la lista. Revisá la conexión."); }
    };
    $("nlJoin").onclick = async ()=>{
      const code = $("nlCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
      if(code.length < 6) return err("El código tiene 6 letras o números.");
      $("nlJoin").disabled = true;
      try{ const gid = await store.joinGroup(code); closeSheet(); state.view = "pend"; enterGroup(gid); refreshLists(); }
      catch(e){ console.error(e); $("nlJoin").disabled = false; err(joinErr(e)); }
    };
    $("nlClose").onclick = closeSheet;
  };
  draw();
  refreshLists().then(()=>{ if($("nlClose") && !$("nlName").value) draw(); });
}
const joinErr = e => e && e.code==="not-found" ? "Ese código no existe. Revisá que esté bien escrito."
  : e && e.code==="full" ? `No se pudo: esa lista ya tiene ${MAX_MEMBERS} personas o el código cambió.` : "No se pudo unir a la lista. Probá de nuevo.";

/* ---------- hojas ---------- */
let sheetMap = null;
function openSheet(html){
  if(sheetMap){ sheetMap.remove(); sheetMap = null; }
  const sh = $("sheet");
  if($("scrim").hidden) sheetOpener = document.activeElement;
  sh.innerHTML = html; $("scrim").hidden = false; sh.scrollTop = 0;
  // para lectores de pantalla: la ventana se llama como su título y el foco entra en ella
  const h = sh.querySelector("h2");
  if(h){ h.id = h.id || "sheetTitle"; sh.setAttribute("aria-labelledby", h.id); } else sh.removeAttribute("aria-labelledby");
  sh.tabIndex = -1; sh.focus({ preventScroll:true });
  ensureGuard();
}
let sheetOpener = null;
/* deslizar para abajo cierra las hojas que tienen la manija (.grab): Para descubrir, el dado, recuerdos, barrios */
(()=>{
  const sh = $("sheet"); let y0 = null, x0 = 0, dy = 0, t0 = 0, drag = false;
  sh.addEventListener("touchstart", e=>{
    if(!sh.querySelector(".grab") || sh.scrollTop > 0 || e.touches.length > 1 || e.target.closest("input,textarea,select,.leaflet-container")) { y0 = null; return; }
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; t0 = Date.now(); drag = false;
  }, { passive:true });
  sh.addEventListener("touchmove", e=>{
    if(y0==null) return;
    const d = e.touches[0].clientY - y0, dx = Math.abs(e.touches[0].clientX - x0);
    if(!drag){ if(d < 8 || dx > d || sh.scrollTop > 0){ if(d < -4 || dx > 12) y0 = null; return; } drag = true; sh.style.transition = "none"; sh.style.animation = "none"; }
    dy = Math.max(0, d); e.preventDefault();
    sh.style.transform = `translateY(${dy}px)`; $("scrim").style.background = `rgba(10,20,14,${.45 * Math.max(0, 1 - dy/400)})`;
  }, { passive:false });
  const end = ()=>{
    if(y0==null) return; y0 = null; if(!drag) return;
    const fast = dy / Math.max(1, Date.now() - t0) > .6;
    sh.style.transition = "transform .18s ease-out";
    if(dy > 110 || (fast && dy > 40)){
      sh.style.transform = "translateY(100%)";
      setTimeout(()=>{ closeSheet(); }, 170);
    } else { sh.style.transform = ""; $("scrim").style.background = ""; }
  };
  sh.addEventListener("touchend", end); sh.addEventListener("touchcancel", end);
})();
function closeSheet(){ const sh = $("sheet"); sh.style.transform = sh.style.transition = sh.style.animation = ""; $("scrim").style.background = ""; if(sheetMap){ sheetMap.remove(); sheetMap = null; } $("scrim").hidden = true; $("sheet").innerHTML = ""; const op = sheetOpener; sheetOpener = null; if(op && op.isConnected && op.focus) op.focus({ preventScroll:true }); releaseGuard(); }

/* ---------- botón Atrás del celular: cierra lo de arriba en vez de salir de la app ----------
   Mientras haya algo abierto, dejamos una entrada extra en el historial; Atrás la consume y cerramos una capa. */
let guardConsuming = false;
const hasLayer = () => !!document.querySelector(".clk-ov") || !$("scrim").hidden || state.selecting || (!$("vMain").hidden && state.view!=="pend");
function ensureGuard(){ if(!(history.state && history.state.qhh)) history.pushState({ qhh:1 }, ""); }
function releaseGuard(){
  // guardConsuming: ya hay un "atrás" en camino (cerrar una ventana y render() llaman los dos); no retroceder dos veces
  setTimeout(()=>{ if(!guardConsuming && !hasLayer() && history.state && history.state.qhh){ guardConsuming = true; history.back(); } }, 0);
}
function backLayer(){
  const clk = document.querySelector(".clk-ov [data-cx=cancel]");
  if(clk){ clk.click(); return true; }
  if(!$("scrim").hidden){ closeSheet(); return true; }
  if(state.selecting){ stopSelecting(); return true; }
  if(!$("vMain").hidden && state.view!=="pend"){ state.view = "pend"; render(); window.scrollTo(0, 0); return true; }
  return false;
}
window.addEventListener("popstate", ()=>{
  if(guardConsuming){ guardConsuming = false; if(hasLayer()) ensureGuard(); return; }
  backLayer();
  if(hasLayer()) ensureGuard();
});
$("scrim").addEventListener("click", e=>{ if(e.target.id==="scrim") closeSheet(); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !$("scrim").hidden) closeSheet(); });

function itemForm(item, pre={}){
  const it = item || { list:pre.list||(state.tab==="todas" ? "actividad" : state.tab), title:pre.title||"", note:pre.note||"", zona:pre.zona||"", tags:[], link:pre.link||"", maps:"", price:0 };
  const lk = linksOf(it);
  let tags = tagsOf(it).slice(), list = it.list, price = it.price||0;
  let loc = hasLoc(it) ? { lat:it.lat, lng:it.lng } : null;
  const zonas = allZonas();
  openSheet(`
    <h2>${item?"Editar":pre.fromShare?"Guardar lo compartido":"Agregar"}</h2>
    <form id="itemForm" style="display:flex;flex-direction:column;gap:14px">
      ${!item && state.lists.length>1 ? `<label>Guardar en<select id="fGid">${state.lists.map(l=>`<option value="${esc(l.id)}" ${l.id===state.gid?"selected":""}>${l.private?"🔒 ":""}${esc(l.name||"Lista")}</option>`).join("")}</select></label>` : ""}
      <div class="lbl">Qué tipo (opcional)
        <div class="pills" role="group" aria-label="Categoría" id="catPills"></div>
        <div class="addtag" id="catNewBox" hidden><input id="catNew" type="text" maxlength="28" placeholder="Ej.: Ferias, Museos, Shows" aria-label="Nueva categoría"><button type="button" id="catNewOk">Crear</button></div></div>
      <div class="lbl capbox">
        <button type="button" class="linkbtn" id="capOpen" ${pre.fromShare?"hidden":""}>📋 Completar con la descripción del reel</button>
        <div id="capPanel" ${pre.fromShare?"":"hidden"} style="display:flex;flex-direction:column;gap:8px">
          <label>Descripción del reel<textarea id="fCap" maxlength="5000" placeholder="Pegá la descripción del reel o dictá lo que dicen: barrio, nombre del lugar, dirección…"></textarea></label>
          <div class="row" style="gap:8px">${navigator.clipboard && navigator.clipboard.readText ? `<button type="button" class="btn ghost" id="capPaste">Pegar</button>` : ""}<button type="button" class="btn ghost" id="capGo">Completar</button></div>
          <span class="lhint" id="capHint" hidden></span>
        </div>
      </div>
      <label>Qué es<input id="fTitle" type="text" maxlength="120" required value="${esc(it.title)}" placeholder="Ej.: Parrilla en San Telmo"></label>
      <div class="lbl">Cuándo (opcional)
        <div class="row" style="gap:8px">${dateBtn("fDate", it.date||pre.date||"")}${timeBtn("fTime", it.time)}</div>
        <button type="button" class="linkbtn dclear" id="fDateX">✕ Sacar fecha</button></div>
      <label>Link del reel o de la web<input id="fLink" type="url" inputmode="url" value="${esc(lk.link)}" placeholder="https://www.instagram.com/reel/…"><span class="lhint" id="fLinkHint" hidden></span></label>
      <div class="lbl where">Dónde
        <div class="addtag"><input id="locQ" type="search" placeholder="Lugar, dirección o link de Maps" aria-label="Buscar el lugar"><button type="button" id="locGo">Buscar</button></div>
        <div class="results" id="locRes"></div>
        <div class="locbox"><span id="locTxt"></span><button type="button" class="linkbtn" id="locToggle">Ver en el mapa</button></div>
        <div id="locPanel" hidden style="display:flex;flex-direction:column;gap:8px">
          <div id="locMap" class="map small"></div>
          <span class="hint">Tocá el mapa para mover el pin.</span>
          <div class="row" style="gap:8px"><button type="button" class="btn ghost" id="locMe">Usar mi ubicación</button><button type="button" class="btn ghost" id="locClear">Quitar ubicación</button></div>
        </div>
        <label class="wzona">Barrio o zona<input id="fZonaIn" type="text" maxlength="60" list="zonasList" value="${esc(it.zona)}" placeholder="Se completa solo al ubicarlo">
          <datalist id="zonasList">${zonas.map(z=>`<option value="${esc(z)}"></option>`).join("")}</datalist></label>
      </div>
      <label>Nota<textarea id="fNote" maxlength="400" placeholder="Qué pedir, cuándo ir, quién lo recomendó…">${esc(it.note)}</textarea></label>
      <div class="lbl">Precio
        <div class="pills" role="group" aria-label="Precio">${[0,1,2,3].map(p=>`<button type="button" class="pill" data-price="${p}" aria-pressed="${price===p}">${p?"$".repeat(p):"Gratis / no sé"}</button>`).join("")}</div></div>
      <div class="lbl">Etiquetas
        <div class="pills" id="tagPills"></div>
        <div class="addtag"><input id="fNewTag" type="text" maxlength="30" placeholder="Otra etiqueta…" aria-label="Nueva etiqueta"><button type="button" id="fAddTag">Sumar</button></div></div>
      ${item ? `<div class="lbl">Planes
        <span class="hint">${(()=>{ const inP = state.plans.filter(p=>(p.stops||[]).includes(item.id)); return inP.length ? "Está en: " + inP.map(p=>esc(p.title)).join(", ") : "No está en ningún plan."; })()}</span>
        <div class="row" style="gap:8px">${state.plans.some(p=>!(p.stops||[]).includes(item.id)) ? `<select id="fPlan" aria-label="Sumar a un plan"><option value="">Sumar a un plan…</option>${sortedPlans().filter(p=>!(p.stops||[]).includes(item.id)).map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join("")}</select>` : ""}<button type="button" class="btn ghost" id="fNewPlan">Nuevo plan con esto</button></div></div>` : ""}
      ${item && item.done ? `<button type="button" class="linkbtn" id="fMem">Cambiar fecha, puntaje, foto o recuerdo →</button>` : ""}
      <div class="err" id="fErr" hidden></div>
      <div class="row"><button type="button" class="btn ghost" id="fCancel">Cancelar</button><button type="submit" class="btn primary">${item?"Guardar":"Agregar"}</button></div>
      ${item?`<div class="row" id="delRow"><button type="button" class="btn danger" id="fDel">Borrar</button></div>`:""}
    </form>`);
  const sh = $("sheet");
  wireDate("fDate"); wireTime("fTime"); wireDateClear("fDate", "fTime");
  const showErr = m => { $("fErr").hidden=false; $("fErr").textContent=m; };

  /* etiquetas */
  const paintTags = ()=>{
    $("tagPills").innerHTML = uniq(allTags().concat(tags)).map(t=>`<button type="button" class="pill" data-t="${esc(t)}" aria-pressed="${tags.some(x=>norm(x)===norm(t))}">${esc(t)}</button>`).join("");
    $("tagPills").querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{ const t=b.dataset.t; tags = tags.some(x=>norm(x)===norm(t)) ? tags.filter(x=>norm(x)!==norm(t)) : tags.concat(t); paintTags(); });
  };
  paintTags();
  const addTag = ()=>{ const t=$("fNewTag").value.trim(); if(t && !tags.some(x=>norm(x)===norm(t)) && tags.length<8) tags.push(t); $("fNewTag").value=""; paintTags(); };
  $("fAddTag").onclick = addTag;
  $("fNewTag").addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); addTag(); } });
  let listTouched = false;
  const allCats = ()=>Object.keys(LISTS).filter(k=>k!=="actividad").concat(catKeys(list).filter(k=>!LISTS[k]));
  const paintCats = ()=>{
    $("catPills").innerHTML = allCats().map(k=>`<button type="button" class="pill" data-list="${esc(k)}" aria-pressed="${list===k}"><span class="dot" style="background:${listColor(k)}"></span>${esc(catOf(k).one)}</button>`).join("")
      + `<button type="button" class="pill" id="catAdd">+ Otra</button>`;
    $("catAdd").onclick = ()=>{ $("catNewBox").hidden = false; $("catNew").focus(); };
  };
  const pickList = k=>{ list=k; paintCats(); if(pin) pin.setStyle({ fillColor:listColor(list) }); };
  paintCats();
  $("catPills").addEventListener("click", e=>{ const b = e.target.closest("[data-list]"); if(b){ listTouched = true; pickList(list===b.dataset.list ? "actividad" : b.dataset.list); } });
  const newCat = ()=>{
    const name = $("catNew").value.trim().replace(/\s+/g," ").slice(0,28);
    if(!name) return;
    const builtin = Object.keys(LISTS).find(k=>norm(LISTS[k].label)===norm(name) || norm(LISTS[k].one)===norm(name));
    const existing = catKeys().find(k=>k.startsWith("c:") && norm(k.slice(2))===norm(name));
    listTouched = true; pickList(builtin || existing || "c:" + name);
    $("catNew").value = ""; $("catNewBox").hidden = true;
  };
  $("catNewOk").onclick = newCat;
  $("catNew").addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); newCat(); } });
  sh.querySelectorAll("[data-price]").forEach(b=>b.onclick=()=>{ price=+b.dataset.price; sh.querySelectorAll("[data-price]").forEach(x=>x.setAttribute("aria-pressed", x===b)); });

  /* links */
  const linkHint = ()=>{
    const v = $("fLink").value.trim(), h = $("fLinkHint");
    if(v && isMaps(v) && !mapsLink){ $("fLink").value = ""; useMapsLink(v); h.hidden=false; h.textContent="Era un link de Maps: lo pasé a Dónde."; return; }
    if(v && isIG(v)){ h.hidden=false; h.textContent = /\/(reel|reels|tv)\//.test(v) ? "Reel de Instagram ✓" : "Link de Instagram ✓"; }
    else h.hidden = true;
  };
  $("fLink").addEventListener("input", linkHint);

  /* dónde: búsqueda, link de Maps, pin y barrio, todo junto */
  let pin = null, mapsLink = lk.maps, zonaAuto = "", geoN = 0;
  const NOM = "https://nominatim.openstreetmap.org";
  const zonaFrom = a => {
    if(!a) return "";
    const z = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.town || a.village || a.city || "";
    return (zonas.find(x=>norm(x)===norm(z)) || z).slice(0, 60);
  };
  const putZona = z => { if(!z) return; const cur = $("fZonaIn").value.trim(); if(!cur || cur===zonaAuto){ $("fZonaIn").value = zonaAuto = z; locTxt(); } };
  const reverse = async ll => {
    const n = ++geoN;
    try{
      const r = await fetch(`${NOM}/reverse?format=jsonv2&zoom=16&addressdetails=1&accept-language=es&lat=${ll.lat}&lon=${ll.lng}`);
      const d = await r.json();
      if(n===geoN && $("fZonaIn")) putZona(zonaFrom(d.address));
    }catch{}
  };
  const locTxt = ()=>{
    const z = $("fZonaIn").value.trim();
    $("locTxt").innerHTML = (loc ? `📍 Ubicado${z ? " · " + esc(z) : ""}` : "Sin ubicar todavía")
      + (mapsLink ? ` · <a href="${esc(safeUrl(mapsLink))}" target="_blank" rel="noopener">link de Maps</a> <button type="button" class="linkbtn" id="mapsOff" style="display:inline;padding:0 4px" aria-label="Quitar link de Maps">✕</button>` : "");
    if($("mapsOff")) $("mapsOff").onclick = ()=>{ mapsLink = ""; locTxt(); };
  };
  const setLoc = (ll, pan, geo)=>{
    loc = ll ? { lat:+(+ll.lat).toFixed(6), lng:+(+ll.lng).toFixed(6) } : null; locTxt();
    if(loc && geo) reverse(loc);
    if(!sheetMap) return;
    if(pin){ pin.remove(); pin = null; }
    if(loc){ pin = L.circleMarker([loc.lat, loc.lng], { radius:11, color:"#fff", weight:3, fillColor:listColor(list), fillOpacity:1 }).addTo(sheetMap); if(pan) sheetMap.setView([loc.lat, loc.lng], Math.max(sheetMap.getZoom(), 15)); }
  };
  const useMapsLink = v => {
    mapsLink = safeUrl(v) || "";
    const c = coordsFromUrl(v);
    if(c){ setLoc(c, true, true); $("locRes").innerHTML = `<span class="hint">Ubicación tomada del link de Maps ✓</span>`; }
    else $("locRes").innerHTML = `<span class="hint">Guardé el link de Maps. Para el pin en nuestro mapa, buscá el nombre o la dirección.</span>`;
    locTxt();
  };
  $("fZonaIn").addEventListener("input", locTxt);
  const openMap = ()=>{
    $("locPanel").hidden = false; $("locToggle").textContent = "Ocultar mapa";
    if(!window.L){ $("locRes").innerHTML = `<span class="hint">El mapa necesita conexión a internet.</span>`; return; }
    if(!sheetMap){
      sheetMap = L.map("locMap").setView(loc ? [loc.lat, loc.lng] : BA, loc ? 15 : 12);
      tiles().addTo(sheetMap);
      sheetMap.on("click", e=>setLoc(e.latlng, false, true));
      setLoc(loc, false);
    }
    setTimeout(()=>sheetMap && sheetMap.invalidateSize(), 80);
  };
  $("locToggle").onclick = ()=>{ if($("locPanel").hidden) openMap(); else { $("locPanel").hidden = true; $("locToggle").textContent = "Ver en el mapa"; } };
  const search = async ()=>{
    let q = $("locQ").value.trim();
    if(q && /^https?:\/\//.test(q)){ $("locQ").value = ""; return useMapsLink(q); }
    if(!q) q = $("locQ").value = [$("fTitle").value.trim(), $("fZonaIn").value.trim()].filter(Boolean).join(", ");
    if(!q){ $("locRes").innerHTML = `<span class="hint">Escribí el nombre del lugar o la dirección.</span>`; return; }
    $("locRes").innerHTML = `<span class="hint">Buscando…</span>`;
    try{
      const r = await fetch(`${NOM}/search?format=jsonv2&limit=5&addressdetails=1&countrycodes=ar&accept-language=es&q=${encodeURIComponent(q)}`);
      const data = await r.json();
      if(!data.length){ $("locRes").innerHTML = `<span class="hint">No lo encontré. Probá con la dirección (calle y número) o tocá “Ver en el mapa” y marcalo.</span>`; return; }
      $("locRes").innerHTML = data.map((d,n)=>`<button type="button" data-r="${n}">${esc(d.display_name)}</button>`).join("");
      $("locRes").querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{
        const d = data[+b.dataset.r];
        putZona(zonaFrom(d.address));
        if(!$("fTitle").value.trim() && d.name) $("fTitle").value = d.name.slice(0, 120);
        setLoc({ lat:d.lat, lng:d.lon }, true);
        $("locRes").innerHTML = ""; $("locQ").value = "";
      });
    }catch{ $("locRes").innerHTML = `<span class="hint">No se pudo buscar. Revisá la conexión o marcalo en el mapa.</span>`; }
  };
  $("locGo").onclick = search;
  $("locQ").addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); search(); } });
  $("locQ").addEventListener("paste", ()=>setTimeout(()=>{ const v = $("locQ").value.trim(); if(/^https?:\/\//.test(v) && isMaps(v)){ $("locQ").value = ""; useMapsLink(v); } }, 0));
  $("locMe").onclick = ()=>{
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p=>setLoc({ lat:p.coords.latitude, lng:p.coords.longitude }, true, true), ()=>toast("No pude obtener tu ubicación."), { enableHighAccuracy:true, timeout:10000 });
  };
  $("locClear").onclick = ()=>setLoc(null);
  locTxt();
  linkHint();
  if(!loc && mapsLink){ const c = coordsFromUrl(mapsLink); if(c) setLoc(c, false); }
  if(pre.openMap) openMap();

  /* completar con la descripción del reel (todo se lee acá, no se guarda ni se manda) */
  const auto = {};   // lo que ya completó esto, para poder corregirlo si cambia el texto
  const canFill = (id, key) => { const v = $(id).value.trim(); return !v || v === auto[key]; };
  let locAuto = false;
  const fillFromCaption = async ()=>{
    const txt = $("fCap").value, h = $("capHint");
    if(!txt.trim()){ h.hidden = true; return; }
    const r = parseCaption(txt, zonas), done = [];
    if(r.zona && canFill("fZonaIn","zona")){ $("fZonaIn").value = auto.zona = r.zona; zonaAuto = ""; locTxt(); done.push("barrio " + r.zona); }
    if(r.name && canFill("fTitle","title")){ $("fTitle").value = auto.title = r.name; done.push("nombre"); }
    if(r.list && r.list!=="actividad" && !item && !listTouched && r.list !== list){ pickList(r.list); done.push(catOf(r.list).label.toLowerCase()); }
    h.hidden = false;
    h.textContent = done.length ? "Completé: " + done.join(" · ") + ". Revisalo." : "No encontré barrio ni nombre. Completalo a mano.";
    if(r.address && (!loc || locAuto) && navigator.onLine !== false){
      const q = [r.address, $("fZonaIn").value.trim(), "Buenos Aires"].filter(Boolean).join(", ");
      $("locQ").value = q;
      try{
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&accept-language=es&q=${encodeURIComponent(q)}`);
        const d = (await res.json())[0];
        if(d && $("capHint")){ setLoc({ lat:+d.lat, lng:+d.lon }, true); locAuto = true; h.textContent += ` Ubiqué ${r.address} en el mapa.`; }
      }catch{}
    }
  };
  $("capOpen").onclick = ()=>{ $("capOpen").hidden = true; $("capPanel").hidden = false; $("fCap").focus(); };
  $("capGo").onclick = fillFromCaption;
  $("fCap").addEventListener("paste", ()=>setTimeout(fillFromCaption, 0));
  if($("capPaste")) $("capPaste").onclick = async ()=>{
    try{ const t = await navigator.clipboard.readText(); if(t){ $("fCap").value = t.slice(0,5000); fillFromCaption(); } else toast("No hay nada copiado."); }
    catch{ toast("No pude leer lo copiado. Mantené apretado el cuadro y elegí Pegar."); }
  };
  if(pre.caption){ $("fCap").value = pre.caption; fillFromCaption(); }

  /* acciones */
  $("fCancel").onclick = closeSheet;
  if($("fPlan")) $("fPlan").onchange = e=>{
    const p = state.plans.find(x=>x.id===e.target.value); if(!p) return;
    if((p.stops||[]).length >= 30) return toast("Ese plan ya tiene 30 paradas.");
    store.savePlan(p.id, { stops:(p.stops||[]).concat(item.id), updatedAt:Date.now() });
    notifyOthers(state.gid, "plan", { ...p, stops:(p.stops||[]).concat(item.id) }, "edit");
    toast("Sumado a " + p.title); closeSheet();
  };
  if($("fNewPlan")) $("fNewPlan").onclick = ()=>planSheet(null, item.id);
  if(item && item.done) $("fMem").onclick = ()=>doneSheet(item);
  if(item) $("fDel").onclick = ()=>{
    $("delRow").innerHTML = `<button type="button" class="btn ghost" id="dNo">No, dejarlo</button><button type="button" class="btn danger" id="dYes">Sí, borrar</button>`;
    $("dNo").onclick = ()=>itemForm(item);
    $("dYes").onclick = ()=>{ removeItem(item.id); closeSheet(); toast("Borrado"); };
  };
  $("itemForm").onsubmit = e=>{
    e.preventDefault();
    const title = $("fTitle").value.trim(), link = $("fLink").value.trim(), maps = mapsLink;
    if(!title) return showErr("Poné un nombre.");
    if(link && !safeUrl(link)) return showErr("El link tiene que empezar con https://");
    if(maps && !safeUrl(maps)) return showErr("El link de Maps tiene que empezar con https://");
    let zona = $("fZonaIn").value.trim();
    const same = zonas.find(z=>norm(z)===norm(zona)); if(same) zona = same;
    const date = $("fDate").value || "", time = $("fTime").value || "";
    if(time && !date) return showErr("Elegí también el día.");
    const data = { list, title, note:$("fNote").value.trim(), zona, tags, link, maps, price, lat:loc?loc.lat:null, lng:loc?loc.lng:null, date, time };
    const gid = $("fGid") ? $("fGid").value : state.gid;
    if(item){
      const changed = Object.keys(data).some(k=>JSON.stringify(data[k] ?? "")!==JSON.stringify(item[k] ?? ""));
      store.save(item.id, data);
      if(changed) notifyOthers(state.gid, "item", { ...item, ...data, id:item.id }, "edit");
    }
    else {
      const nid = store.newId(), nd = { ...data, done:false, rating:0, doneAt:0, memory:"", hasPhoto:false, createdAt:Date.now(), createdBy:state.me.uid };
      store.save(nid, nd, gid);
      notifyOthers(gid, "item", { id:nid, ...nd });
      if(gid===state.gid){ if(state.tab!=="todas") state.tab = list; if(["done","planes","calendario"].includes(state.view)){ state.view = "pend"; } stopSelecting(true); }
    }
    state.mapFitted = false;
    const other = gid!==state.gid && state.lists.find(l=>l.id===gid);
    closeSheet(); render(); toast(item ? "Guardado" : other ? `Agregado a “${other.name}”` : "Agregado a " + catOf(list).label);
  };
}

/* achica la foto para guardarla en la base de datos (menos de ~900 KB) */
async function shrinkToDataUrl(file){
  const bmp = await createImageBitmap(file);
  let max = 1280, q = .74, out = "";
  for(let n=0; n<6; n++){
    const s = Math.min(1, max/Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width*s); c.height = Math.round(bmp.height*s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    out = c.toDataURL("image/jpeg", q);
    if(out.length < 900000) return out;
    max = Math.round(max*.8); q = Math.max(.5, q-.06);
  }
  return out.length < 1000000 ? out : "";
}

function doneSheet(item){
  let rating = item.done ? myRating(item) : 0, file = null, removePhoto = false;
  const today = new Date().toISOString().slice(0,10);
  const curDate = item.doneAt ? new Date(item.doneAt).toISOString().slice(0,10) : today;
  openSheet(`
    <h2>${item.done?"Recuerdo":"¡Hecho!"}</h2>
    <div class="note" style="margin-top:-8px">${esc(item.title)}</div>
    <div class="lbl">${item.done ? "Tu puntaje" : "¿Qué tal estuvo?"}
      <div class="starpick" id="sp">${[1,2,3,4,5].map(n=>`<button type="button" data-s="${n}" aria-label="${n} de 5">★</button>`).join("")}</div></div>
    <label>Fecha<input id="dDate" type="date" value="${curDate}" max="${today}"></label>
    <label>Recuerdo<textarea id="dMem" maxlength="500" placeholder="Qué pidieron, qué les gustó, algo para acordarse…">${esc(item.memory)}</textarea></label>
    <div class="lbl">Foto
      <div class="photo-pick">
        <img class="prev" id="dPrev" alt="" hidden>
        <span class="filebtn"><span id="dFileTxt">${item.hasPhoto?"Cambiar foto":"Elegir foto"}</span><input id="dFile" type="file" accept="image/*" aria-label="Elegir foto"></span>
        ${item.hasPhoto?`<button type="button" class="linkbtn" id="dNoPhoto">Quitar foto</button>`:""}
      </div></div>
    <div class="err" id="fErr" hidden></div>
    <div class="row"><button type="button" class="btn ghost" id="dCancel">Cancelar</button><button type="button" class="btn primary" id="dOk">Guardar</button></div>`);
  if(item.hasPhoto){ $("dPrev").dataset.ph = item.id; $("dPrev").hidden = false; hydratePhotos($("sheet")); }
  const paint = ()=>$("sp").querySelectorAll("button").forEach(b=>b.classList.toggle("on", +b.dataset.s<=rating));
  $("sp").querySelectorAll("button").forEach(b=>b.onclick=()=>{ rating = rating===+b.dataset.s ? 0 : +b.dataset.s; paint(); });
  paint();
  $("dFile").onchange = e=>{
    file = e.target.files && e.target.files[0] || null; removePhoto = false;
    if(file){ const p=$("dPrev"); p.removeAttribute("data-ph"); p.src = URL.createObjectURL(file); p.hidden=false; $("dFileTxt").textContent="Cambiar foto"; }
  };
  if($("dNoPhoto")) $("dNoPhoto").onclick = ()=>{ removePhoto = true; file = null; $("dPrev").hidden = true; $("dNoPhoto").hidden = true; $("dFileTxt").textContent="Elegir foto"; };
  $("dCancel").onclick = closeSheet;
  $("dOk").onclick = async ()=>{
    const btn = $("dOk"); btn.disabled = true;
    const d = $("dDate").value;
    const data = { done:true, ratings:{ [state.me.uid]: rating }, doneAt: d ? new Date(d+"T12:00:00").getTime() : Date.now(), memory:$("dMem").value.trim() };
    try{
      if(file){
        btn.textContent = "Guardando foto…";
        const url = await shrinkToDataUrl(file);
        if(!url) throw { code:"too-large" };
        photoCache.set(item.id, Promise.resolve(url));
        store.setPhoto(item.id, url).catch(()=>toast("La foto se va a subir cuando vuelva la conexión."));
        data.hasPhoto = true;
      } else if(removePhoto){ data.hasPhoto = false; photoCache.delete(item.id); store.delPhoto(item.id); }
      const wasDone = !!item.done, before = { memory:item.memory || "", rating:myRating(item), doneAt:item.doneAt || 0 };
      item.ratings = { ...(item.ratings || {}), [state.me.uid]: rating };
      store.save(item.id, data);
      const act = !wasDone ? "done" : file ? "photo" : data.memory!==before.memory ? "memory"
        : rating!==before.rating ? "rate" : (removePhoto || data.doneAt!==before.doneAt) ? "edit" : "";
      if(act) notifyOthers(state.gid, "item", { ...item, ...data, ratings:item.ratings, id:item.id }, act);
      closeSheet(); render();
    }catch(e){
      btn.disabled = false; btn.textContent = "Guardar";
      $("fErr").hidden = false;
      $("fErr").textContent = e && e.code==="too-large" ? "La foto es muy pesada. Probá con otra." : "No se pudo leer la foto. Probá con otra (JPG o PNG).";
    }
  };
}

/* un recuerdo: foto, puntaje, fecha y lo que escribieron */
function photoSheet(item){
  const sub = [catOf(item.list).one, item.zona, item.doneAt ? fmtDate(item.doneAt) : ""].filter(Boolean).join(" · ");
  openSheet(`<i class="grab" aria-hidden="true"></i><h2>${esc(item.title)}</h2>
    <div class="note" style="margin-top:-8px">${esc(sub)}</div>
    ${item.done ? `<div class="rates" id="rates"></div>` : ""}
    ${item.hasPhoto ? `<img class="bigimg" data-ph="${esc(item.id)}" alt="Foto de ${esc(item.title)}">` : ""}
    ${item.memory ? `<div class="memory" style="margin-top:0">${esc(item.memory)}</div>` : `<span class="hint">Todavía no tiene recuerdo ni foto.</span>`}
    <div class="row"><button type="button" class="btn ghost" id="phClose">Cerrar</button><button type="button" class="btn primary" id="phEdit">${item.hasPhoto || item.memory ? "Editar recuerdo" : "Sumar foto o recuerdo"}</button></div>

    <div class="row"><button type="button" class="linkbtn" id="phMore" style="text-align:center">Ver todo y editar</button>${item.done ? `<button type="button" class="linkbtn" id="phUndo" style="text-align:center">Volver a Por hacer</button>` : ""}</div>`);
  hydratePhotos($("sheet"));
  $("phClose").onclick = closeSheet;
  if($("rates")){
    const info = state.group?.memberInfo || {}, me = state.me.uid, many = (state.group?.members || []).length > 1;
    const nameOf = u => u===me ? "Vos" : u==="_" ? "Antes" : ((info[u]?.name || "Alguien").split(" ")[0]);
    const paint = ()=>{
      const r = ratingsOf(item), mine = r[me] || 0, others = Object.entries(r).filter(([u])=>u!==me);
      $("rates").innerHTML = `
        <div class="rrow"><span class="rwho">${many ? "Tu puntaje" : "Puntaje"}</span>
          <div class="starpick" role="group" aria-label="Tu puntaje">${[1,2,3,4,5].map(n=>`<button type="button" data-r="${n}" class="${n<=mine?"on":""}" aria-label="${n} de 5">★</button>`).join("")}</div></div>
        ${others.map(([u,n])=>`<div class="rrow"><span class="rwho">${esc(nameOf(u))}</span><span class="stars">${starsTxt(n)}</span></div>`).join("")}
        ${others.length ? `<div class="ravg">Promedio ${avgHtml(item)}</div>` : many && !mine ? `<span class="hint">Cada uno pone su puntaje; se ve el de todos.</span>` : ""}`;
      $("rates").querySelectorAll("[data-r]").forEach(b=>b.onclick = ()=>{
        const n = +b.dataset.r, cur = ratingsOf(item)[me] || 0;
        rateItem(item, cur===n ? 0 : n); paint(); render();
        toast(cur===n ? "Sacaste tu puntaje" : "Puntaje guardado");
      });
    };
    paint();
  }
  if($("phUndo")) $("phUndo").onclick = ()=>{ store.save(item.id, { done:false, doneAt:0 }); notifyOthers(state.gid, "item", item, "undone"); closeSheet(); toast("Volvió a Por hacer"); };
  $("phEdit").onclick = ()=>doneSheet(item);
  $("phMore").onclick = ()=>itemForm(item);
}

/* ---------- para descubrir: propuestas que junta el robot de GitHub todos los días ---------- */
let discData = null, discLoading = null;
function loadDisc(){
  if(discLoading) return discLoading;
  discLoading = fetch("data/descubrir.json", { cache:"no-cache" }).then(r=>r.ok ? r.json() : null).catch(()=>null)
    .then(d=>{ discData = d; discLoading = null; paintDiscBtn(); renderFinde(!$("vMain").hidden && state.view==="pend" && !state.selecting); return d; });
  return discLoading;
}
const discItems = () => discData ? Object.values(discData.sources || {}).flatMap(s=>s.items || []) : [];
function paintDiscBtn(){
  const n = discItems().length;
  $("discSub").textContent = n ? `${n} propuestas de esta semana en Buenos Aires` : "Propuestas de esta semana en Buenos Aires";
}
const DAYS = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];
/* ---- cuándo pasa cada propuesta: lee "Sábado 24 y domingo 25", "Del martes 20 al sábado 31", "Viernes, 20 h."… ---- */
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const WD = "(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)";
const MES = "(" + MESES.join("|") + ")";
const dayStart = d => { const x = new Date(d); x.setHours(12,0,0,0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const wdIdx = w => DAYS.indexOf(norm(w).replace(/s$/, ""));
function resolveDay(n, mesName, wdName, from, today){
  if(mesName){
    let d = dayStart(new Date(today.getFullYear(), MESES.indexOf(norm(mesName)), n));
    if(d < addDays(today, -180)) d = dayStart(new Date(today.getFullYear()+1, MESES.indexOf(norm(mesName)), n));
    return d;
  }
  const want = wdName ? wdIdx(wdName) : -1, cands = [];
  for(const off of [-1, 0, 1]){ const d = dayStart(new Date(today.getFullYear(), today.getMonth()+off, n)); if(d.getDate()===n) cands.push(d); }
  const match = cands.filter(d=>want<0 || d.getDay()===want);
  const pool = match.length ? match : cands;   // si el día de la semana no coincide (error de la página), confía en el número
  const fromD = from ? dayStart(from+"T12:00:00") : null;
  return pool.sort((a,b)=>Math.abs(a - (fromD||today)) - Math.abs(b - (fromD||today)))[0] || null;
}
function schedOf(d){
  if(d._sched) return d._sched;
  const today = dayStart(new Date()), t = norm(d.when || "");
  const sc = { from: d.from ? dayStart(d.from+"T12:00:00") : null, ranges:[], dates:[], days:(d.days||[]).filter(x=>DAYS.includes(x)) };
  const nwd = norm(WD), nmes = norm(MES);
  const rr = new RegExp(`(?:(del?)\\s+)?(?:${nwd}\\s+)?(\\d{1,2})(?:\\s+de\\s+${nmes})?\\s+al?\\s+(?:${nwd}\\s+)?(\\d{1,2})(?:\\s+de\\s+${nmes})?`, "g");
  let m, rest = t;
  while((m = rr.exec(t))){
    const [, del, w1, n1, m1, w2, n2, m2] = m;
    if(!((del || w1) && (w2 || m2))) continue;                     // "de 11 a 19 h" es un horario, no fechas
    const a = resolveDay(+n1, m1 || (m2 && !w1 ? m2 : null), w1, d.from, today), b = resolveDay(+n2, m2, w2, d.from, today);
    if(a && b){ sc.ranges.push([a, b < a ? addDays(b, 31) : b]); rest = rest.replace(m[0], " "); }
  }
  const rs = new RegExp(`${nwd}\\s+(\\d{1,2})(?:\\s+de\\s+${nmes})?(?!\\s*(?:h\\b|:|\\d))`, "g");
  while((m = rs.exec(rest))){ const dd = resolveDay(+m[2], m[3], m[1], d.from, today); if(dd) sc.dates.push(+dd); }
  const tm = (d.when || "").replace(/^[^,]*\d{1,2}(?=,)/, "").match(/(\d{1,2})(?::(\d{2}))?\s*(?:a\s+\d|y\s+\d|h)/);
  sc.time = tm ? String(tm[1]).padStart(2,"0") + ":" + (tm[2] || "00") : "";
  sc.recurring = !sc.ranges.length && !sc.dates.length;
  return (d._sched = sc);
}
function occursOn(d, date){
  const sc = schedOf(d), x = +dayStart(date), wd = DAYS[dayStart(date).getDay()];
  if(sc.from && x < +sc.from) return false;
  if(sc.ranges.length) return sc.ranges.some(([a,b])=>x>=+a && x<=+b) && (!sc.days.length || sc.days.includes(wd));
  if(sc.dates.length) return sc.dates.includes(x);
  return sc.days.length ? sc.days.includes(wd) : false;
}
/* próxima fecha (desde hoy) en que pasa; null = sin fecha conocida; false = ya pasó */
function nextDate(d){
  const sc = schedOf(d), today = dayStart(new Date());
  if(sc.recurring && !sc.days.length) return null;
  for(let i=0; i<62; i++){ const day = addDays(today, i); if(occursOn(d, day)) return day; }
  return false;
}
const weekendDays = ()=>{ const t = dayStart(new Date()), out = []; for(let i=0; i<7; i++){ const x = addDays(t, i); if([5,6,0].includes(x.getDay())) out.push(x); if(x.getDay()===0) break; } return out; };
const parseYmd = s => { const [y,m,d] = s.split("-").map(Number); return dayStart(new Date(y, m-1, d)); };
function discMatchesWhen(d, when){
  if(when==="todo") return nextDate(d) !== false;
  if(when.startsWith("d:")) return occursOn(d, parseYmd(when.slice(2)));
  if(when==="hoy") return occursOn(d, new Date());
  return weekendDays().some(x=>occursOn(d, x));
}
/* ordena por día (y hora); lo que no tiene fecha va al final */
function sortByDay(list, when){
  const wk = weekendDays();
  return list.map(d=>{
    const nd = when==="finde" ? (wk.find(x=>occursOn(d, x)) || null) : when==="hoy" ? dayStart(new Date())
      : when.startsWith("d:") ? parseYmd(when.slice(2)) : nextDate(d);
    return { d, nd, k: nd ? +nd : Infinity, r: schedOf(d).recurring ? 1 : 0, tm: schedOf(d).time || "99" };
  }).sort((a,b)=>a.k-b.k || a.r-b.r || a.tm.localeCompare(b.tm) || (b.d.posted||0)-(a.d.posted||0));
}
const dayTitle = date => {
  const t = dayStart(new Date()), diff = Math.round((dayStart(date) - t) / 864e5);
  const s = dayStart(date).toLocaleDateString("es-AR", { weekday:"long", day:"numeric", month:"long" });
  return diff===0 ? "Hoy · " + s : diff===1 ? "Mañana · " + s : s.charAt(0).toUpperCase() + s.slice(1);
};
const inMyList = d => state.items.some(i=>i.link && d.link && i.link===d.link);
/* fecha para el Calendario: solo si la propuesta es de un día puntual (o de pocos días), no una muestra de un mes */
function discDate(d){
  const sc = schedOf(d);
  if(sc.recurring) return null;
  if(sc.ranges.some(([a,b])=>(b - a) > 4*864e5)) return null;
  const nd = nextDate(d);
  return nd ? { date:ymd(nd), time:sc.time || "" } : null;
}
function addDisc(d){
  if(!state.gid || !state.me) return false;
  const note = [d.when, d.place].filter(Boolean).join(" · ").slice(0, 400);
  const when = discDate(d);
  const nid = store.newId(), nd = { list:d.cat || "actividad", title:d.title.slice(0, 120), note, zona:(d.zona||"").slice(0, 60),
    tags: d.free ? ["Gratis"] : [], link:d.link, maps:"", price:0,
    lat: typeof d.lat==="number" ? d.lat : null, lng: typeof d.lng==="number" ? d.lng : null,
    date: when ? when.date : "", time: when ? when.time : "",
    done:false, rating:0, doneAt:0, memory:"", hasPhoto:false, createdAt:Date.now(), createdBy:state.me.uid };
  store.save(nid, nd);
  notifyOthers(state.gid, "item", { id:nid, ...nd });
  toast(`Agregado a “${state.group?.name || "tu lista"}”` + (when ? ` · ${when.date===todayStr() ? "hoy" : fmtDay(when.date)}${when.time ? " " + when.time : ""} en el Calendario` : ""));
  return true;
}
function discSheet(){
  let f = { when:"todo", free:false, cat:"" , q:"", near:null };
  const draw = ()=>{
    const all = discItems();
    const today = DAYS[new Date().getDay()];
    const finde = ["viernes","sabado","domingo"];
    const cats = [...new Set(all.map(d=>d.cat))].filter(Boolean);
    const rows = all.filter(d=>
      (!f.free || d.free) && (!f.cat || d.cat===f.cat)
      && discMatchesWhen(d, f.when)
      && (!f.q || norm([d.title, d.tipo, d.place, d.zona, d.when].join(" ")).includes(norm(f.q)))
      && (!f.near || (typeof d.lat==="number" && distM(f.near, d) <= NEAR_M)));
    // con "Cerca": ordenadas por distancia (sin títulos por día)
    const sorted = f.near ? rows.map(d=>({ d, nd:null, m:distM(f.near, d) })).sort((a,b)=>a.m-b.m) : sortByDay(rows, f.when);
    const dayChips = Array.from({ length:2 }, (_, n)=>{ const x = new Date(); x.setDate(x.getDate()+n);
      const wd = x.toLocaleDateString("es-AR", { weekday:"short" }).replace(".","");
      return ["d:" + ymd(x), n===0 ? "Hoy" : n===1 ? "Mañana" : wd.charAt(0).toUpperCase() + wd.slice(1) + " " + x.getDate()]; });
    const pickedOther = f.when.startsWith("d:") && !dayChips.some(([v])=>v===f.when);
    const upd = discData && Object.values(discData.sources||{}).map(s=>s.updated).filter(Boolean).sort().pop();
    const failed = discData ? Object.entries(discData.sources||{}).filter(([,s])=>s.ok===false).map(([k])=>k==="turismo"?"Turismo BA":"Baires Secreta") : [];
    const pill = (k, v, label) => `<button type="button" class="pill" data-df="${k}" data-dv="${esc(v)}" aria-pressed="${String(f[k])===String(v)}">${label}</button>`;
    openSheet(`
      <i class="grab" aria-hidden="true"></i><h2>Para descubrir</h2>
      <p class="hint" style="margin:-6px 0 0">De <a href="https://turismo.buenosaires.gob.ar/es/article/que-hacer-esta-semana" target="_blank" rel="noopener">Turismo Buenos Aires</a> y <a href="https://bairessecreta.com" target="_blank" rel="noopener">Baires Secreta</a>${upd ? " · actualizado " + esc(new Date(upd).toLocaleDateString("es-AR",{ weekday:"short", day:"numeric", month:"short" })) : ""}${failed.length ? ` · hoy no se pudo leer ${esc(failed.join(" ni "))}` : ""}.</p>
      <input id="dQ" type="search" placeholder="Buscar: teatro, Palermo, gratis…" aria-label="Buscar propuestas" value="${esc(f.q)}">
      <div class="pills" id="dDays">${pill("when","todo","Cualquier día")}${dayChips.map(([v, label])=>pill("when", v, label)).join("")}${pill("when","finde","Finde")}
        <button type="button" class="pill daypick" id="dDayBtn" aria-pressed="${pickedOther}">📅 ${pickedOther ? esc(fmtDay(f.when.slice(2))) : "Elegir día"}</button><input id="dDay" type="date" class="ghostdate" tabindex="-1" aria-hidden="true" min="${ymd(new Date())}" value="${pickedOther ? esc(f.when.slice(2)) : ""}"><button type="button" class="pill" data-dfree aria-pressed="${f.free}">Gratis</button><button type="button" class="pill" id="dNear" aria-pressed="${!!f.near}">📍 Cerca</button></div>
      ${f.near ? `<p class="hint" style="margin:-4px 0 0">A menos de 5 km de donde estás, la más cerca primero. Solo las que tienen dirección.</p>` : ""}
      ${cats.length>1 ? `<div class="pills">${pill("cat","","Todos los tipos")}${cats.map(c=>pill("cat", c, `<span class="dot" style="background:${listColor(c)}"></span>${esc(catOf(c).label)}`)).join("")}</div>` : ""}
      <div class="sec">${rows.length} propuesta${rows.length===1?"":"s"}</div>
      <div class="disclist">${!discData ? `<div class="empty"><b>${discLoading ? "Cargando…" : "No se pudieron cargar"}</b>${discLoading ? "" : "Revisá la conexión y probá de nuevo."}</div>`
        : rows.length ? sorted.slice(0, 120).map(({ d, nd, m }, idx, arr)=>{
          const prev = idx ? arr[idx-1].nd : undefined;
          const head = f.near ? "" : (idx===0 || +prev !== +nd) ? `<div class="sec dayhead">${nd ? esc(dayTitle(nd)) : "Sin fecha fija"}</div>` : "";
          const sub = [d.tipo, d.free ? "Gratis" : ""].filter(Boolean).join(" · ");
          const where = [d.place, d.zona && !(d.place||"").includes(d.zona) ? d.zona : ""].filter(Boolean).join(" · ");
          const added = inMyList(d);
          return head + `<div class="dcard">
            ${d.img ? `<img src="${esc(d.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
            <div class="dbody">
              <span class="dk"><span class="dot" style="background:${listColor(d.cat)}"></span>${esc(sub)}</span>
              <b>${esc(d.title)}</b>
              ${d.when ? `<span class="note">🗓 ${esc(d.when)}</span>` : ""}
              ${where || m!=null ? `<span class="note">📍 ${m!=null ? `<b>${fmtDist(m)}</b>${where ? " · " : ""}` : ""}${esc(where)}</span>` : ""}
              <div class="dact"><a href="${esc(safeUrl(d.link))}" target="_blank" rel="noopener">Ver más ↗</a>
                <button type="button" class="${added?"dadded":"dadd"}" data-dadd="${esc(d.id)}" ${added?"disabled":""}>${added ? "✓ En tu lista" : "+ A mi lista"}</button></div>
            </div></div>`;
        }).join("") : `<div class="empty"><b>Nada con ese filtro</b>Probá con otro día o tipo.</div>`}</div>
      <div class="row"><button type="button" class="btn ghost" id="dClose">Cerrar</button></div>`);
    const sh = $("sheet");
    sh.querySelectorAll("[data-df]").forEach(b=>b.onclick=()=>{ f[b.dataset.df] = b.dataset.dv; draw(); });
    sh.querySelector("[data-dfree]").onclick = ()=>{ f.free = !f.free; draw(); };
    $("dNear").onclick = ()=>{
      if(f.near){ f.near = null; return draw(); }
      $("dNear").textContent = "📍 Buscando…";
      getHere().then(here=>{ f.near = here; if($("dClose")) draw(); })
        .catch(()=>{ toast("No pude saber dónde estás. Revisá el permiso de ubicación."); if($("dNear")) $("dNear").textContent = "📍 Cerca"; });
    };
    $("dDayBtn").onclick = ()=>{ const i = $("dDay"); try{ i.showPicker(); }catch{ i.focus(); i.click(); } };
    $("dDay").onchange = e=>{ f.when = e.target.value ? "d:" + e.target.value : "todo"; draw(); };
    let t; $("dQ").addEventListener("input", e=>{ clearTimeout(t); t = setTimeout(()=>{ f.q = e.target.value.trim(); const pos = e.target.selectionStart; draw(); $("dQ").focus(); try{ $("dQ").setSelectionRange(pos, pos); }catch{} }, 250); });
    $("dClose").onclick = closeSheet;
    sh.querySelectorAll("[data-dadd]").forEach(b=>b.onclick=()=>{
      const d = all.find(x=>x.id===b.dataset.dadd); if(!d) return;
      if(addDisc(d)){ b.textContent = "✓ En tu lista"; b.className = "dadded"; b.disabled = true; }
    });
  };
  draw();
  if(!discData) loadDisc().then(()=>{ if($("dClose")) draw(); });
}

/* "¿Qué hacemos hoy?": una propuesta al azar de Turismo BA y Baires Secreta (no de lo que ya agregaron) */
function pickSheet(){
  const f = { when:"todo", free:false, cat:"" };
  let last = null;
  const DAYS_FINDE = ["viernes","sabado","domingo"];
  const pool = ()=>{
    const today = DAYS[new Date().getDay()];
    return discItems().filter(d=>
      (!f.free || d.free) && (!f.cat || d.cat===f.cat)
      && discMatchesWhen(d, f.when));
  };
  const draw = ()=>{
    const cats = [...new Set(discItems().map(d=>d.cat))].filter(Boolean);
    const pill = (k, v, label) => `<button type="button" class="pill" data-pf="${k}" data-pv="${esc(v)}" aria-pressed="${String(f[k])===String(v)}">${label}</button>`;
    openSheet(`
      <i class="grab" aria-hidden="true"></i><h2>¿Qué hacemos hoy?</h2>
      <p class="hint" style="margin:-6px 0 0">Una idea al azar de lo que pasa en Buenos Aires.</p>
      <div class="pills">${pill("when","todo","Cualquier día")}${pill("when","hoy","Hoy")}${pill("when","finde","Finde")}<button type="button" class="pill" data-pfree aria-pressed="${f.free}">Gratis</button></div>
      ${cats.length>1 ? `<div class="pills">${pill("cat","","De todo")}${cats.map(c=>pill("cat", c, `<span class="dot" style="background:${listColor(c)}"></span>${esc(catOf(c).label)}`)).join("")}</div>` : ""}
      <div class="pick" id="pick" aria-live="polite"></div>
      <div class="row"><button type="button" class="btn ghost" id="pClose">Cerrar</button><button type="button" class="btn primary" id="pAgain">🎲 Otra</button></div>`);
    const sh = $("sheet");
    sh.querySelectorAll("[data-pf]").forEach(b=>b.onclick=()=>{ f[b.dataset.pf] = b.dataset.pv; draw(); });
    sh.querySelector("[data-pfree]").onclick = ()=>{ f.free = !f.free; draw(); };
    $("pClose").onclick = closeSheet;
    $("pAgain").onclick = roll;
    roll();
  };
  const roll = ()=>{
    const box = $("pick"); if(!box) return;
    if(!discData){ box.innerHTML = `<div class="t">${discLoading ? "Buscando ideas…" : "No hay ideas cargadas"}</div><div class="n">${discLoading ? "" : "Revisá la conexión y probá de nuevo."}</div>`; return; }
    let list = pool();
    if(list.length > 1) list = list.filter(d=>d.id!==last);
    if(!list.length){ box.innerHTML = `<div class="t">Nada que coincida</div><div class="n">Probá con otro día o tipo.</div>`; return; }
    const d = list[Math.floor(Math.random()*list.length)]; last = d.id;
    const where = [d.place, d.zona && !(d.place||"").includes(d.zona) ? d.zona : ""].filter(Boolean).join(" · ");
    const added = inMyList(d);
    box.innerHTML = `<div class="k">${esc([catOf(d.cat).one, d.free ? "Gratis" : "", d.src==="secreta" ? "Baires Secreta" : "Turismo BA"].filter(Boolean).join(" · "))}</div>
      <div class="t">${esc(d.title)}</div>
      ${d.when ? `<div class="n">🗓 ${esc(d.when)}</div>` : ""}${where ? `<div class="n">📍 ${esc(where)}</div>` : ""}
      <div class="pick-act"><a href="${esc(safeUrl(d.link))}" target="_blank" rel="noopener">Ver más ↗</a>
        <button type="button" class="pick-add" id="pAdd" ${added?"disabled":""}>${added ? "✓ En tu lista" : "+ A mi lista"}</button></div>`;
    if(!added) $("pAdd").onclick = ()=>{ addDisc(d); $("pAdd").textContent = "✓ En tu lista"; $("pAdd").disabled = true; };
  };
  draw();
  if(!discData) loadDisc().then(()=>{ if($("pClose")) draw(); });
}

function menuSheet(){
  const g = state.group || {}, info = g.memberInfo || {};
  const standalone = matchMedia("(display-mode: standalone)").matches;
  const n = (g.members||[]).length, alone = n <= 1, full = n >= MAX_MEMBERS;
  openSheet(`
    <i class="grab" aria-hidden="true"></i><h2>${esc(g.name || "Lista")}</h2>
    <div id="mRenameBox"><button type="button" class="linkbtn" id="mRename">Cambiar el nombre</button></div>
    ${g.private ? `
      <div class="lnote">🔒 <b>Lista privada.</b> Solo la ves vos: nadie se puede sumar.</div>
      <button type="button" class="btn ghost" id="mShareList">Compartir esta lista con alguien</button>`
    : `
      <div class="members">${(g.members||[]).map(id=>{ const m = info[id]||{}; return `<div><span class="av">${m.photo?`<img src="${esc(m.photo)}" alt="" referrerpolicy="no-referrer">`:esc(initial(m.name))}</span><span>${esc(m.name||"Sin nombre")}${id===state.me.uid?" (vos)":""}</span></div>`; }).join("")}</div>
      ${full ? `<div class="lnote">La lista llegó al máximo de ${MAX_MEMBERS} personas.</div>` : `
      <div class="lbl">Código para sumar a alguien
        <div class="code" id="codeTxt">${esc(g.inviteCode||"—")}</div>
        <span class="hint">La otra persona instala la app, entra con su Google y escribe el código (en “Tengo un código”, o tocando el nombre de la lista → “Sumarme a otra lista”). Hasta ${MAX_MEMBERS} personas.</span></div>
      <div class="row"><button type="button" class="btn ghost" id="mCopy">Copiar código</button>${navigator.share?`<button type="button" class="btn ghost" id="mShare">Enviar invitación</button>`:""}</div>
      <button type="button" class="linkbtn" id="mNew">Cambiar el código (el anterior deja de servir)</button>`}
      ${alone ? `<button type="button" class="linkbtn" id="mPriv">Hacerla privada (solo vos)</button>` : ""}`}
    ${pushAvailable() && !g.private ? `<div class="pushrow"><span aria-hidden="true">🔔</span><div><b>Avisos ${pushOn() ? "activados" : ""}</b><span class="hint">${pushOn() ? "Te avisamos en este celular cuando alguien suma, cambia o marca algo como hecho en tus listas compartidas." : "Enterate cuando alguien suma, cambia o marca algo como hecho."}</span></div>
      <button type="button" class="btn ${pushOn() ? "ghost" : "primary"}" id="mPush">${pushOn() ? "Apagar" : "Activar"}</button></div>` : ""}
    ${state.installEvt && !standalone ? `<button type="button" class="btn primary" id="mInstall">Instalar la app</button>` : ""}
    <div class="row" id="mDangerRow">${alone
      ? `<button type="button" class="btn danger" id="mDelList">Borrar esta lista</button>`
      : `<button type="button" class="btn danger" id="mLeave">Salir de esta lista</button>`}</div>
    <div class="row"><button type="button" class="btn ghost" id="mClose">Cerrar</button><button type="button" class="btn ghost" id="mOut">Cerrar sesión</button></div>
    <span class="hint" style="text-align:center">Versión ${VERSION} · ${esc(state.me.name)}</span>`);
  const fail = m => ()=>toast(m);
  const invite = ()=>`Sumate a la lista “${g.name}” en ¿Qué hacemos hoy?\n${location.origin + location.pathname}\nCódigo: ${g.inviteCode}`;
  $("mRename").onclick = ()=>{
    $("mRenameBox").innerHTML = `<div class="addtag"><input id="mName" type="text" maxlength="40" value="${esc(g.name||"")}" aria-label="Nombre de la lista"><button type="button" id="mNameOk">Guardar</button></div>`;
    $("mName").focus();
    $("mNameOk").onclick = async ()=>{ const v = $("mName").value.trim(); if(!v) return; try{ await store.rename(v); toast("Nombre cambiado"); menuSheet(); }catch{ toast("No se pudo cambiar el nombre."); } };
  };
  if($("mCopy")) $("mCopy").onclick = async ()=>{ try{ await navigator.clipboard.writeText(g.inviteCode); toast("Código copiado"); }catch{ getSelection().selectAllChildren($("codeTxt")); } };
  if($("mShare")) $("mShare").onclick = ()=>navigator.share({ text:invite() }).catch(()=>{});
  if($("mNew")) $("mNew").onclick = async ()=>{ try{ await store.newCode(); toast("Código nuevo listo"); menuSheet(); }catch{ toast("No se pudo cambiar el código. Probá con conexión."); } };
  if($("mShareList")) $("mShareList").onclick = async ()=>{ try{ await store.makeShared(); toast("Listo: pasale el código a quien quieras sumar"); menuSheet(); }catch(e){ console.error(e); fail("No se pudo. Probá con conexión.")(); } };
  if($("mPriv")) $("mPriv").onclick = async ()=>{ try{ await store.makePrivate(); toast("Ahora es privada"); menuSheet(); }catch(e){ console.error(e); fail("No se pudo. Probá con conexión.")(); } };
  const confirmRow = (msg, yes, act)=>{
    $("mDangerRow").innerHTML = `<p class="hint" style="flex-basis:100%;margin:0">${msg}</p><button type="button" class="btn ghost" id="mNo">No</button><button type="button" class="btn danger" id="mYes">${yes}</button>`;
    $("mNo").onclick = menuSheet;
    $("mYes").onclick = async ()=>{ $("mYes").disabled = true; try{ await act(); }catch(e){ console.error(e); toast("No se pudo. Probá con conexión."); menuSheet(); } };
  };
  if($("mLeave")) $("mLeave").onclick = ()=>confirmRow("Vas a dejar de ver esta lista y sus planes. Los demás la siguen teniendo. Para volver, te tienen que pasar el código.", "Sí, salir", async ()=>{
    const gid = state.gid; await store.leave(); closeSheet(); toast("Saliste de la lista"); goToAnotherList(gid);
  });
  if($("mDelList")) $("mDelList").onclick = ()=>confirmRow(`Se borran ${state.items.length} cosa${state.items.length===1?"":"s"}, ${state.plans.length} plan${state.plans.length===1?"":"es"} y las fotos de esta lista. No se puede deshacer.`, "Sí, borrar todo", async ()=>{
    const gid = state.gid; $("mYes").textContent = "Borrando…"; await store.deleteGroup(); closeSheet(); toast("Lista borrada"); goToAnotherList(gid);
  });
  if($("mInstall")) $("mInstall").onclick = async ()=>{ state.installEvt.prompt(); await state.installEvt.userChoice; state.installEvt = null; closeSheet(); };
  if($("mPush")) $("mPush").onclick = async ()=>{
    $("mPush").disabled = true;
    if(pushOn()){ await disablePush(); toast("Avisos apagados en este celular"); } else await enablePush();
    menuSheet(); render();
  };
  $("mClose").onclick = closeSheet;
  $("mOut").onclick = async ()=>{ closeSheet(); stopCal(); state.calPlans = {}; state.items = []; state.plans = []; state.lists = []; state.group = null; state.gid = null; await store.logout(); };
}

/* ---------- eventos ---------- */
$("loginBtn").onclick = async ()=>{ $("loginErr").hidden = true; try{ await store.login(); }catch(e){ loginError(e); } };
$("gLogout").onclick = ()=>store.logout();
let gPriv = true;
document.querySelectorAll("[data-gpriv]").forEach(b=>b.onclick=()=>{ gPriv = b.dataset.gpriv==="1"; document.querySelectorAll("[data-gpriv]").forEach(x=>x.setAttribute("aria-pressed", x===b)); });
$("gCreate").onclick = async ()=>{
  const btn = $("gCreate"); btn.disabled = true; $("gErr").hidden = true;
  try{ enterGroup(await store.createGroup($("gName").value.trim() || "Nuestra lista", gPriv)); refreshLists(); }
  catch(e){ console.error(e); $("gErr").hidden = false; $("gErr").textContent = "No se pudo crear la lista. Revisá la conexión y probá de nuevo."; }
  btn.disabled = false;
};
$("gJoin").onclick = async ()=>{
  const code = $("gCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
  $("gErr").hidden = true;
  if(code.length < 6){ $("gErr").hidden = false; $("gErr").textContent = "El código tiene 6 letras o números."; return; }
  const btn = $("gJoin"); btn.disabled = true;
  try{ enterGroup(await store.joinGroup(code)); refreshLists(); }
  catch(e){ console.error(e); $("gErr").hidden = false; $("gErr").textContent = joinErr(e); }
  btn.disabled = false;
};
$("menuBtn").onclick = menuSheet;
$("listSw").onclick = listsSheet;
$("planes").addEventListener("click", e=>{
  if(e.target.closest("[data-newplan]")) return planSheet(null);
  const b = e.target.closest("[data-plan]");
  if(b){ const p = state.plans.find(x=>x.id===b.dataset.plan); if(p) planSheet(p); }
});
function startSelecting(){
  state.selecting = true; state.sel = new Set(); state.view = "pend";
  if(!state.items.some(i=>inTab(i) && !i.done)) state.tab = "todas";
  render(); toast("Tocá las ideas que querés juntar");
}
function stopSelecting(quiet){ state.selecting = false; state.sel = new Set(); if(!quiet) render(); }
$("juntarBtn").onclick = startSelecting;
$("selCancel").onclick = ()=>stopSelecting();
$("selGo").onclick = ()=>{
  const ids = [...state.sel]; if(!ids.length) return;
  planSheet(null, ids);
};
$("doneSw").addEventListener("click", e=>{ const b = e.target.closest("[data-dv]"); if(b && state.view!==b.dataset.dv){
  state.view = b.dataset.dv;
  const wantDone = state.view==="done";
  if(!state.items.some(i=>inTab(i) && !!i.done===wantDone)) state.tab = "todas";   // si la categoría abierta está vacía, salta a una que tenga algo
  render();
} });
document.querySelectorAll(".bnav [data-view]").forEach(b=>b.onclick=()=>{
  const was = state.view; state.view = b.dataset.view;
  if(b.dataset.view==="pend" && ["pend","done","planes"].includes(was) && was!=="pend") state.view = was;   // ya estás en Para hacer: no cambia la sub-vista
  render(); window.scrollTo(0, 0);
});
$("tabs").addEventListener("click", e=>{ const b=e.target.closest("[data-tab]"); if(b){ state.tab=b.dataset.tab; if(state.q){ state.q=""; $("q").value=""; } render(); } });
let qTimer; $("q").addEventListener("input", e=>{ clearTimeout(qTimer); qTimer = setTimeout(()=>{ state.q = e.target.value.trim(); render(); }, 150); });
$("filters").addEventListener("change", e=>{
  if(e.target.id==="fZona"){ state.zona = e.target.value; render(); }
  if(e.target.id==="fAct"){ const v = e.target.value;
    state.tab = v.startsWith("t:") ? v.slice(2) : "todas"; state.tag = v.startsWith("g:") ? v.slice(2) : ""; render(); }
});
$("filters").addEventListener("click", e=>{
  const t = e.target.closest("[data-tagf]");
  if(t){ state.tag = norm(state.tag)===norm(t.dataset.tagf) ? "" : t.dataset.tagf; render(); return; }
  if(e.target.closest("#fClear")){ state.zona=""; state.tag=""; state.tab="todas"; state.q=""; $("q").value=""; render(); }
});
$("zonaChips").addEventListener("click", e=>{
  const b = e.target.closest("[data-mz]"); if(!b) return;
  const k = b.dataset.mz;
  if(k===NOZONA) return zonaSheet(k);   // sin barrio no tiene lugar en el mapa: se abre la lista
  state.mapZona = state.mapZona===k ? "" : k; state.mapFitted = false; state.near = null; renderMap();
});
$("nearBtn").onclick = findNear;
$("nearBox").addEventListener("click", e=>{
  if(e.target.closest("[data-nearoff]")){ state.near = null; state.mapFitted = false; return renderMap(); }
  const nd = e.target.closest("[data-neardisc]");
  if(nd){ const d = discItems().find(x=>x.id===nd.dataset.neardisc); if(d && addDisc(d)) renderMap(); return; }
  const b = e.target.closest("[data-near]"); if(!b) return;
  const it = state.items.find(x=>x.id===b.dataset.near); if(it) itemForm(it);
});
$("pushAsk").addEventListener("click", async e=>{
  if(e.target.closest("[data-pnot]")){ setPushPref("later"); render(); toast("Cuando quieras, lo activás tocando las caritas de arriba"); return; }
  const b = e.target.closest("[data-pon]"); if(!b) return;
  b.disabled = true; await enablePush(); render();
});
$("finde").addEventListener("click", e=>{
  const fi = e.target.closest("[data-fitem]"); if(fi){ const it = state.items.find(x=>x.id===fi.dataset.fitem); if(it) itemForm(it); return; }
  const fp = e.target.closest("[data-fplan]"); if(fp){ const p = state.plans.find(x=>x.id===fp.dataset.fplan); if(p) planSheet(p); return; }
  if(e.target.closest("[data-fother]")){ const cur = state.findeIdea; state.findeIdea = ""; const pool = discItems().filter(d=>discMatchesWhen(d,"finde") && !inMyList(d) && d.id!==cur); if(pool.length) state.findeIdea = pool[Math.floor(Math.random()*pool.length)].id; return render(); }
  if(e.target.closest("[data-fadd]")){ const d = findeIdea(); if(d && addDisc(d)){ state.findeIdea = ""; setTimeout(render, 50); } }
});
$("mapFilters").addEventListener("click", e=>{
  const b = e.target.closest("[data-ml]");
  if(b){ const k = b.dataset.ml; state.mapHidden.has(k) ? state.mapHidden.delete(k) : state.mapHidden.add(k); renderMap(); return; }
  if(e.target.closest("#mlDone")){ state.mapShowDone = !state.mapShowDone; renderMap(); }
});
$("heroBtn").onclick = pickSheet;
$("discBtn").onclick = ()=>{ discSheet(); loadDisc().then(()=>{ if($("dClose")) discSheet(); }); };
$("addBtn").onclick = ()=>state.view==="planes" ? startSelecting() : state.view==="calendario" ? planSheet(null, null, state.calDay) : itemForm(null);
$("cal").addEventListener("click", e=>{
  const nav = e.target.closest("[data-calnav]");
  if(nav){ const [y,m] = state.calMonth.split("-").map(Number), d = new Date(y, m-1+(+nav.dataset.calnav), 1); state.calMonth = ymd(d).slice(0,7); state.calDay = ""; return renderCal(); }
  if(e.target.closest("[data-caltoday]")){ state.calMonth = todayStr().slice(0,7); state.calDay = todayStr(); return renderCal(); }
  const day = e.target.closest("[data-day]");
  if(day){ state.calDay = state.calDay===day.dataset.day ? "" : day.dataset.day; return renderCal(); }
  const ci = e.target.closest("[data-calitem]");
  if(ci){
    const [gid, id] = ci.dataset.calitem.split("|");
    if(gid===state.gid){ const it = state.items.find(x=>x.id===id); if(it) itemForm(it); return; }
    state.pendingItem = { gid, id }; enterGroup(gid); return;
  }
  const pc = e.target.closest("[data-calplan]");
  if(pc){
    const [gid, pid] = pc.dataset.calplan.split("|");
    if(gid===state.gid){ const p = state.plans.find(x=>x.id===pid); if(p) planSheet(p); return; }
    state.pendingPlan = { gid, pid }; enterGroup(gid);
  }
});
$("list").addEventListener("click", e=>{
  if(state.selecting){
    if(e.target.closest("a")) return;
    const s = e.target.closest("[data-sel]"); if(!s) return;
    const id = s.dataset.sel;
    if(state.sel.has(id)) state.sel.delete(id); else if(state.sel.size < 30) state.sel.add(id); else toast("Un plan puede tener hasta 30 paradas.");
    return render();
  }
  const lk = e.target.closest("[data-like]");
  if(lk) return toggleLike(lk.dataset.like);
  const ph = e.target.closest("[data-photo],[data-mem]");
  if(ph){ const it = state.items.find(i=>i.id===(ph.dataset.photo || ph.dataset.mem)); if(it) photoSheet(it); return; }
  const c = e.target.closest("[data-check]"), ed = e.target.closest("[data-edit]");
  if(!c && !ed) return;
  const item = state.items.find(i=>i.id===(c||ed).dataset[c?"check":"edit"]);
  if(!item) return;
  if(ed) return itemForm(item);
  if(item.done){ store.save(item.id, { done:false, doneAt:0 }); notifyOthers(state.gid, "item", item, "undone"); toast("Volvió a Por hacer"); }
  else doneSheet(item);
});
$("changelog").innerHTML = CHANGELOG.map(([v,t])=>`<li><b>${v}</b> · ${esc(t)}</li>`).join("");

window.addEventListener("beforeinstallprompt", e=>{
  e.preventDefault(); state.installEvt = e;
  if(!$("vMain").hidden) banner("Instalá la app para poder compartir reels desde Instagram.", "Instalar", async ()=>{ e.prompt(); await e.userChoice; state.installEvt = null; banner(""); });
});
window.addEventListener("appinstalled", ()=>{ state.installEvt = null; banner(""); toast("App instalada"); });
if("serviceWorker" in navigator && !DEMO_MODE) navigator.serviceWorker.register("sw.js").catch(()=>{});

/* ---------- inicio ---------- */
state.share = readShare();
state.openAt = readOpen();
if(state.share || state.openAt) history.replaceState(null, "", location.pathname + location.hash);
// con la app abierta, tocar un aviso la trae al frente y abre eso
if("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e=>{
  const u = e.data && e.data.qhhOpen; if(!u) return;
  try{ const p = new URL(u, location.href).searchParams; openTarget({ gid:p.get("g"), i:p.get("i"), p:p.get("p") }); }catch{}
});
store = DEMO_MODE ? demoStore() : firebaseStore();
loadDisc();
store.start(onUser);
