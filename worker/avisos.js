/* ¿Qué hacemos hoy? — servidor de avisos (Cloudflare Worker, plan gratis).
 *
 * La app le manda: quién avisa (su login de Firebase), el texto del aviso y a qué celulares.
 * Este servidor revisa que el login sea de verdad de la app y manda el aviso (Web Push) a cada celular.
 * No guarda nada.
 *
 * Instalación: ver "Avisos" en claude/estado-de-la-app.md del proyecto, o el README.
 * Secreto que hay que cargar en Cloudflare (Settings → Variables and Secrets → Secret):
 *   VAPID_PRIVATE  = la clave privada que te pasó Claude (no se publica en ningún lado)
 */

const PROJECT_ID = "que-hacemos-hoy-59b81";
const VAPID_PUBLIC = "BNUj_Mhm11xCQ71kQFeJQJGWNhmlROka8QDX1-XwzV2GxAR9XiLn_28GFIthtoSYvlNR7qS1oP4pnsu5rIa2yHM";
const VAPID_SUBJECT = "https://lucasvyte.github.io/que-hacemos-hoy/";
const ORIGINS = ["https://lucasvyte.github.io"];
// solo se mandan avisos a los servicios de push de los navegadores (Chrome, Firefox, Safari, Edge)
const PUSH_HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
const MAX_SUBS = 20;

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method === "GET") {
      const ok = !!(env && env.VAPID_PRIVATE);
      return new Response(ok ? "Avisos de ¿Qué hacemos hoy? funcionando ✓" : "Falta cargar el secreto VAPID_PRIVATE en Cloudflare.",
        { status: ok ? 200 : 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (req.method !== "POST") return json({ error: "method" }, 405);
    if (!ORIGINS.includes(origin)) return json({ error: "origin" }, 403);
    if (!env.VAPID_PRIVATE) return json({ error: "config" }, 500);

    // 1. ¿Quién avisa? Tiene que haber entrado a la app con Google
    const tok = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const uid = await verifyFirebaseToken(tok).catch(() => null);
    if (!uid) return json({ error: "auth" }, 401);

    // 2. Qué avisar y a quién
    let b;
    try { b = await req.json(); } catch { return json({ error: "body" }, 400); }
    const str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
    const payload = JSON.stringify({
      title: str(b.title, 120), body: str(b.body, 300), tag: str(b.tag, 80),
      url: /^\.\/(\?[\w=&%.-]*)?$/.test(b.url || "") ? b.url : "./"
    });
    const subs = Array.isArray(b.subs) ? b.subs.slice(0, MAX_SUBS) : [];

    // 3. Mandar
    const results = await Promise.all(subs.map(async s => {
      const id = str(s && s.id, 200);
      try {
        const u = new URL(s.endpoint);
        if (u.protocol !== "https:" || !PUSH_HOSTS.test(u.hostname)) return { id, status: 400 };
        const r = await sendPush(s, payload, env.VAPID_PRIVATE);
        return { id, status: r.status };
      } catch (e) { return { id, status: 0 }; }
    }));
    return json({ results });
  }
};

/* ---------- utilidades ---------- */
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(s + "===".slice((s.length + 3) % 4)); return Uint8Array.from(bin, c => c.charCodeAt(0)); };
const concat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out; };
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/* ---------- login de Firebase (token de Google firmado RS256) ---------- */
let jwksCache = null, jwksAt = 0;
async function googleKeys() {
  if (jwksCache && Date.now() - jwksAt < 3600e3) return jwksCache;
  const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  jwksCache = (await r.json()).keys; jwksAt = Date.now();
  return jwksCache;
}
export async function verifyFirebaseToken(token, keys) {
  const [h, p, s] = String(token).split(".");
  if (!s) return null;
  const head = JSON.parse(new TextDecoder().decode(unb64u(h)));
  const claims = JSON.parse(new TextDecoder().decode(unb64u(p)));
  if (head.alg !== "RS256") return null;
  const jwk = (keys || await googleKeys()).find(k => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, unb64u(s), enc.encode(h + "." + p));
  const now = Math.floor(Date.now() / 1000);
  if (!ok || claims.aud !== PROJECT_ID || claims.iss !== "https://securetoken.google.com/" + PROJECT_ID
    || !(claims.exp > now) || !(claims.iat <= now + 300) || typeof claims.sub !== "string" || !claims.sub) return null;
  return claims.sub;
}

/* ---------- Web Push: cifrado (RFC 8291) y firma VAPID (RFC 8292) ---------- */
export async function encryptPayload(p256dh, authSecret, plaintext, test) {
  const uaPub = unb64u(p256dh), auth = unb64u(authSecret);
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const as = test ? test.keys : await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const prkKey = await hmac(auth, shared);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPub, asPub, new Uint8Array([1])));
  const salt = test ? test.salt : crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, enc.encode("Content-Encoding: aes128gcm\0\x01"))).slice(0, 16);
  const nonce = (await hmac(prk, enc.encode("Content-Encoding: nonce\0\x01"))).slice(0, 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const data = concat(typeof plaintext === "string" ? enc.encode(plaintext) : plaintext, new Uint8Array([2]));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, data));
  const rs = 4096, header = new Uint8Array(21);
  header.set(salt, 0); new DataView(header.buffer).setUint32(16, rs); header[20] = asPub.length;
  return concat(header, asPub, ct);
}

async function vapidAuth(endpoint, privD) {
  const pub = unb64u(VAPID_PUBLIC);
  const key = await crypto.subtle.importKey("jwk",
    { kty: "EC", crv: "P-256", d: privD, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true },
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + body));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${VAPID_PUBLIC}`;
}

async function sendPush(sub, payload, privD) {
  const body = await encryptPayload(sub.p256dh, sub.auth, payload);
  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization": await vapidAuth(sub.endpoint, privD),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "high"
    },
    body
  });
}
export const _test = { vapidAuth, unb64u, b64u };
