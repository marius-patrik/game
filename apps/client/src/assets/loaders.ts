import type { WebGLRenderer } from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { BASIS_TRANSCODER_PATH, DRACO_DECODER_PATH } from "./decoderPaths";

export type ExtendableGLTFLoader = {
  setDRACOLoader: (loader: DRACOLoader) => unknown;
  setKTX2Loader: (loader: KTX2Loader) => unknown;
  setMeshoptDecoder: (decoder: typeof MeshoptDecoder) => unknown;
};

let dracoSingleton: DRACOLoader | null = null;
let ktx2Singleton: KTX2Loader | null = null;

function getDraco(): DRACOLoader {
  if (!dracoSingleton) {
    const loader = new DRACOLoader();
    loader.setDecoderPath(DRACO_DECODER_PATH);
    loader.setDecoderConfig({ type: "js" });
    dracoSingleton = loader;
  }
  return dracoSingleton;
}

function getKTX2(gl: WebGLRenderer): KTX2Loader {
  if (!ktx2Singleton) {
    const loader = new KTX2Loader();
    loader.setTranscoderPath(BASIS_TRANSCODER_PATH);
    loader.detectSupport(gl);
    ktx2Singleton = loader;
  }
  return ktx2Singleton;
}

export function extendGLTFLoader(loader: ExtendableGLTFLoader, gl: WebGLRenderer): void {
  loader.setDRACOLoader(getDraco());
  loader.setKTX2Loader(getKTX2(gl));
  loader.setMeshoptDecoder(MeshoptDecoder);
}

export function disposeAssetLoaders(): void {
  dracoSingleton?.dispose();
  ktx2Singleton?.dispose();
  dracoSingleton = null;
  ktx2Singleton = null;
}
