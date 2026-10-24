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

const VERSION = "0.11.0";
const CHANGELOG = [
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
  actividad:{label:"Actividades", one:"Actividad"},
  comer:{label:"Para comer", one:"Para comer"},
  visitar:{label:"Para visitar", one:"Para visitar"},
  musica:{label:"Música", one:"Música"},
  cine:{label:"Cine", one:"Cine"},
  teatro:{label:"Teatro", one:"Teatro"},
  bares:{label:"Bares", one:"Bar"},
  deporte:{label:"Deporte", one:"Deporte"}
};
const CORE = ["actividad","comer","visitar"];   // siempre visibles; las demás aparecen cuando tienen algo
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
const state = { items:[], plans:[], lists:[], plansLoaded:false, calPlans:{}, calItems:{}, pendingItem:null, calMonth:"", calDay:"", pendingPlan:null, tab:"actividad", view:"pend", q:"", zona:"", tag:"",
  me:null, group:null, gid:null, loaded:false, lastPick:null, share:null, installEvt:null,
  mapShowDone:false, mapHidden:new Set(), mapFitted:false };
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
    leave(){ return updateDoc(doc(fs, "groups", state.gid), { members:arrayRemove(state.me.uid), ["memberInfo."+state.me.uid]:deleteField() }); },
    async deleteGroup(){
      const gid = state.gid, code = state.group && state.group.inviteCode;
      const refs = [];
      for(const sub of ["items", "plans", "photos"]){
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
  const put = (arr, id, d)=>{ const i = arr.findIndex(x=>x.id===id); if(i>=0) arr[i] = {...arr[i], ...d}; else arr.push({ id, ...d }); };
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
  refreshLists();
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
    state.mapFitted = false; photoCache.clear(); banner("");
  }
  state.gid = gid; state.loaded = false; state.plansLoaded = false;
  store.setCurrent(gid);
  show("vMain"); render();
  store.watch(gid,
    g => {
      if(state.gid !== gid) return;
      if(!g || !(g.members||[]).includes(state.me.uid)){ goToAnotherList(gid); return; }
      state.group = g;
      const l = state.lists.find(x=>x.id===gid); if(l) Object.assign(l, g); else state.lists = sortLists(state.lists.concat({ id:gid, ...g }));
      renderHeader(); render();
    },
    items => { if(state.gid !== gid) return; state.items = items; state.loaded = true; render(); maybeOpenShare(); maybeOpenPendingPlan(); },
    plans => { if(state.gid !== gid) return; state.plans = plans; state.plansLoaded = true; if(state.view==="planes") render(); maybeOpenPendingPlan(); },
    e => { console.error(e); if(state.gid !== gid) return; if(e && e.code==="permission-denied") goToAnotherList(gid); else banner("Se cortó la conexión con la lista. Volvé a abrir la app."); });
}

function maybeOpenPendingPlan(){
  const pi = state.pendingItem;
  if(pi && pi.gid === state.gid && state.loaded){
    state.pendingItem = null;
    const it = state.items.find(x=>x.id===pi.id);
    if(it) itemForm(it); else toast("No encontré eso en la lista.");
  }
  const pp = state.pendingPlan;
  if(!pp || pp.gid !== state.gid || !state.loaded || !state.plansLoaded) return;
  state.pendingPlan = null;
  const p = state.plans.find(x=>x.id===pp.pid);
  if(p) planSheet(p); else toast("No encontré ese plan.");
}

/* borra un ítem y lo saca de los planes donde estaba */
function removeItem(id){
  store.remove(id);
  state.plans.filter(p=>(p.stops||[]).includes(id)).forEach(p=>store.savePlan(p.id, { stops:p.stops.filter(x=>x!==id), updatedAt:Date.now() }));
}

