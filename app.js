/* ¿Qué hacemos hoy? — app instalable (PWA) con Firebase */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, writeBatch, arrayUnion }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBB2YeVAAisCXTyfRAPm0MIHLUPv_JP9eg",
  authDomain: "que-hacemos-hoy-59b81.firebaseapp.com",
  projectId: "que-hacemos-hoy-59b81",
  storageBucket: "que-hacemos-hoy-59b81.firebasestorage.app",
  messagingSenderId: "484182237158",
  appId: "1:484182237158:web:62d2b437e50df691e14027"
};

const VERSION = "0.4.1";
const CHANGELOG = [
  ["0.4.1","Más seguridad: la lista admite hasta 2 personas, solo vale el código vigente, se controlan los datos que se guardan y se verifica la librería del mapa."],
  ["0.4.0","App instalable para Android: entrar con Google, lista compartida con código de invitación, compartir reels desde Instagram, mapa con un pin por lugar y funciona sin conexión."],
  ["0.3.0","Vista Barrios, links de Instagram reconocidos y campo aparte para la ubicación en Maps."],
  ["0.2.0","Barrio o zona, etiquetas, buscador y filtros, foto y recuerdo al marcar algo como hecho, número de versión."],
  ["0.1.1","Paleta nueva: verdes, amarillo y azul."],
  ["0.1.0","Primera versión: tres listas compartidas, “¿Qué hacemos hoy?”, marcar como hecho con fecha y estrellas."]
];
const LISTS = {
  actividad:{label:"Actividades", one:"Actividad"},
  comer:{label:"Para comer", one:"Para comer"},
  visitar:{label:"Para visitar", one:"Para visitar"}
};
const BASE_TAGS = ["Día de lluvia","Aniversario","Con amigos","Al aire libre","Romántico","Para el finde"];
const BA = [-34.6037, -58.3816];
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const state = { items:[], tab:"actividad", view:"pend", q:"", zona:"", tag:"",
  me:null, group:null, gid:null, loaded:false, lastPick:null, share:null, installEvt:null,
  mapShowDone:false, mapLists:new Set(Object.keys(LISTS)), mapFitted:false };
const $ = id => document.getElementById(id);

