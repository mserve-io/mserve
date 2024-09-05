import type { OutputProcessorProvider } from "@mml-io/esbuild-plugin-mml";

import path from "node:path";
import crypto from "node:crypto";

export function mserveOutputProcessor(
  projectId: string,
): OutputProcessorProvider {
  return () => ({
    onOutput(inPath: string) {
      const extname = path.extname(inPath);
      const dirname = path.dirname(inPath);

      let name = path.basename(inPath, extname);

      if (name === "index") {
        name = path.basename(dirname);
      }

      const id = `${name.slice(0, 16)}-${crypto.hash("sha1", inPath, "hex").slice(-6)}`;

      const importStr = `${projectId}_${id}`;

      const newPath = id + extname;

      return { importStr, path: newPath };
    },
  });
}
