import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/**
 * The one glTF loader of the game: it reads meshopt-compressed models (EXT_meshopt_compression,
 * KHR_mesh_quantization), as written by `npm run models:pack` (PERFORMANCE.md, roadmap step 8).
 * The decoder is plain JS + embedded WebAssembly: no extra file to serve.
 */
export function gltfLoader(): GLTFLoader {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}
