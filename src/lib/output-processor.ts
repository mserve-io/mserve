import type { OutputProcessorProvider } from "@mml-io/esbuild-plugin-mml";

import path from "node:path";
import crypto from "node:crypto";

export interface MServeOutputProcessorOptions {
  projectId: string;
  apiKey: string;
  mserve?: {
    protocol?: "https" | "http" | (string & {});
    host: string;
  };
  deploy?: boolean;
}

export function mserveOutputProcessor({
  projectId,
}: MServeOutputProcessorOptions): OutputProcessorProvider {
  interface Deployable {
    id: string;
    name: string;
    importStr: string;
  }
  const deployables: Partial<Record<string, Deployable>> = {};

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

      deployables[inPath] = { name, id, importStr };

      return { importStr };
    },
  });
}
