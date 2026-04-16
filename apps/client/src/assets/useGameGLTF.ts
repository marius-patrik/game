import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { type ExtendableGLTFLoader, extendGLTFLoader } from "./loaders";

export function useGameGLTF(path: string) {
  const gl = useThree((state) => state.gl);
  return useGLTF(path, true, true, (loader) => {
    extendGLTFLoader(loader as unknown as ExtendableGLTFLoader, gl);
  });
}

useGameGLTF.preload = (path: string): void => {
  useGLTF.preload(path);
};

useGameGLTF.clear = (path: string): void => {
  useGLTF.clear(path);
};
