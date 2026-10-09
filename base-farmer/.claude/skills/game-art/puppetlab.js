// Puppet lab: paste into javascript_tool on a dev build (a match must be running).
// Spawns the 4 animals in a row over a dark backdrop and drives their animators with synthetic
// inputs, so poses can be checked frame by frame: puppetLab({ state: "run" | "runAimBack" |
// "attack" | "hit" | "idle", t: ms, zoom }). Returns after posing; take two screenshots.
(async () => {
  const P = await import("/src/rendering/puppet/Puppet.ts");
  const A = await import("/src/rendering/puppet/PuppetAnimator.ts");
  const parts = await import("/src/rendering/puppet/animalParts.ts");
  const art = await import("/src/rendering/characterArt.ts");
  const weapons = await import("/src/rendering/weaponArt.ts");
  const g = window.__game;
  const sc = g.scene.getScene("match");
  window.puppetLab = (opts = {}) => {
    if (window.__lab) window.__lab.forEach((o) => o.destroy());
    const cam = sc.cameras.main;
    window.__labBaseZoom ??= cam.zoom;
    const zoom = window.__labBaseZoom * (opts.zoom ?? 1.6);
    cam.stopFollow();
    const w = cam.width / cam.zoom,
      h = cam.height / cam.zoom;
    const cx = cam.midPoint.x,
      cy = cam.midPoint.y;
    const bg = sc.add.rectangle(cx, cy, w * 2, h * 2, 0x2b3142).setDepth(1e7);
    const objs = [bg];
    const ids = ["tank", "scout", "shooter", "fighter"];
    const r = 21.6;
    ids.forEach((id, i) => {
      art.ensureCharacterTextures(sc, id, "teamA", r);
      const pup = new P.Puppet(sc, parts.buildAnimalPuppet(sc, id, "teamA", r), r, art.PUPIL_KEY);
      const melee = id !== "shooter";
      const wpn = sc.add.image(0, 0, weapons.ensureWeaponTexture(sc, id, melee, r)).setScale(1 / 3);
      pup.bone("weapon").add(wpn);
      const anim = new A.PuppetAnimator(pup);
      // The animator owns the root (flip, cheer hop): place it through a holder container.
      const holder = sc.add
        .container(cx + (i - 1.5) * r * 3.6, cy + r * 1.2, [pup.root])
        .setDepth(1e7 + 1);
      const st = opts.state ?? "idle";
      const T = opts.t ?? 200;
      const speed = 160;
      for (let ms = 0; ms <= T; ms += 16) {
        const run = st === "run" || st === "runAimBack";
        anim.update({
          now: 10000 + ms,
          dt: 0.016,
          vx: run ? speed : 0,
          vy: 0,
          maxSpeed: speed,
          aimX: st === "runAimBack" ? -0.7 : 0.9,
          aimY: st === "runAimBack" ? -0.7 : 0.2,
          attackAtMs: st === "attack" ? 10000 + T - (opts.attackAgo ?? 90) : -1e9,
          melee,
          meleeArc: 2,
          hitAtMs: st === "hit" ? 10000 + T - 60 : -1e9,
          cheerAtMs: -1e9,
        });
      }
      objs.push(holder);
    });
    cam.setZoom(zoom);
    cam.centerOn(cx, cy);
    window.__lab = objs;
    return "posed " + (opts.state ?? "idle");
  };
  return "puppetLab ready";
})();
