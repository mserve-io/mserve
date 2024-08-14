import type { OutputProcessorProvider } from "@mml-io/esbuild-plugin-mml";

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "crypto";
import type esbuild from "esbuild";
import { gzip } from "./gzip.js";

export interface MServerOutputProcessorOptions {
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
  apiKey,
  deploy = false,
  mserve = { host: "api.mserve.io" },
}: MServerOutputProcessorOptions): OutputProcessorProvider {
  interface Deployable {
    id: string;
    name: string;
    importStr: string;
  }
  const deployables: Partial<Record<string, Deployable>> = {};

  return (log: typeof console.log) => ({
    onOutput(inPath) {
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
    async onEnd(outdir, result) {
      if (!deploy) {
        log("skipping deployment");
        return;
      }

      const outputs = Object.keys(result.metafile?.outputs ?? {});
      log("deploying outputs to MServe", { projectId, deployables, outputs });

      interface Request {
        name: string;
        description?: string;
        enabled?: boolean;
        parameters?: object;
        source: {
          type: "source";
          source: string;
        };
      }
      const url = `${mserve.protocol ?? "https"}://${mserve.host}/v1/mml-objects/${projectId}/object-instances`;
      const out = Object.keys(result.metafile?.outputs ?? {}).map(
        async (output) => {
          const deployable = deployables[path.relative(outdir, output)];
          if (!deployable) {
            return undefined;
          }
          const { name, id } = deployable;
          const source = await fs.readFile(path.resolve(__dirname, output), {
            encoding: "utf8",
          });
          const request: Request = {
            name,
            source: {
              type: "source",
              source,
            },
          };
          log("deploying", { deployable });
          let response = await fetch(url + "/" + id, {
            method: "POST",
            body: await gzip(JSON.stringify({ ...request, parameters: {} })),
            headers: {
              authorization: `Bearer ${apiKey}`,
              "content-type": "application/json",
              "content-encoding": "gzip",
            },
          });

          if (response.status === 404) {
            log("object instance does not exist, creating...");
            response = await fetch(url, {
              method: "POST",
              body: await gzip(JSON.stringify({ ...request, id })),
              headers: {
                authorization: `Bearer ${apiKey}`,
                "content-type": "application/json",
                "content-encoding": "gzip",
              },
            });
          }
          if (response.status !== 200) {
            const { status } = response;
            const message = await response.text();
            log("failed to deploy object instance", {
              deployable,
              status,
              message,
            });
            return {
              text: "",
              detail: {
                status: response.status,
                message: await response.text(),
              },
            };
          }
          log(`deployed output ${name} to MServe`, deployable);
        },
      );
      return Promise.all(out).then((results) => {
        const errors = results.reduce<esbuild.PartialMessage[]>(
          (errors, error) => (error ? errors.concat(error) : errors),
          [],
        );
        return { errors };
      });
    },
  });
}
