import type { Options } from "tsup";

export const tsup: Options = {
    dts: true,
    entryPoints: ["src/index.ts"],
    format: ["cjs", "esm"],
    legacyOutput: false,
    sourcemap: true,
    splitting: false,
    bundle: true,
    clean: true,
};