function maybeOpenShare(){
  if(!state.share) return;
  const s = state.share; state.share = null;
  const guessList = isIG(s.url) || !s.url ? state.tab : state.tab;
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
    opts.showList ? `<span class="zone" style="font-weight:500"><span class="dot" style="background:${listColor(i.list)}"></span>${esc(catOf(i.list).label)}</span>` : "",
    i.date && !i.done ? `<span class="chip">📅 ${esc(i.date===todayStr() ? "Hoy" : fmtDay(i.date))}${i.time?" · "+esc(i.time)+" h":""}</span>` : "",
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
  $("listName").textContent = state.group?.name || (state.loaded ? "Lista" : "");
  const who = !state.group ? "" : state.group.private ? "🔒 Privada · " : (state.group.members||[]).length > 1 ? `👥 ${(state.group.members||[]).length} personas · ` : "";
  $("summary").textContent = state.loaded ? `${who}${pend} pendiente${pend===1?"":"s"} · ${done} hecho${done===1?"":"s"}` : "Cargando…";
  $("addLbl").textContent = state.view==="planes" || state.view==="calendario" ? "Nuevo plan" : "Agregar";

  document.querySelectorAll(".seg [data-view]").forEach(b=>b.setAttribute("aria-pressed", b.dataset.view===state.view));
  const listView = state.view==="pend" || state.view==="done";
  $("tabs").hidden = $("tools").hidden = $("list").hidden = !listView;
  $("zonas").hidden = state.view!=="zonas";
  $("mapWrap").hidden = state.view!=="mapa";
  $("planes").hidden = state.view!=="planes";
  $("cal").hidden = state.view!=="calendario";
  if(state.view!=="calendario") stopCal();
  if(state.view==="zonas") return renderZonas();
  if(state.view==="mapa") return renderMap();
  if(state.view==="planes") return renderPlanes();
  if(state.view==="calendario") return renderCal();

  const showDone = state.view==="done", searching = !!state.q;
  if(!catKeys().includes(state.tab)) state.tab = "actividad";
  $("tabs").innerHTML = catKeys(state.tab).map(k=>[k, catOf(k)]).map(([k,v])=>{
    const n = state.items.filter(i=>i.list===k && !i.done).length;
    return `<button class="tab" role="tab" type="button" data-tab="${esc(k)}" aria-selected="${!searching && state.tab===k}">${esc(v.label)}<small>${n} pendiente${n===1?"":"s"}</small></button>`;
  }).join("");
  const selTab = $("tabs").querySelector('[aria-selected="true"]'), tb = $("tabs");
  if(selTab && (selTab.offsetLeft < tb.scrollLeft || selTab.offsetLeft + selTab.offsetWidth > tb.scrollLeft + tb.clientWidth)) tb.scrollLeft = selTab.offsetLeft - 8;
  renderFilters();

  const rows = state.items.filter(i=>(searching || i.list===state.tab) && !!i.done===showDone && matches(i))
    .sort((a,b)=> showDone ? (b.doneAt||0)-(a.doneAt||0) : (b.createdAt||0)-(a.createdAt||0));
  const rn = $("resnote"); rn.hidden = !searching;
  if(searching) rn.textContent = `${rows.length} resultado${rows.length===1?"":"s"} en ${showDone?"hechos":"pendientes"} de esta lista`;

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
    const by = catKeys().map(k=>[k, catOf(k)]).map(([k,v])=>{ const n = pend.filter(i=>i.list===k).length; return n ? `${n} ${k==="actividad"?(n===1?"actividad":"actividades"):esc(v.label.toLowerCase())}` : ""; }).filter(Boolean).join(" · ");
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
    });
  }
  setTimeout(()=>bigMap.invalidateSize(), 60);
  bigLayer.clearLayers();
  const visible = state.items.filter(i=>!state.mapHidden.has(i.list) && (state.mapShowDone || !i.done));
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
  const sin = state.items.filter(i=>!hasLoc(i) && !state.mapHidden.has(i.list) && (state.mapShowDone || !i.done));
  openSheet(`<h2>Sin ubicar</h2><p class="hint" style="margin:-6px 0 0">Tocá uno para ponerle su lugar en el mapa.</p>
    ${sin.map(i=>`<button type="button" class="mini" data-sin="${esc(i.id)}"><span class="title">${esc(i.title)}</span><span class="note">${esc([catOf(i.list).one, i.zona].filter(Boolean).join(" · "))}</span></button>`).join("")}
    <div class="row"><button type="button" class="btn ghost" id="sClose">Cerrar</button></div>`);
  $("sClose").onclick = closeSheet;
  $("sheet").querySelectorAll("[data-sin]").forEach(b=>b.onclick=()=>{ const it = state.items.find(x=>x.id===b.dataset.sin); if(it) itemForm(it, { openMap:true }); });
}

