/* Partie complète au doigt : trajet optimal, choix de ligne, validation, résultat, sauvegarde. */
const { test, expect } = require('@playwright/test');

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test.afterEach(() => { expect(errors, 'erreurs console').toEqual([]); });

async function noHorizontalScroll(page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, 'défilement horizontal de la page').toBeLessThanOrEqual(0);
}

/* Le trajet optimal de la grille affichée, calculé par la page elle-même. */
async function optimal(page) {
  return page.evaluate(() => {
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const P = generate(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()));
    return { s: P.s, nodes: P.optNodes, lines: P.optEdges.map(e => LNAME[P.edges[e].line]), opt: P.opt,
      name: P.nodes[P.t].name };
  });
}

async function play(page, opt) {
  for (let k = 0; k < opt.lines.length; k++) {
    await page.locator('.sta[data-id="' + opt.nodes[k + 1] + '"]').tap();
    const choose = page.locator('#choose');
    if (await choose.isVisible()) {
      await choose.getByRole('button', { name: new RegExp('^' + opt.lines[k] + ' ·') }).tap();
    }
  }
}

test('partie complète du jour : optimal, partage, sauvegarde', async ({ page }) => {
  await noHorizontalScroll(page);
  await expect(page.locator('.sta')).toHaveCount(25);
  await expect(page.locator('#validate')).toBeDisabled();

  const opt = await optimal(page);
  await play(page, opt);
  await expect(page.locator('#cost')).toHaveText(String(opt.opt));
  await expect(page.locator('#validate')).toBeEnabled();
  await noHorizontalScroll(page);

  await page.locator('#validate').tap();
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#actions')).toBeHidden();
  await expect(page.locator('#pct')).toHaveText('0 %');
  const share = await page.locator('#shareText').textContent();
  expect(share).toMatch(/^La Traverse n°\d+/);
  expect(share).toContain('Trajet optimal');
  expect(share).toMatch(/^[🟩]+$/mu);
  expect(share).not.toContain(opt.name);
  await noHorizontalScroll(page);

  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toEqual([expect.stringMatching(/^corr:v\d+:\d{4}-\d\d-\d\d$/)]);

  await page.reload();
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#pct')).toHaveText('0 %');
});

test('détour, annulation et choix de ligne', async ({ page }) => {
  const opt = await optimal(page);
  await page.locator('.sta[data-id="' + opt.nodes[1] + '"]').tap();
  const choose = page.locator('#choose');
  if (await choose.isVisible()) await choose.getByRole('button').first().tap();
  await expect(page.locator('#count')).toHaveText('2');
  await page.locator('#undo').tap();
  await expect(page.locator('#count')).toHaveText('1');
  await expect(page.locator('#undo')).toBeDisabled();

  // Une station non reliée affiche un message et ne bouge pas le trajet.
  const far = await page.evaluate(s => {
    const P = generate(new Date().toLocaleDateString('sv-SE'));
    return P.nodes.find(n => n.id !== s && !P.adj[s].some(a => a.to === n.id)).id;
  }, opt.s);
  await page.locator('.sta[data-id="' + far + '"]').tap();
  await expect(page.locator('#status')).toContainText(/liaison/);
  await expect(page.locator('#count')).toHaveText('1');
});

test('entraînement : nouvelle grille jouable', async ({ page }) => {
  await page.locator('#m-train').tap();
  await expect(page.locator('#m-train')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sub')).toContainText('Entraînement');
  await noHorizontalScroll(page);
});

test('classement : créer un groupe, jouer, se voir classé', async ({ page }) => {
  await expect(page.locator('#friends')).toBeVisible();
  await page.locator('#fPseudo').fill('Testeur');
  await page.locator('#fName').fill('Groupe e2e');
  await page.locator('#fCreate').tap();
  await expect(page.locator('#fGCode')).toHaveText(/^[A-Z0-9]{6}$/);
  await expect(page.locator('#fWait')).toBeVisible();

  await play(page, await optimal(page));
  await page.locator('#validate').tap();
  await expect(page.locator('#fList li')).toHaveCount(1);
  await expect(page.locator('#fList li').first()).toContainText('Testeur');
  await expect(page.locator('#fList li').first()).toContainText('0 %');
  await page.locator('#fTabWeek').tap();
  await expect(page.locator('#fNote')).toContainText('depuis lundi');
  await noHorizontalScroll(page);
});

test('recommencer la grille du jour après le résultat : hors classement', async ({ page }) => {
  const opt = await optimal(page);
  await play(page, opt);
  await page.locator('#validate').tap();
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  await page.locator('#replay').tap();
  await expect(page.locator('#m-train')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sub')).toContainText('hors classement');
  await expect(page.locator('#count')).toHaveText('1');
  await expect(page.locator('#map')).toHaveClass(/focus/);
  await play(page, opt);
  await page.locator('#validate').tap();
  await expect(page.locator('#pct')).toHaveText('0 %');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(saved);
  await noHorizontalScroll(page);
});