/* ---------- utilidades ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = u => { try{ const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; }catch{ return ""; } };
const fmtDate = ms => new Date(ms).toLocaleDateString("es-AR",{day:"numeric",month:"short",year:"numeric"});
const priceHtml = p => p ? `<span class="price" aria-label="Precio ${p} de 3">${"$".repeat(p)}<i>${"$".repeat(3-p)}</i></span>` : "";
const starsTxt = r => "★".repeat(r) + "☆".repeat(5-r);
const initial = n => (n || "?").trim().charAt(0).toUpperCase() || "?";
const norm = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
const tagsOf = i => Array.isArray(i.tags) ? i.tags : [];
const hasLoc = i => typeof i.lat === "number" && typeof i.lng === "number";
const hostOf = u => { try{ return new URL(u).hostname.replace(/^www\./,""); }catch{ return ""; } };
const isIG = u => /(^|\.)instagram\.com$/.test(hostOf(u)) || hostOf(u)==="instagr.am";
const isMaps = u => { const h = hostOf(u); return h==="maps.app.goo.gl" || h==="goo.gl" || (/(^|\.)google\.[a-z.]+$/.test(h) && /\/maps/.test(u)) || /^maps\.google\./.test(h); };
const listColor = k => getComputedStyle(document.documentElement).getPropertyValue("--c-"+k).trim() || "#2F7D5B";
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
function show(view){ ["vLoading","vLogin","vGroup","vMain"].forEach(v=>$(v).hidden = v!==view); $("addBtn").hidden = view!=="vMain"; }
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
  let unsubItems = null, unsubGroup = null;
  const itemsPath = () => `groups/${state.gid}/items`;
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
    stop(){ unsubItems && unsubItems(); unsubGroup && unsubGroup(); unsubItems = unsubGroup = null; },
    async myGroupId(){ const s = await getDoc(doc(fs, "users", state.me.uid)); return s.exists() ? (s.data().groupId || null) : null; },
    async createGroup(name){
      const gref = doc(collection(fs, "groups"));
      const code = genCode();
      const b = writeBatch(fs);
      b.set(gref, { name, members:[state.me.uid], memberInfo:{ [state.me.uid]:{ name:state.me.name, photo:state.me.photo } }, inviteCode:code, createdAt:Date.now() });
      b.set(doc(fs, "invites", code), { groupId:gref.id });
      b.set(doc(fs, "users", state.me.uid), { groupId:gref.id });
      await b.commit();
      return gref.id;
    },
    async joinGroup(code){
      const inv = await getDoc(doc(fs, "invites", code));
      if(!inv.exists()) throw { code:"not-found" };
      const gid = inv.data().groupId;
      await updateDoc(doc(fs, "groups", gid), { members:arrayUnion(state.me.uid), ["memberInfo."+state.me.uid]:{ name:state.me.name, photo:state.me.photo }, lastJoinCode:code });
      await setDoc(doc(fs, "users", state.me.uid), { groupId:gid });
      return gid;
    },
    async newCode(){
      const old = state.group.inviteCode, code = genCode();
      const b = writeBatch(fs);
      b.update(doc(fs, "groups", state.gid), { inviteCode:code });
      b.set(doc(fs, "invites", code), { groupId:state.gid });
      if(old) b.delete(doc(fs, "invites", old));
      await b.commit();
    },
    watch(gid, onGroup, onItems, onError){
      this.stop();
      unsubGroup = onSnapshot(doc(fs, "groups", gid), s => onGroup(s.exists() ? s.data() : null), onError);
      unsubItems = onSnapshot(collection(fs, `groups/${gid}/items`), s => onItems(s.docs.map(d=>({ id:d.id, ...d.data() }))), onError);
    },
    newId(){ return doc(collection(fs, itemsPath())).id; },
    save(id, data){ setDoc(doc(fs, itemsPath(), id), data, { merge:true }).catch(report); },
    remove(id){ deleteDoc(doc(fs, itemsPath(), id)).catch(report); deleteDoc(doc(fs, `groups/${state.gid}/photos`, id)).catch(()=>{}); },
    async getPhoto(id){ const s = await getDoc(doc(fs, `groups/${state.gid}/photos`, id)); return s.exists() ? s.data().data : ""; },
    setPhoto(id, data){ return setDoc(doc(fs, `groups/${state.gid}/photos`, id), { data }); },
    delPhoto(id){ deleteDoc(doc(fs, `groups/${state.gid}/photos`, id)).catch(()=>{}); }
  };
}

function demoStore(){
  const photos = new Map();
  let items = [
    { id:"d1", list:"comer", title:"Ejemplo: pizzería de barrio", note:"La de muzza al molde que nos recomendaron", zona:"Almagro", tags:["Con amigos"], price:1, done:false, createdAt:Date.now()-5e8, lat:-34.6097, lng:-58.4206 },
    { id:"d2", list:"actividad", title:"Ejemplo: picnic en los bosques", note:"Llevar mate y manta", zona:"Palermo", tags:["Al aire libre","Para el finde"], price:1, done:false, createdAt:Date.now()-4e8, link:"https://www.instagram.com/reel/EJEMPLO/", lat:-34.5711, lng:-58.4170 },
    { id:"d3", list:"visitar", title:"Ejemplo: un museo nuevo", zona:"Recoleta", tags:["Día de lluvia"], price:2, done:true, rating:4, doneAt:Date.now()-2e8, memory:"Nos quedamos dos horas en la sala de arriba.", createdAt:Date.now()-9e8, lat:-34.5837, lng:-58.3931 },
    { id:"d4", list:"comer", title:"Ejemplo: café de especialidad", zona:"Palermo", tags:[], price:2, done:false, createdAt:Date.now()-3e8 }
  ];
  let onItems = ()=>{};
  const emit = ()=>onItems(items.map(i=>({...i})));
  return {
    start(onUser){ setTimeout(()=>onUser({ uid:"demo", name:"Demo", photo:"" }), 200); },
    async login(){}, async logout(){ location.hash=""; location.reload(); }, stop(){},
    async myGroupId(){ return "demo"; },
    async createGroup(){ return "demo"; }, async joinGroup(){ return "demo"; }, async newCode(){},
    watch(gid, onGroup, oi){ onItems = oi; onGroup({ name:"Lista de prueba", members:["demo"], memberInfo:{ demo:{ name:"Demo" } }, inviteCode:"DEMO42" }); emit(); },
    newId(){ return "d"+Math.random().toString(36).slice(2,9); },
    save(id, data){ const i = items.findIndex(x=>x.id===id); if(i>=0) items[i] = {...items[i], ...data}; else items.push({ id, ...data }); emit(); },
    remove(id){ items = items.filter(x=>x.id!==id); photos.delete(id); emit(); },
    async getPhoto(id){ return photos.get(id) || ""; },
    async setPhoto(id, data){ photos.set(id, data); },
    delPhoto(id){ photos.delete(id); }
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
  try{
    const gid = await store.myGroupId();
    if(gid) return enterGroup(gid);
  }catch(e){ console.error(e); }
  $("helloName").textContent = u.name ? ", " + u.name.split(" ")[0] : "";
  show("vGroup");
}

function enterGroup(gid){
  state.gid = gid; state.loaded = false;
  show("vMain"); render();
  store.watch(gid,
    g => { if(!g || !(g.members||[]).includes(state.me.uid)){ store.stop(); show("vGroup"); return; } state.group = g; renderHeader(); render(); },
    items => { state.items = items; state.loaded = true; render(); maybeOpenShare(); },
    e => { console.error(e); if(e && e.code==="permission-denied"){ store.stop(); $("helloName").textContent = ""; show("vGroup"); } else banner("Se cortó la conexión con la lista. Volvé a abrir la app."); });
}

function maybeOpenShare(){
  if(!state.share) return;
  const s = state.share; state.share = null;
  const guessList = isIG(s.url) || !s.url ? state.tab : state.tab;
  itemForm(null, { link:s.url, note:s.text, title:s.title, list:guessList, fromShare:true });
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

function renderFilters(){
  const zonas = allZonas();
  const usedTags = uniq([].concat(...state.items.map(tagsOf)));
  if(state.zona && !zonas.some(z=>norm(z)===norm(state.zona))) state.zona = "";
  if(state.tag && !usedTags.some(t=>norm(t)===norm(state.tag))) state.tag = "";
  const active = state.zona || state.tag || state.q;
  $("filters").innerHTML =
    (zonas.length ? `<select id="fZona" aria-label="Filtrar por zona"><option value="">Todas las zonas</option>${zonas.map(z=>`<option value="${esc(z)}" ${norm(z)===norm(state.zona)?"selected":""}>${esc(z)}</option>`).join("")}</select>` : "") +
    usedTags.map(t=>`<button type="button" class="fchip" data-tagf="${esc(t)}" aria-pressed="${norm(t)===norm(state.tag)}">${esc(t)}</button>`).join("") +
    (active ? `<button type="button" class="fchip clear" id="fClear">Limpiar</button>` : "");
  $("filters").hidden = !zonas.length && !usedTags.length && !active;
}

function itemMeta(i, opts={}){
  const by = (state.group && state.group.memberInfo && state.group.memberInfo[i.createdBy] || {}).name || "";
  return [
    opts.showList ? `<span class="zone" style="font-weight:500"><span class="dot" style="background:${listColor(i.list)}"></span>${esc(LISTS[i.list]?.label||"")}</span>` : "",
    i.zona ? `<span class="zone">${PIN}${esc(i.zona)}</span>` : "",
    priceHtml(i.price),
    ...tagsOf(i).map(t=>`<span class="tag">${esc(t)}</span>`),
    linksHtml(i),
    i.done ? `<span class="chip">Hecho ${i.doneAt?fmtDate(i.doneAt):""}</span>` : "",
    i.done && i.rating ? `<span class="stars" aria-label="${i.rating} de 5">${starsTxt(i.rating)}</span>` : "",
    !opts.short && by ? `<span>Agregó ${esc(by.split(" ")[0])}</span>` : ""
  ].filter(Boolean).join("");
}

function render(){
  $("ver").textContent = VERSION;
  const pend = state.items.filter(i=>!i.done).length, done = state.items.filter(i=>i.done).length;
  $("listName").textContent = state.group?.name || "Nuestra lista";
  $("summary").textContent = state.loaded ? `${pend} pendiente${pend===1?"":"s"} · ${done} hecho${done===1?"":"s"}` : "Cargando…";

  document.querySelectorAll(".seg [data-view]").forEach(b=>b.setAttribute("aria-pressed", b.dataset.view===state.view));
  const listView = state.view==="pend" || state.view==="done";
  $("tabs").hidden = $("tools").hidden = $("list").hidden = !listView;
  $("zonas").hidden = state.view!=="zonas";
  $("mapWrap").hidden = state.view!=="mapa";
  if(state.view==="zonas") return renderZonas();
  if(state.view==="mapa") return renderMap();

  const showDone = state.view==="done", searching = !!state.q;
  $("tabs").innerHTML = Object.entries(LISTS).map(([k,v])=>{
    const n = state.items.filter(i=>i.list===k && !i.done).length;
    return `<button class="tab" role="tab" type="button" data-tab="${k}" aria-selected="${!searching && state.tab===k}">${v.label}<small>${n} pendiente${n===1?"":"s"}</small></button>`;
  }).join("");
  renderFilters();

  const rows = state.items.filter(i=>(searching || i.list===state.tab) && !!i.done===showDone && matches(i))
    .sort((a,b)=> showDone ? (b.doneAt||0)-(a.doneAt||0) : (b.createdAt||0)-(a.createdAt||0));
  const rn = $("resnote"); rn.hidden = !searching;
  if(searching) rn.textContent = `${rows.length} resultado${rows.length===1?"":"s"} en ${showDone?"hechos":"pendientes"} de todas las listas`;

  const list = $("list");
  if(!state.loaded){ list.innerHTML = `<li class="empty"><b>Cargando la lista…</b>Un segundo.</li>`; return; }
  if(!rows.length){
    list.innerHTML = (state.zona || state.tag || state.q)
      ? `<li class="empty"><b>Nada con ese filtro</b>Probá con otra búsqueda o tocá <strong>Limpiar</strong>.</li>`
      : showDone ? `<li class="empty"><b>Todavía nada hecho acá</b>Cuando completen algo, tóquenle el círculo y queda guardado con fecha, puntaje, foto y recuerdo.</li>`
      : `<li class="empty"><b>Lista vacía</b>Tocá <strong>+ Agregar</strong> o compartí un reel desde Instagram.</li>`;
    return;
  }
  list.innerHTML = rows.map(i=>{
    const meta = itemMeta(i, { showList:searching });
    return `<li class="item ${i.done?"is-done":""}">
      <button class="check" type="button" data-check="${esc(i.id)}" aria-label="${i.done?"Marcar como pendiente":"Marcar como hecho"}">${i.done?CHECK:""}</button>
      <div class="body"><div class="title">${esc(i.title)}</div>${i.note?`<div class="note">${esc(i.note)}</div>`:""}${meta?`<div class="meta">${meta}</div>`:""}
        ${i.done && i.memory ? `<div class="memory">${esc(i.memory)}</div>` : ""}
        ${i.done && i.hasPhoto ? `<button type="button" class="thumb" data-photo="${esc(i.id)}" aria-label="Ver foto"><img data-ph="${esc(i.id)}" alt="Foto de ${esc(i.title)}"></button>` : ""}
      </div>
      <button class="more" type="button" data-edit="${esc(i.id)}" aria-label="Editar">⋯</button>
    </li>`;
  }).join("");
  hydratePhotos(list);
}

const photoCache = new Map();
function hydratePhotos(root){
  root.querySelectorAll("img[data-ph]").forEach(async img=>{
    const id = img.dataset.ph;
    try{
      if(!photoCache.has(id)) photoCache.set(id, store.getPhoto(id));
      const src = await photoCache.get(id);
      if(src) img.src = src; else img.closest(".thumb").hidden = true;
    }catch{ photoCache.delete(id); img.closest(".thumb").hidden = true; }
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
function renderZonas(){
  const box = $("zonas");
  if(!state.loaded){ box.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>Cargando…</b></div>`; return; }
  const groups = zonaGroups();
  if(!groups.length){ box.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>Todavía no hay barrios</b>Cuando agreguen algo con barrio o zona, acá se arma una colección por cada uno.</div>`; return; }
  box.innerHTML = groups.map(g=>{
    const pend = g.items.filter(i=>!i.done), done = g.items.length - pend.length;
    const by = Object.entries(LISTS).map(([k,v])=>{ const n = pend.filter(i=>i.list===k).length; return n ? `${n} ${k==="actividad"?(n===1?"actividad":"actividades"):v.label.toLowerCase()}` : ""; }).filter(Boolean).join(" · ");
    return `<button type="button" class="zcard ${g.key===NOZONA?"none":""}" data-zona="${esc(g.key)}">
      <b>${g.key===NOZONA?"":PIN}${esc(g.name)}</b>
      <span class="zn">${pend.length} pendiente${pend.length===1?"":"s"}${done?` · ${done} hecho${done===1?"":"s"}`:""}</span>
      ${by?`<span class="zc">${by}</span>`:""}
      ${g.key===NOZONA?`<span class="zc">Pónganles barrio para ordenarlos</span>`:""}
    </button>`;
  }).join("");
}
function zonaSheet(key){
  let showDone = false;
  const draw = ()=>{
    const g = zonaGroups().find(x=>x.key===key);
    if(!g){ closeSheet(); return; }
    const rows = g.items.filter(i=>!!i.done===showDone).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const secs = Object.entries(LISTS).map(([k,v])=>{
      const r = rows.filter(i=>i.list===k);
      if(!r.length) return "";
      return `<div class="sec">${v.label}</div>` + r.map(i=>{
        const meta = itemMeta(i, { short:true });
        return `<div class="mini ${i.done?"is-done":""}"><button type="button" class="linkbtn" style="color:var(--ink);padding:0" data-zedit="${esc(i.id)}"><span class="title">${esc(i.title)}</span></button>${i.note?`<div class="note">${esc(i.note)}</div>`:""}${meta?`<div class="meta">${meta}</div>`:""}</div>`;
      }).join("");
    }).join("");
    const nDone = g.items.filter(i=>i.done).length;
    openSheet(`
      <h2>${esc(g.name)}</h2>
      <div class="pills"><button type="button" class="pill" id="zP" aria-pressed="${!showDone}">Pendientes</button><button type="button" class="pill" id="zD" aria-pressed="${showDone}">Hechos (${nDone})</button></div>
      ${secs || `<div class="empty"><b>${showDone?"Nada hecho todavía":"Nada pendiente"}</b></div>`}
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
function renderMap(){
  $("mapFilters").innerHTML =
    Object.entries(LISTS).map(([k,v])=>`<button type="button" class="pill" data-ml="${k}" aria-pressed="${state.mapLists.has(k)}"><span class="dot" style="background:${listColor(k)}"></span>${v.label}</button>`).join("") +
    `<button type="button" class="pill" id="mlDone" aria-pressed="${state.mapShowDone}">Incluir hechos</button>`;
  if(!window.L){ $("mapNote").textContent = "El mapa necesita conexión a internet para cargar."; return; }
  if(!bigMap){
    bigMap = L.map("map", { zoomControl:true, attributionControl:true }).setView(BA, 12);
    tiles().addTo(bigMap);
    bigLayer = L.layerGroup().addTo(bigMap);
    bigMap.on("popupopen", e=>{
      const b = e.popup.getElement().querySelector("[data-mapedit]");
      if(b) b.onclick = ()=>{ const it = state.items.find(x=>x.id===b.dataset.mapedit); if(it) itemForm(it); };
    });
  }
  setTimeout(()=>bigMap.invalidateSize(), 60);
  bigLayer.clearLayers();
  const visible = state.items.filter(i=>state.mapLists.has(i.list) && (state.mapShowDone || !i.done));
  const pts = visible.filter(hasLoc);
  pts.forEach(i=>{
    marker(i).bindPopup(`<div class="title">${esc(i.title)}</div>${i.zona?`<div class="note">${esc(i.zona)}</div>`:""}<div class="links" style="margin-top:6px">${linksHtml(i)}</div><button type="button" class="linkbtn" data-mapedit="${esc(i.id)}">Ver y editar →</button>`).addTo(bigLayer);
  });
  if(pts.length && !state.mapFitted){ bigMap.fitBounds(L.latLngBounds(pts.map(i=>[i.lat,i.lng])).pad(.2), { maxZoom:15 }); state.mapFitted = true; }
  const sin = visible.filter(i=>!hasLoc(i));
  $("mapNote").innerHTML = `${pts.length} en el mapa` + (sin.length ? ` · ${sin.length} sin ubicar <button type="button" class="linkbtn" id="mapSin" style="display:inline">Ubicarlos</button>` : "");
  if($("mapSin")) $("mapSin").onclick = ()=>sinUbicarSheet();
}
function sinUbicarSheet(){
  const sin = state.items.filter(i=>!hasLoc(i) && state.mapLists.has(i.list) && (state.mapShowDone || !i.done));
  openSheet(`<h2>Sin ubicar</h2><p class="hint" style="margin:-6px 0 0">Tocá uno para ponerle su lugar en el mapa.</p>
    ${sin.map(i=>`<button type="button" class="mini" data-sin="${esc(i.id)}"><span class="title">${esc(i.title)}</span><span class="note">${esc([LISTS[i.list]?.one, i.zona].filter(Boolean).join(" · "))}</span></button>`).join("")}
    <div class="row"><button type="button" class="btn ghost" id="sClose">Cerrar</button></div>`);
  $("sClose").onclick = closeSheet;
  $("sheet").querySelectorAll("[data-sin]").forEach(b=>b.onclick=()=>{ const it = state.items.find(x=>x.id===b.dataset.sin); if(it) itemForm(it, { openMap:true }); });
}

/* ---------- hojas ---------- */
let sheetMap = null;
function openSheet(html){
  if(sheetMap){ sheetMap.remove(); sheetMap = null; }
  $("sheet").innerHTML = html; $("scrim").hidden = false; $("sheet").scrollTop = 0;
}
function closeSheet(){ if(sheetMap){ sheetMap.remove(); sheetMap = null; } $("scrim").hidden = true; $("sheet").innerHTML = ""; }
$("scrim").addEventListener("click", e=>{ if(e.target.id==="scrim") closeSheet(); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !$("scrim").hidden) closeSheet(); });

