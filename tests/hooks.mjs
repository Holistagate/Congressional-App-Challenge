/**
 * Lets `node --test` load the app's own TypeScript source directly.
 *
 * Two things stand between Node and src/:
 *   1. the `@/…` path alias, which only tsconfig knows about
 *   2. extensionless imports, which TypeScript allows and Node's ESM does not
 *
 * A resolve hook fixes both, so the tests exercise exactly the modules the app
 * runs — not a compiled copy that could drift from them. Node strips the types
 * itself (24.x), so there is no build step and no test-only toolchain.
 *
 * Used via `--import ./tests/hooks.mjs` in the test script. The script also
 * passes `--conditions=react-server`, which is what makes `import "server-only"`
 * resolve to an empty module instead of a module that throws.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");

const CANDIDATES = [".ts", ".tsx", ".js", "/index.ts", "/index.tsx"];

/** Adds the extension TypeScript would have inferred, if the bare path misses. */
function withExtension(filePath) {
  if (existsSync(filePath) && path.extname(filePath)) return filePath;
  for (const suffix of CANDIDATES) {
    const candidate = filePath + suffix;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // "@/lib/geo" -> <root>/src/lib/geo.ts
    if (specifier.startsWith("@/")) {
      const resolved = withExtension(path.join(srcDir, specifier.slice(2)));
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }

    // "./index" from a file inside src/ -> ./index.ts
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const resolved = withExtension(path.resolve(parentDir, specifier));
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});