/* ---------- reloj para elegir la hora (el del sistema corta los botones en algunos celulares) ---------- */
const timeBtn = (id, v) => `<input type="hidden" id="${id}" value="${esc(v||"")}"><button type="button" class="tbtn ${v?"set":""}" id="${id}Btn">${v ? esc(v) : "--:--"}</button>`;
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
  const close = v=>{ ov.remove(); window.removeEventListener("keydown", key, true); if(v !== null) done(v); };
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
    box.innerHTML = `<div class="empty"><b>Todavía no hay planes</b>Armá el recorrido de un día: elegí lugares de la lista, ponelos en orden y miralos en el mapa.</div>
      <button type="button" class="btn primary" data-newplan>+ Nuevo plan</button>`;
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

function planSheet(plan, preStop, preDate){
  let stops = (plan ? plan.stops||[] : []).slice();
  if(preStop && !stops.includes(preStop)) stops.push(preStop);
  let layer = null;
  openSheet(`
    <h2>${plan ? "Plan" : "Nuevo plan"}</h2>
    <label>Nombre<input id="plTitle" type="text" maxlength="80" value="${esc(plan ? plan.title : "")}" placeholder="Ej.: Sábado en San Telmo"></label>
    <div class="lbl">Cuándo
      <div class="row" style="gap:8px"><input id="plDate" type="date" aria-label="Día" value="${esc(plan ? plan.date || "" : preDate || "")}">${timeBtn("plTime", plan && plan.time)}</div>
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
    <div class="row"><button type="button" class="btn ghost" id="plCancel">Cancelar</button><button type="button" class="btn primary" id="plSave">${plan?"Guardar":"Crear plan"}</button></div>
    ${plan ? `<div class="row" id="plDelRow"><button type="button" class="btn danger" id="plDel">Borrar plan</button></div>` : ""}`);

  wireTime("plTime");
  const byId = id => state.items.find(i=>i.id===id);
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
    paintStops();
  };
  $("plAdd").onclick = ()=>{ const open = $("plPick").hidden; $("plPick").hidden = !open; $("plAdd").textContent = open ? "Listo" : "+ Sumar una parada de la lista"; if(open) paintPick(); };
  $("plQ").addEventListener("input", paintPick);
  $("plPickList").onclick = e=>{ const b = e.target.closest("[data-pk]"); if(b && stops.length<30){ stops.push(b.dataset.pk); paintStops(); } };
  $("plCancel").onclick = closeSheet;
  $("plSave").onclick = ()=>{
    const title = $("plTitle").value.trim() || ($("plDate").value ? "Plan del " + fmtDay($("plDate").value) : "");
    if(!title){ $("plErr").hidden = false; $("plErr").textContent = "Ponele un nombre o un día."; return; }
    const data = { title, date:$("plDate").value || "", note:$("plNote").value.trim(), stops:stops.filter(byId), updatedAt:Date.now() };
    const time = $("plTime").value || "";
    if(time && !data.date){ $("plErr").hidden = false; $("plErr").textContent = "Elegí también el día."; return; }
    if(time || (plan && plan.time)) data.time = time;
    if(plan) store.savePlan(plan.id, data);
    else store.savePlan(store.newPlanId(), { ...data, createdAt:Date.now(), createdBy:state.me.uid });
    closeSheet(); toast(plan ? "Plan guardado" : "Plan creado");
    if(!plan && state.view!=="calendario"){ state.view = "planes"; render(); }
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
    cells += `<button type="button" class="cday ${key===t?"today":""} ${ps.length?"has":""}" data-day="${key}" aria-pressed="${key===state.calDay}" aria-label="${d}${ps.length?`, ${ps.length} plan${ps.length===1?"":"es"}`:""}">${d}${ps.length?`<i>${ps.slice(0,3).map(p=>`<b class="${listOf(p.gid).private?"priv":""}"></b>`).join("")}</i>`:""}</button>`;
  }
  const card = p=>{
    const l = listOf(p.gid), n = (p.stops||[]).length;
    if(p.isItem) return `<button type="button" class="pcard ${p.done?"is-done":""}" data-calitem="${esc(p.gid)}|${esc(p.id)}">
      <span class="pd ${p.date<t ? "past" : ""}">${esc(p.date===t ? "Hoy" : fmtDay(p.date)) + (p.time ? " · " + esc(p.time) + " h" : "")} · <span class="dot" style="background:${listColor(p.list)}"></span> ${esc(catOf(p.list).one)}${p.done?" · hecho":""}</span>
      <b>${esc(p.title)}</b>
      <span class="hint">${l.private?"🔒":"👥"} ${esc(l.name||"Lista")}${p.zona?" · "+esc(p.zona):""}</span></button>`;
    return `<button type="button" class="pcard" data-calplan="${esc(p.gid)}|${esc(p.id)}">
      <span class="pd ${p.date && p.date<t ? "past" : ""}">${p.date ? esc(p.date===t ? "Hoy" : fmtDay(p.date)) + (p.time ? " · " + esc(p.time) + " h" : "") + " · " : ""}${n} parada${n===1?"":"s"}</span>
      <b>${esc(p.title)}</b>
      <span class="hint">${l.private?"🔒":"👥"} ${esc(l.name||"Lista")}${p.gid===state.gid?" · abierta":""}</span>
      ${p.note?`<span class="note">${esc(p.note)}</span>`:""}</button>`;
  };
  const inMonth = all.filter(p=>p.date && p.date.startsWith(state.calMonth)).sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")) || String(a.title).localeCompare(String(b.title),"es"));
  const shown = state.calDay ? inMonth.filter(p=>p.date===state.calDay) : inMonth;
  const undated = all.filter(p=>!p.date && !p.isItem).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  const loading = state.lists.some(l=>!(l.id in state.calPlans) || !(l.id in state.calItems));
  $("cal").innerHTML = `
    <div class="calhead"><button type="button" class="calnav" data-calnav="-1" aria-label="Mes anterior">‹</button><b>${esc(title)}</b><button type="button" class="calnav" data-calnav="1" aria-label="Mes siguiente">›</button></div>
    <div class="calgrid">${["L","M","M","J","V","S","D"].map(d=>`<span class="cdow">${d}</span>`).join("")}${cells}</div>
    <div class="callegend"><span><b class="dotp"></b>Compartida</span><span><b class="dotp priv"></b>Privada</span>${state.calMonth!==t.slice(0,7) || (state.calDay && state.calDay!==t)?`<button type="button" class="linkbtn" data-caltoday>Ir a hoy</button>`:""}</div>
    <div class="sec">${state.calDay ? esc(fmtDay(state.calDay)) : "Todo " + esc(first.toLocaleDateString("es-AR",{ month:"long" }).replace(/^/, "en "))}</div>
    ${shown.length ? shown.map(card).join("") : `<div class="empty"><b>${loading ? "Cargando…" : state.calDay ? "Nada ese día" : "Nada este mes"}</b>${loading ? "" : state.calDay ? "Tocá <strong>+ Nuevo plan</strong> para armar uno para ese día." : "Los planes y lo que tenga día aparecen acá, de todas tus listas."}</div>`}
    ${undated.length && !state.calDay ? `<div class="sec">Sin fecha</div>${undated.map(card).join("")}` : ""}`;
}

