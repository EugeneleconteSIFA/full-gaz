/* Rend l'image de partage du jour (1200 × 630) pour chaque date, avec le vrai numéro du puzzle.
   Fichiers : og/AAAA-MM-JJ.png ; nginx sert celui du jour (voir server/nginx.conf).
   Usage : node tools/render_og.js [jours=400]  (les images déjà rendues sont gardées) */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const DAY1 = Date.UTC(2026, 9, 11); // puzzle n°1, comme dayNo() dans index.html
const days = +process.argv[2] || 400;
const tpl = fs.readFileSync(path.join(root, 'assets/og.svg'), 'utf8');
const out = path.join(root, 'og');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const now = new Date(), today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  let made = 0;
  for (let i = -1; i < days; i++) {
    const t = today + i * 864e5, d = new Date(t), file = path.join(out, d.toISOString().slice(0, 10) + '.png');
    if (t < DAY1 || fs.existsSync(file)) continue;
    const n = Math.round((t - DAY1) / 864e5) + 1;
    const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).toUpperCase();
    const svg = tpl.replace('{{N}}', n).replace('{{DATE}}', label);
    await page.setContent('<style>html,body{margin:0}svg{display:block;width:1200px;height:630px}</style>' + svg);
    await page.screenshot({ path: file });
    made++;
  }
  await browser.close();
  console.log(made + ' image(s) rendue(s) dans og/');
})();
