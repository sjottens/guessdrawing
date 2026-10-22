import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  clean: true,
  // The shared package is TypeScript source, so bundle it into the output.
  noExternal: ["@guessdrawing/shared"],
});
