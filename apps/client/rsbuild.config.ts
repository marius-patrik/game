import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    title: "game",
    template: "./public/index.html",
  },
  source: {
    entry: { index: "./src/main.tsx" },
    decorators: { version: "legacy" },
  },
  server: {
    host: process.env.RSBUILD_HOST ?? "127.0.0.1",
    port: Number(process.env.RSBUILD_PORT ?? 3000),
  },
  output: {
    cleanDistPath: true,
    distPath: { root: "dist" },
  },
});