function itemForm(item, pre={}){
  const it = item || { list:pre.list||state.tab, title:pre.title||"", note:pre.note||"", zona:pre.zona||"", tags:[], link:pre.link||"", maps:"", price:0 };
  const lk = linksOf(it);
  let tags = tagsOf(it).slice(), list = it.list, price = it.price||0;
  let loc = hasLoc(it) ? { lat:it.lat, lng:it.lng } : null;
  const zonas = allZonas();
  openSheet(`
    <h2>${item?"Editar":pre.fromShare?"Guardar lo compartido":"Agregar"}</h2>
    <form id="itemForm" style="display:flex;flex-direction:column;gap:14px">
      <div class="pills" role="group" aria-label="Lista">${Object.entries(LISTS).map(([k,v])=>`<button type="button" class="pill" data-list="${k}" aria-pressed="${list===k}"><span class="dot" style="background:${listColor(k)}"></span>${v.one}</button>`).join("")}</div>
      <label>Qué es<input id="fTitle" type="text" maxlength="120" required value="${esc(it.title)}" placeholder="Ej.: Parrilla en San Telmo"></label>
      <label>Barrio o zona<input id="fZonaIn" type="text" maxlength="60" list="zonasList" value="${esc(it.zona)}" placeholder="Ej.: Palermo, Tigre, centro">
        <datalist id="zonasList">${zonas.map(z=>`<option value="${esc(z)}"></option>`).join("")}</datalist></label>
      <label>Link del reel o de la web<input id="fLink" type="url" inputmode="url" value="${esc(lk.link)}" placeholder="https://www.instagram.com/reel/…"><span class="lhint" id="fLinkHint" hidden></span></label>
      <div class="lbl">Ubicación en el mapa
        <div class="locbox"><span id="locTxt"></span><button type="button" class="linkbtn" id="locToggle">Elegir en el mapa</button></div>
        <div id="locPanel" hidden style="display:flex;flex-direction:column;gap:8px">
          <div class="addtag"><input id="locQ" type="search" placeholder="Buscar dirección o lugar" aria-label="Buscar en el mapa"><button type="button" id="locGo">Buscar</button></div>
          <div class="results" id="locRes"></div>
          <div id="locMap" class="map small"></div>
          <div class="row" style="gap:8px"><button type="button" class="btn ghost" id="locMe">Usar mi ubicación</button><button type="button" class="btn ghost" id="locClear">Quitar ubicación</button></div>
          <span class="hint">Tocá el mapa para poner el pin donde va.</span>
        </div>
        <label style="margin-top:4px">Link de Google Maps (opcional)<input id="fMaps" type="url" inputmode="url" value="${esc(lk.maps)}" placeholder="https://maps.app.goo.gl/…"></label>
      </div>
      <label>Nota<textarea id="fNote" maxlength="400" placeholder="Qué pedir, cuándo ir, quién lo recomendó…">${esc(it.note)}</textarea></label>
      <div class="lbl">Precio
        <div class="pills" role="group" aria-label="Precio">${[0,1,2,3].map(p=>`<button type="button" class="pill" data-price="${p}" aria-pressed="${price===p}">${p?"$".repeat(p):"Gratis / no sé"}</button>`).join("")}</div></div>
      <div class="lbl">Etiquetas
        <div class="pills" id="tagPills"></div>
        <div class="addtag"><input id="fNewTag" type="text" maxlength="30" placeholder="Otra etiqueta…" aria-label="Nueva etiqueta"><button type="button" id="fAddTag">Sumar</button></div></div>
      ${item && item.done ? `<button type="button" class="linkbtn" id="fMem">Cambiar fecha, puntaje, foto o recuerdo →</button>` : ""}
      <div class="err" id="fErr" hidden></div>
      <div class="row"><button type="button" class="btn ghost" id="fCancel">Cancelar</button><button type="submit" class="btn primary">${item?"Guardar":"Agregar"}</button></div>
      ${item?`<div class="row" id="delRow"><button type="button" class="btn danger" id="fDel">Borrar</button></div>`:""}
    </form>`);
  const sh = $("sheet");
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
  sh.querySelectorAll("[data-list]").forEach(b=>b.onclick=()=>{ list=b.dataset.list; sh.querySelectorAll("[data-list]").forEach(x=>x.setAttribute("aria-pressed", x===b)); if(pin) pin.setStyle({ fillColor:listColor(list) }); });
  sh.querySelectorAll("[data-price]").forEach(b=>b.onclick=()=>{ price=+b.dataset.price; sh.querySelectorAll("[data-price]").forEach(x=>x.setAttribute("aria-pressed", x===b)); });

  /* links */
  const linkHint = ()=>{
    const v = $("fLink").value.trim(), h = $("fLinkHint");
    if(v && isMaps(v) && !$("fMaps").value.trim()){ $("fMaps").value = v; $("fLink").value = ""; mapsChanged(); h.hidden=false; h.textContent="Era un link de Maps: lo pasé a Ubicación."; return; }
    if(v && isIG(v)){ h.hidden=false; h.textContent = /\/(reel|reels|tv)\//.test(v) ? "Reel de Instagram ✓" : "Link de Instagram ✓"; }
    else h.hidden = true;
  };
  $("fLink").addEventListener("input", linkHint);

  /* ubicación */
  let pin = null;
  const locTxt = ()=>{ $("locTxt").textContent = loc ? `📍 Ubicado (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})` : "Sin ubicar todavía"; };
  const setLoc = (ll, pan)=>{
    loc = ll ? { lat:+ll.lat.toFixed(6), lng:+ll.lng.toFixed(6) } : null; locTxt();
    if(!sheetMap) return;
    if(pin){ pin.remove(); pin = null; }
    if(loc){ pin = L.circleMarker([loc.lat, loc.lng], { radius:11, color:"#fff", weight:3, fillColor:listColor(list), fillOpacity:1 }).addTo(sheetMap); if(pan) sheetMap.setView([loc.lat, loc.lng], Math.max(sheetMap.getZoom(), 15)); }
  };
  const mapsChanged = ()=>{ const c = coordsFromUrl($("fMaps").value); if(c){ setLoc(c, true); $("fLinkHint").hidden=false; $("fLinkHint").textContent="Ubicación tomada del link de Maps ✓"; } };
  $("fMaps").addEventListener("input", mapsChanged);
  locTxt();
  const openMap = ()=>{
    $("locPanel").hidden = false; $("locToggle").textContent = "Listo";
    if(!window.L){ $("locRes").innerHTML = `<span class="hint">El mapa necesita conexión a internet.</span>`; return; }
    if(!sheetMap){
      sheetMap = L.map("locMap").setView(loc ? [loc.lat, loc.lng] : BA, loc ? 15 : 12);
      tiles().addTo(sheetMap);
      sheetMap.on("click", e=>setLoc(e.latlng, false));
      setLoc(loc, false);
    }
    setTimeout(()=>sheetMap && sheetMap.invalidateSize(), 80);
    if(!$("locQ").value) $("locQ").value = [$("fTitle").value.trim(), $("fZonaIn").value.trim()].filter(Boolean).join(", ");
  };
  $("locToggle").onclick = ()=>{ if($("locPanel").hidden) openMap(); else { $("locPanel").hidden = true; $("locToggle").textContent = "Elegir en el mapa"; } };
  const search = async ()=>{
    const q = $("locQ").value.trim(); if(!q) return;
    $("locRes").innerHTML = `<span class="hint">Buscando…</span>`;
    try{
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ar&accept-language=es&q=${encodeURIComponent(q)}`);
      const data = await r.json();
      if(!data.length){ $("locRes").innerHTML = `<span class="hint">No lo encontré. Probá con la dirección o tocá el mapa.</span>`; return; }
      $("locRes").innerHTML = data.map((d,n)=>`<button type="button" data-r="${n}">${esc(d.display_name)}</button>`).join("");
      $("locRes").querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{ const d = data[+b.dataset.r]; setLoc({ lat:+d.lat, lng:+d.lon }, true); $("locRes").innerHTML = ""; });
    }catch{ $("locRes").innerHTML = `<span class="hint">No se pudo buscar. Revisá la conexión o tocá el mapa.</span>`; }
  };
  $("locGo").onclick = search;
  $("locQ").addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); search(); } });
  $("locMe").onclick = ()=>{
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p=>setLoc({ lat:p.coords.latitude, lng:p.coords.longitude }, true), ()=>toast("No pude obtener tu ubicación."), { enableHighAccuracy:true, timeout:10000 });
  };
  $("locClear").onclick = ()=>setLoc(null);
  linkHint();
  if(!loc) mapsChanged();
  if(pre.openMap) openMap();

  /* acciones */
  $("fCancel").onclick = closeSheet;
  if(item && item.done) $("fMem").onclick = ()=>doneSheet(item);
  if(item) $("fDel").onclick = ()=>{
    $("delRow").innerHTML = `<button type="button" class="btn ghost" id="dNo">No, dejarlo</button><button type="button" class="btn danger" id="dYes">Sí, borrar</button>`;
    $("dNo").onclick = ()=>itemForm(item);
    $("dYes").onclick = ()=>{ store.remove(item.id); closeSheet(); toast("Borrado"); };
  };
  $("itemForm").onsubmit = e=>{
    e.preventDefault();
    const title = $("fTitle").value.trim(), link = $("fLink").value.trim(), maps = $("fMaps").value.trim();
    if(!title) return showErr("Poné un nombre.");
    if(link && !safeUrl(link)) return showErr("El link tiene que empezar con https://");
    if(maps && !safeUrl(maps)) return showErr("El link de Maps tiene que empezar con https://");
    let zona = $("fZonaIn").value.trim();
    const same = zonas.find(z=>norm(z)===norm(zona)); if(same) zona = same;
    const data = { list, title, note:$("fNote").value.trim(), zona, tags, link, maps, price, lat:loc?loc.lat:null, lng:loc?loc.lng:null };
    if(item) store.save(item.id, data);
    else {
      store.save(store.newId(), { ...data, done:false, rating:0, doneAt:0, memory:"", hasPhoto:false, createdAt:Date.now(), createdBy:state.me.uid });
      state.tab = list; if(state.view==="done") state.view = "pend";
    }
    state.mapFitted = false;
    closeSheet(); render(); toast(item ? "Guardado" : "Agregado a " + LISTS[list].label);
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
  let rating = item.rating || 0, file = null, removePhoto = false;
  const today = new Date().toISOString().slice(0,10);
  const curDate = item.doneAt ? new Date(item.doneAt).toISOString().slice(0,10) : today;
  openSheet(`
    <h2>${item.done?"Recuerdo":"¡Hecho!"}</h2>
    <div class="note" style="margin-top:-8px">${esc(item.title)}</div>
    <div class="lbl">¿Qué tal estuvo?
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
    const data = { done:true, rating, doneAt: d ? new Date(d+"T12:00:00").getTime() : Date.now(), memory:$("dMem").value.trim() };
    try{
      if(file){
        btn.textContent = "Guardando foto…";
        const url = await shrinkToDataUrl(file);
        if(!url) throw { code:"too-large" };
        photoCache.set(item.id, Promise.resolve(url));
        store.setPhoto(item.id, url).catch(()=>toast("La foto se va a subir cuando vuelva la conexión."));
        data.hasPhoto = true;
      } else if(removePhoto){ data.hasPhoto = false; photoCache.delete(item.id); store.delPhoto(item.id); }
      store.save(item.id, data);
      closeSheet(); render();
    }catch(e){
      btn.disabled = false; btn.textContent = "Guardar";
      $("fErr").hidden = false;
      $("fErr").textContent = e && e.code==="too-large" ? "La foto es muy pesada. Probá con otra." : "No se pudo leer la foto. Probá con otra (JPG o PNG).";
    }
  };
}

function photoSheet(item){
  openSheet(`<h2>${esc(item.title)}</h2><img class="bigimg" data-ph="${esc(item.id)}" alt="Foto de ${esc(item.title)}">
    ${item.memory?`<div class="memory" style="margin-top:0">${esc(item.memory)}</div>`:""}
    <div class="row"><button type="button" class="btn ghost" id="phClose">Cerrar</button></div>`);
  hydratePhotos($("sheet"));
  $("phClose").onclick = closeSheet;
}

function pickSheet(){
  let filter = "todo", maxPrice = 3, zona = "", tag = "";
  const zonas = allZonas(), tags = uniq([].concat(...state.items.filter(i=>!i.done).map(tagsOf)));
  openSheet(`
    <h2>¿Qué hacemos hoy?</h2>
    <div class="pills" role="group" aria-label="Qué tipo">${[["todo","Cualquier cosa"],...Object.entries(LISTS).map(([k,v])=>[k,v.label])].map(([k,l])=>`<button type="button" class="pill" data-f="${k}" aria-pressed="${k==="todo"}">${l}</button>`).join("")}</div>
    <div class="pills" role="group" aria-label="Precio máximo">${[[1,"Barato"],[2,"Hasta $$"],[3,"Sin límite"]].map(([p,l])=>`<button type="button" class="pill" data-m="${p}" aria-pressed="${p===3}">${l}</button>`).join("")}</div>
    ${zonas.length||tags.length ? `<div class="pickf">
      ${zonas.length?`<select id="pZona" aria-label="Zona"><option value="">Cualquier zona</option>${zonas.map(z=>`<option value="${esc(z)}">${esc(z)}</option>`).join("")}</select>`:""}
      ${tags.length?`<select id="pTag" aria-label="Etiqueta"><option value="">Cualquier etiqueta</option>${tags.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>`:""}
    </div>` : ""}
    <div class="pick" id="pick" aria-live="polite"></div>
    <div class="row"><button type="button" class="btn ghost" id="pClose">Cerrar</button><button type="button" class="btn primary" id="pAgain">Otra opción</button></div>`);
  const sh = $("sheet");
  const roll = ()=>{
    let pool = state.items.filter(i=>!i.done && (filter==="todo"||i.list===filter) && (i.price||0)<=maxPrice
      && (!zona || norm(i.zona)===norm(zona)) && (!tag || tagsOf(i).some(t=>norm(t)===norm(tag))));
    if(pool.length>1) pool = pool.filter(i=>i.id!==state.lastPick);
    const box = $("pick");
    if(!pool.length){ box.innerHTML = `<div class="t">Nada que coincida</div><div class="n">Probá con otro filtro o agreguen más cosas a la lista.</div>`; return; }
    const p = pool[Math.floor(Math.random()*pool.length)]; state.lastPick = p.id;
    const links = linksHtml(p);
    const k = [LISTS[p.list]?.one, p.zona, p.price ? "$".repeat(p.price) : ""].filter(Boolean).map(esc).join(" · ");
    box.innerHTML = `<div class="k">${k}</div><div class="t">${esc(p.title)}</div>${p.note?`<div class="n">${esc(p.note)}</div>`:""}${links?`<div class="links">${links}</div>`:""}`;
  };
  sh.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{ filter=b.dataset.f; sh.querySelectorAll("[data-f]").forEach(x=>x.setAttribute("aria-pressed",x===b)); roll(); });
  sh.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{ maxPrice=+b.dataset.m; sh.querySelectorAll("[data-m]").forEach(x=>x.setAttribute("aria-pressed",x===b)); roll(); });
  if($("pZona")) $("pZona").onchange = e=>{ zona = e.target.value; roll(); };
  if($("pTag")) $("pTag").onchange = e=>{ tag = e.target.value; roll(); };
  $("pClose").onclick = closeSheet; $("pAgain").onclick = roll;
  roll();
}

