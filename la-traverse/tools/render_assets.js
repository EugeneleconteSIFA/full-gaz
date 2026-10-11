/* Rend l'icône iOS (180 × 180) et l'aperçu de partage de secours (1200 × 630). L'aperçu du jour : tools/render_og.js.
   Usage : node tools/render_assets.js */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

(async () => {
  const browser = await chromium.launch();
  for (const [src, out, w, h] of [['assets/og.svg', 'og.png', 1200, 630], ['assets/icon.svg', 'icon-180.png', 180, 180]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    // og.png : image de secours sans numéro, servie si l'image du jour manque.
    const svg = fs.readFileSync(path.join(root, src), 'utf8').replace('PUZZLE N°{{N}}', 'PUZZLE DU JOUR').replace('{{DATE}}', 'LE PUZZLE QUOTIDIEN');
    await page.setContent('<style>html,body{margin:0}svg{display:block;width:' + w + 'px;height:' + h + 'px}</style>' + svg);
    await page.screenshot({ path: path.join(root, out) });
    await page.close();
    console.log(out);
  }
  await browser.close();
})();