/* ---------- listas: cambiar, crear, sumarse ---------- */
function listsSheet(){
  let priv = true;
  const draw = ()=>{
    const curName = state.group ? state.group.name || "" : "";
    openSheet(`
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
      ${!item && state.lists.length>1 ? `<label>Guardar en<select id="fGid">${state.lists.map(l=>`<option value="${esc(l.id)}" ${l.id===state.gid?"selected":""}>${l.private?"🔒 ":""}${esc(l.name||"Lista")}</option>`).join("")}</select></label>` : ""}
      <div class="lbl">Qué tipo
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
        <div class="row" style="gap:8px"><input id="fDate" type="date" aria-label="Día" value="${esc(it.date||pre.date||"")}">${timeBtn("fTime", it.time)}</div></div>
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
  wireTime("fTime");
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
  const allCats = ()=>Object.keys(LISTS).concat(catKeys(list).filter(k=>!LISTS[k]));
  const paintCats = ()=>{
    $("catPills").innerHTML = allCats().map(k=>`<button type="button" class="pill" data-list="${esc(k)}" aria-pressed="${list===k}"><span class="dot" style="background:${listColor(k)}"></span>${esc(catOf(k).one)}</button>`).join("")
      + `<button type="button" class="pill" id="catAdd">+ Otra</button>`;
    $("catAdd").onclick = ()=>{ $("catNewBox").hidden = false; $("catNew").focus(); };
  };
  const pickList = k=>{ list=k; paintCats(); if(pin) pin.setStyle({ fillColor:listColor(list) }); };
  paintCats();
  $("catPills").addEventListener("click", e=>{ const b = e.target.closest("[data-list]"); if(b){ listTouched = true; pickList(b.dataset.list); } });
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
    if(r.list && !item && !listTouched && r.list !== list){ pickList(r.list); done.push(catOf(r.list).label.toLowerCase()); }
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
    if(item) store.save(item.id, data);
    else {
      store.save(store.newId(), { ...data, done:false, rating:0, doneAt:0, memory:"", hasPhoto:false, createdAt:Date.now(), createdBy:state.me.uid }, gid);
      if(gid===state.gid){ state.tab = list; if(["done","planes","calendario"].includes(state.view)) state.view = "pend"; }
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

/* ---------- para descubrir: propuestas que junta el robot de GitHub todos los días ---------- */
let discData = null, discLoading = null;
function loadDisc(){
  if(discLoading) return discLoading;
  discLoading = fetch("data/descubrir.json", { cache:"no-cache" }).then(r=>r.ok ? r.json() : null).catch(()=>null)
    .then(d=>{ discData = d; discLoading = null; paintDiscBtn(); return d; });
  return discLoading;
}
const discItems = () => discData ? Object.values(discData.sources || {}).flatMap(s=>s.items || []) : [];
function paintDiscBtn(){
  const n = discItems().length;
  $("discSub").textContent = n ? `${n} propuestas de esta semana en Buenos Aires` : "Propuestas de esta semana en Buenos Aires";
}
const DAYS = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];
const inMyList = d => state.items.some(i=>i.link && d.link && i.link===d.link);
function discSheet(){
  let f = { when:"todo", free:false, src:"todo", cat:"" , q:"" };
  const draw = ()=>{
    const all = discItems();
    const today = DAYS[new Date().getDay()];
    const finde = ["viernes","sabado","domingo"];
    const cats = [...new Set(all.map(d=>d.cat))].filter(Boolean);
    const rows = all.filter(d=>
      (f.src==="todo" || d.src===f.src) && (!f.free || d.free) && (!f.cat || d.cat===f.cat)
      && (f.when==="todo" || (d.days && (f.when==="hoy" ? d.days.includes(today) : d.days.some(x=>finde.includes(x)))))
      && (!f.q || norm([d.title, d.tipo, d.place, d.zona, d.when].join(" ")).includes(norm(f.q))));
    const upd = discData && Object.values(discData.sources||{}).map(s=>s.updated).filter(Boolean).sort().pop();
    const failed = discData ? Object.entries(discData.sources||{}).filter(([,s])=>s.ok===false).map(([k])=>k==="turismo"?"Turismo BA":"Baires Secreta") : [];
    const pill = (k, v, label) => `<button type="button" class="pill" data-df="${k}" data-dv="${esc(v)}" aria-pressed="${String(f[k])===String(v)}">${label}</button>`;
    openSheet(`
      <h2>Para descubrir</h2>
      <p class="hint" style="margin:-6px 0 0">De <a href="https://turismo.buenosaires.gob.ar/es/article/que-hacer-esta-semana" target="_blank" rel="noopener">Turismo Buenos Aires</a> y <a href="https://bairessecreta.com" target="_blank" rel="noopener">Baires Secreta</a>${upd ? " · actualizado " + esc(new Date(upd).toLocaleDateString("es-AR",{ weekday:"short", day:"numeric", month:"short" })) : ""}${failed.length ? ` · hoy no se pudo leer ${esc(failed.join(" ni "))}` : ""}.</p>
      <input id="dQ" type="search" placeholder="Buscar: teatro, Palermo, gratis…" aria-label="Buscar propuestas" value="${esc(f.q)}">
      <div class="pills">${pill("when","todo","Cualquier día")}${pill("when","hoy","Hoy")}${pill("when","finde","Finde")}<button type="button" class="pill" data-dfree aria-pressed="${f.free}">Gratis</button></div>
      <div class="pills">${pill("src","todo","Todo")}${pill("src","turismo","Turismo BA")}${pill("src","secreta","Baires Secreta")}</div>
      ${cats.length>1 ? `<div class="pills">${pill("cat","","Todos los tipos")}${cats.map(c=>pill("cat", c, `<span class="dot" style="background:${listColor(c)}"></span>${esc(catOf(c).label)}`)).join("")}</div>` : ""}
      <div class="sec">${rows.length} propuesta${rows.length===1?"":"s"}</div>
      <div class="disclist">${!discData ? `<div class="empty"><b>${discLoading ? "Cargando…" : "No se pudieron cargar"}</b>${discLoading ? "" : "Revisá la conexión y probá de nuevo."}</div>`
        : rows.length ? rows.slice(0, 80).map(d=>{
          const sub = [d.tipo, d.free ? "Gratis" : ""].filter(Boolean).join(" · ");
          const where = [d.place, d.zona && !(d.place||"").includes(d.zona) ? d.zona : ""].filter(Boolean).join(" · ");
          const added = inMyList(d);
          return `<div class="dcard">
            ${d.img ? `<img src="${esc(d.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
            <div class="dbody">
              <span class="dk"><span class="dot" style="background:${listColor(d.cat)}"></span>${esc(sub)}</span>
              <b>${esc(d.title)}</b>
              ${d.when ? `<span class="note">🗓 ${esc(d.when)}</span>` : ""}
              ${where ? `<span class="note">📍 ${esc(where)}</span>` : ""}
              <div class="dact"><a href="${esc(safeUrl(d.link))}" target="_blank" rel="noopener">Ver más ↗</a>
                <button type="button" class="${added?"dadded":"dadd"}" data-dadd="${esc(d.id)}" ${added?"disabled":""}>${added ? "✓ En tu lista" : "+ A mi lista"}</button></div>
            </div></div>`;
        }).join("") : `<div class="empty"><b>Nada con ese filtro</b>Probá con otro día o tipo.</div>`}</div>
      <div class="row"><button type="button" class="btn ghost" id="dClose">Cerrar</button></div>`);
    const sh = $("sheet");
    sh.querySelectorAll("[data-df]").forEach(b=>b.onclick=()=>{ f[b.dataset.df] = b.dataset.dv; draw(); });
    sh.querySelector("[data-dfree]").onclick = ()=>{ f.free = !f.free; draw(); };
    let t; $("dQ").addEventListener("input", e=>{ clearTimeout(t); t = setTimeout(()=>{ f.q = e.target.value.trim(); const pos = e.target.selectionStart; draw(); $("dQ").focus(); try{ $("dQ").setSelectionRange(pos, pos); }catch{} }, 250); });
    $("dClose").onclick = closeSheet;
    sh.querySelectorAll("[data-dadd]").forEach(b=>b.onclick=()=>{
      const d = all.find(x=>x.id===b.dataset.dadd); if(!d || !state.gid) return;
      const note = [d.when, d.place].filter(Boolean).join(" · ").slice(0, 400);
      store.save(store.newId(), { list:d.cat || "actividad", title:d.title.slice(0, 120), note, zona:(d.zona||"").slice(0, 60),
        tags: d.free ? ["Gratis"] : [], link:d.link, maps:"", price:0,
        lat: typeof d.lat==="number" ? d.lat : null, lng: typeof d.lng==="number" ? d.lng : null,
        done:false, rating:0, doneAt:0, memory:"", hasPhoto:false, createdAt:Date.now(), createdBy:state.me.uid });
      b.textContent = "✓ En tu lista"; b.className = "dadded"; b.disabled = true;
      toast(`Agregado a “${state.group?.name || "tu lista"}”`);
    });
  };
  draw();
  if(!discData) loadDisc().then(()=>{ if($("dClose")) draw(); });
}

function pickSheet(){
  let filter = "todo", maxPrice = 3, zona = "", tag = "";
  const zonas = allZonas(), tags = uniq([].concat(...state.items.filter(i=>!i.done).map(tagsOf)));
  openSheet(`
    <h2>¿Qué hacemos hoy?</h2>
    <div class="pills" role="group" aria-label="Qué tipo">${[["todo","Cualquier cosa"],...catKeys().map(k=>[k,catOf(k).label])].map(([k,l])=>`<button type="button" class="pill" data-f="${esc(k)}" aria-pressed="${k==="todo"}">${esc(l)}</button>`).join("")}</div>
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
    const k = [catOf(p.list).one, p.zona, p.price ? "$".repeat(p.price) : ""].filter(Boolean).map(esc).join(" · ");
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
  const n = (g.members||[]).length, alone = n <= 1, full = n >= MAX_MEMBERS;
  openSheet(`
    <h2>${esc(g.name || "Lista")}</h2>
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
document.querySelectorAll(".seg [data-view]").forEach(b=>b.onclick=()=>{ state.view = b.dataset.view; render(); b.scrollIntoView({ inline:"nearest", block:"nearest" }); });
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
  if(b){ const k = b.dataset.ml; state.mapHidden.has(k) ? state.mapHidden.delete(k) : state.mapHidden.add(k); renderMap(); return; }
  if(e.target.closest("#mlDone")){ state.mapShowDone = !state.mapShowDone; renderMap(); }
});
$("heroBtn").onclick = pickSheet;
$("discBtn").onclick = ()=>{ discSheet(); loadDisc().then(()=>{ if($("dClose")) discSheet(); }); };
$("addBtn").onclick = ()=>state.view==="planes" ? planSheet(null) : state.view==="calendario" ? planSheet(null, null, state.calDay) : itemForm(null);
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
loadDisc();
store.start(onUser);
