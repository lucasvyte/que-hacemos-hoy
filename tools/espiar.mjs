// Diagnóstico: abre las páginas con un navegador y guarda lo que cargan (HTML final y respuestas JSON).
import { chromium } from "playwright";
import fs from "node:fs";
const PAGES = {
  turismo: "https://turismo.buenosaires.gob.ar/es/article/que-hacer-esta-semana",
  secreta: "https://linkin.bio/baires-secreta/"
};
fs.mkdirSync("data/_debug", { recursive: true });
const browser = await chromium.launch();
for (const [name, url] of Object.entries(PAGES)) {
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36" });
  const calls = [];
  page.on("response", async r => {
    const ct = r.headers()["content-type"] || "";
    if (!/json/.test(ct)) return;
    try { const body = await r.text(); calls.push({ url: r.url(), status: r.status(), size: body.length, body: body.slice(0, 60000) }); } catch {}
  });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 3000); await page.waitForTimeout(1500); }
  } catch (e) { calls.push({ error: String(e) }); }
  fs.writeFileSync(`data/_debug/${name}.html`, await page.content());
  fs.writeFileSync(`data/_debug/${name}.json`, JSON.stringify(calls, null, 1));
  await page.close();
}
await browser.close();