function menuSheet(){
  const g = state.group || {}, info = g.memberInfo || {};
  const standalone = matchMedia("(display-mode: standalone)").matches;
  openSheet(`
    <h2>${esc(g.name || "Nuestra lista")}</h2>
    <div class="members">${(g.members||[]).map(id=>{ const m = info[id]||{}; return `<div><span class="av">${m.photo?`<img src="${esc(m.photo)}" alt="" referrerpolicy="no-referrer">`:esc(initial(m.name))}</span><span>${esc(m.name||"Sin nombre")}${id===state.me.uid?" (vos)":""}</span></div>`; }).join("")}</div>
    <div class="lbl">Código para sumar a alguien
      <div class="code" id="codeTxt">${esc(g.inviteCode||"—")}</div>
      <span class="hint">La otra persona instala la app, entra con su Google, toca “Tengo un código” y lo escribe.</span></div>
    <div class="row"><button type="button" class="btn ghost" id="mCopy">Copiar código</button>${navigator.share?`<button type="button" class="btn ghost" id="mShare">Enviar invitación</button>`:""}</div>
    <button type="button" class="linkbtn" id="mNew">Cambiar el código (el anterior deja de servir)</button>
    ${state.installEvt && !standalone ? `<button type="button" class="btn primary" id="mInstall">Instalar la app</button>` : ""}
    <div class="row"><button type="button" class="btn ghost" id="mClose">Cerrar</button><button type="button" class="btn danger" id="mOut">Cerrar sesión</button></div>
    <span class="hint" style="text-align:center">Versión ${VERSION} · ${esc(state.me.name)}</span>`);
  const invite = ()=>`Sumate a nuestra lista en ¿Qué hacemos hoy?\n${location.origin + location.pathname}\nCódigo: ${g.inviteCode}`;
  $("mCopy").onclick = async ()=>{ try{ await navigator.clipboard.writeText(g.inviteCode); toast("Código copiado"); }catch{ getSelection().selectAllChildren($("codeTxt")); } };
  if($("mShare")) $("mShare").onclick = ()=>navigator.share({ text:invite() }).catch(()=>{});
  $("mNew").onclick = async ()=>{ try{ await store.newCode(); toast("Código nuevo listo"); closeSheet(); }catch{ toast("No se pudo cambiar el código. Probá con conexión."); } };
  if($("mInstall")) $("mInstall").onclick = async ()=>{ state.installEvt.prompt(); await state.installEvt.userChoice; state.installEvt = null; closeSheet(); };
  $("mClose").onclick = closeSheet;
  $("mOut").onclick = async ()=>{ closeSheet(); state.items = []; state.group = null; state.gid = null; await store.logout(); };
}

