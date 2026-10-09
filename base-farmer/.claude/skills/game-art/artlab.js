// Art lab: paste into javascript_tool on a running dev build (window.__game must exist).
// Shows baked textures enlarged, in grayscale, at real size, on every biome ground, and prints
// measurable numbers (value contrast vs ground, silhouette fill ratio). Remove with artLabClose().
//
// Usage:
//   artLab(["char_scout_body_teamA", "char_tank_body_teamB"], { scale: 3 })
//   artLabMeasure("char_scout_body_teamA")  -> { meanL, contrast: { meadow, canyon, corners }, ... }
(() => {
  const GROUNDS = { meadow: "#a4c37b", canyon: "#dd9b61", corners: "#7fa383", ui: "#2b3142" };

  const lum = (r, g, b) => {
    const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const hexLum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return lum((n >> 16) & 255, (n >> 8) & 255, n & 255);
  };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

  function source(key) {
    const tex = window.__game.textures.get(key);
    if (!tex || tex.key === "__MISSING") throw new Error(`No texture ${key}`);
    const img = tex.getSourceImage();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d").drawImage(img, 0, 0);
    return c;
  }

  function tile(src, w, h, bg, filter) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.filter = filter || "none";
    x.imageSmoothingEnabled = true;
    x.drawImage(src, 0, 0, w, h);
    c.style.cssText = "margin:2px;border:1px solid #444;image-rendering:auto";
    return c;
  }

  /** Mean luminance of opaque pixels, silhouette fill ratio, and contrast vs each ground. */
  window.artLabMeasure = (key) => {
    const c = source(key);
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let sum = 0,
      n = 0,
      dark = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      const l = lum(d[i], d[i + 1], d[i + 2]);
      sum += l;
      n++;
      if (l < 0.05) dark++;
    }
    const meanL = sum / n;
    const contrast = {};
    for (const [k, v] of Object.entries(GROUNDS)) contrast[k] = +ratio(meanL, hexLum(v)).toFixed(2);
    return {
      meanL: +meanL.toFixed(3),
      fill: +(n / (c.width * c.height)).toFixed(2),
      outlineShare: +(dark / n).toFixed(2),
      contrast,
    };
  };

  window.artLab = (keys, opts = {}) => {
    window.artLabClose();
    const scale = opts.scale ?? 3;
    const thumbH = opts.thumbPx ?? 48;
    const root = document.createElement("div");
    root.id = "artlab";
    root.style.cssText =
      "position:fixed;inset:0;z-index:99999;overflow:auto;background:#111;color:#ddd;font:12px monospace;padding:8px";
    for (const key of keys) {
      const src = source(key);
      // Baked at BAKE_SCALE (see bake.ts): natural display size is source / bake.
      const bake = opts.bake ?? 3;
      const w = (src.width / bake) * scale,
        h = (src.height / bake) * scale;
      const row = document.createElement("div");
      const m = window.artLabMeasure(key);
      row.innerHTML = `<div>${key} — L=${m.meanL} contrast ${JSON.stringify(m.contrast)}</div>`;
      row.append(tile(src, w, h, GROUNDS.meadow));
      row.append(tile(src, w, h, "#808080", "grayscale(1)"));
      for (const bg of Object.values(GROUNDS)) {
        row.append(tile(src, (thumbH * src.width) / src.height, thumbH, bg));
      }
      row.append(
        tile(src, (thumbH * src.width) / src.height, thumbH, GROUNDS.meadow, "grayscale(1)"),
      );
      root.append(row);
    }
    document.body.append(root);
    return keys.map((k) => [k, window.artLabMeasure(k)]);
  };

  /** Black silhouettes at 48 px side by side: each character must be recognizable alone. */
  window.artLabSilhouette = (keys, px = 48) => {
    window.artLabClose();
    const root = document.createElement("div");
    root.id = "artlab";
    root.style.cssText = "position:fixed;inset:0;z-index:99999;background:#fff;padding:8px";
    for (const key of keys) {
      const src = source(key);
      root.append(tile(src, (px * src.width) / src.height, px, "#ffffff", "brightness(0)"));
    }
    document.body.append(root);
  };

  window.artLabClose = () => document.getElementById("artlab")?.remove();
  /** Whole-screen grayscale toggle, for the value test on a real match frame. */
  window.artLabGray = (on = true) => {
    document.querySelector("canvas").style.filter = on ? "grayscale(1)" : "";
  };
  return "artlab ready";
})();
