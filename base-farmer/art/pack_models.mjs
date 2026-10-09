// Compresses the raw model exports (art/out/models/*.glb, written by the Blender scripts) into
// public/models/, which the game downloads (roadmap step 8, PERFORMANCE.md).
//
//   npm run models:pack
//
// gltfpack with meshopt compression (-cc), keeping node names (-kn: mouth decals and bones are
// found by name), materials (-km), every vertex attribute (-kv: the Gloss UV map has no material
// using it but the game reads it), and WITHOUT quantization (-noq): quantized UVs would need
// KHR_texture_transform on a material to decode, which would corrupt the gloss.
// The game's loader (src/rendering/three/loader.ts) decodes it.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const from = "art/out/models";
const to = "public/models";
mkdirSync(to, { recursive: true });
let before = 0;
let after = 0;
for (const file of readdirSync(from).filter((f) => f.endsWith(".glb"))) {
  const src = join(from, file);
  const dst = join(to, file);
  execFileSync("npx", ["gltfpack", "-i", src, "-o", dst, "-cc", "-kn", "-km", "-kv", "-noq"], {
    stdio: "ignore",
  });
  const a = statSync(src).size;
  const b = statSync(dst).size;
  before += a;
  after += b;
  console.log(`${file.padEnd(20)} ${(a / 1024).toFixed(0).padStart(6)} KB -> ${(b / 1024).toFixed(0).padStart(6)} KB`);
}
console.log(`total ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