/* ---------- eventos ---------- */
$("loginBtn").onclick = async ()=>{ $("loginErr").hidden = true; try{ await store.login(); }catch(e){ loginError(e); } };
$("gLogout").onclick = ()=>store.logout();
$("gCreate").onclick = async ()=>{
  const btn = $("gCreate"); btn.disabled = true; $("gErr").hidden = true;
  try{ enterGroup(await store.createGroup($("gName").value.trim() || "Nuestra lista")); }
  catch(e){ console.error(e); $("gErr").hidden = false; $("gErr").textContent = "No se pudo crear la lista. Revisá la conexión y probá de nuevo."; }
  btn.disabled = false;
};
$("gJoin").onclick = async ()=>{
  const code = $("gCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
  $("gErr").hidden = true;
  if(code.length < 6){ $("gErr").hidden = false; $("gErr").textContent = "El código tiene 6 letras o números."; return; }
  const btn = $("gJoin"); btn.disabled = true;
  try{ enterGroup(await store.joinGroup(code)); }
  catch(e){ console.error(e); $("gErr").hidden = false; $("gErr").textContent = e && e.code==="not-found" ? "Ese código no existe. Revisá que esté bien escrito." : "No se pudo unir a la lista. Probá de nuevo."; }
  btn.disabled = false;
};
$("menuBtn").onclick = menuSheet;
document.querySelectorAll(".seg [data-view]").forEach(b=>b.onclick=()=>{ state.view = b.dataset.view; render(); });
$("tabs").addEventListener("click", e=>{ const b=e.target.closest("[data-tab]"); if(b){ state.tab=b.dataset.tab; if(state.q){ state.q=""; $("q").value=""; } render(); } });
let qTimer; $("q").addEventListener("input", e=>{ clearTimeout(qTimer); qTimer = setTimeout(()=>{ state.q = e.target.value.trim(); render(); }, 150); });
$("filters").addEventListener("change", e=>{ if(e.target.id==="fZona"){ state.zona = e.target.value; render(); } });
$("filters").addEventListener("click", e=>{
  const t = e.target.closest("[data-tagf]");
  if(t){ state.tag = norm(state.tag)===norm(t.dataset.tagf) ? "" : t.dataset.tagf; render(); return; }
  if(e.target.closest("#fClear")){ state.zona=""; state.tag=""; state.q=""; $("q").value=""; render(); }
});
$("zonas").addEventListener("click", e=>{ const b = e.target.closest("[data-zona]"); if(b) zonaSheet(b.dataset.zona); });
$("mapFilters").addEventListener("click", e=>{
  const b = e.target.closest("[data-ml]");
  if(b){ const k = b.dataset.ml; state.mapLists.has(k) ? state.mapLists.delete(k) : state.mapLists.add(k); renderMap(); return; }
  if(e.target.closest("#mlDone")){ state.mapShowDone = !state.mapShowDone; renderMap(); }
});
$("heroBtn").onclick = pickSheet;
$("addBtn").onclick = ()=>itemForm(null);
$("list").addEventListener("click", e=>{
  const ph = e.target.closest("[data-photo]");
  if(ph){ const it = state.items.find(i=>i.id===ph.dataset.photo); if(it) photoSheet(it); return; }
  const c = e.target.closest("[data-check]"), ed = e.target.closest("[data-edit]");
  if(!c && !ed) return;
  const item = state.items.find(i=>i.id===(c||ed).dataset[c?"check":"edit"]);
  if(!item) return;
  if(ed) return itemForm(item);
  if(item.done){ store.save(item.id, { done:false, doneAt:0 }); toast("Volvió a pendientes"); }
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
if(state.share) history.replaceState(null, "", location.pathname + location.hash);
store = DEMO_MODE ? demoStore() : firebaseStore();
store.start(onUser);
