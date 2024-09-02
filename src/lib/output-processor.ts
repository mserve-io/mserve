import type {
  OutputProcessorProvider,
  MMLWorldConfig,
} from "@mml-io/esbuild-plugin-mml";

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
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
    async onEnd(outdir: string, result: esbuild.BuildResult) {
      if (!deploy) {
        log("skipping deployment");
        return;
      }

      const outputs = Object.keys(result.metafile?.outputs ?? {});
      log("deploying outputs to MServe", { projectId, deployables, outputs });

      interface MMLWorldInstanceRequest {
        name: string;
        mmlDocumentsConfiguration: MMLWorldConfig;
      }

      interface MMLObjectInstanceRequest {
        name: string;
        description?: string;
        enabled?: boolean;
        parameters?: object;
        source: {
          type: "source";
          source: string;
        };
      }

      const objectInstancesUrl = `${mserve.protocol ?? "https"}://${mserve.host}/v1/mml-objects/${projectId}/object-instances`;
      const worldInstancesUrl = `${mserve.protocol ?? "https"}://${mserve.host}/v1/worlds/${projectId}/web-world-instances`;

      const out = Object.keys(result.metafile?.outputs ?? {}).map(
        async (output) => {
          const deployable = deployables[path.relative(outdir, output)];
          if (!deployable) {
            return undefined;
          }
          const { name, id } = deployable;
          const source = await fs.readFile(output, {
            encoding: "utf8",
          });

          if (output.endsWith(".html")) {
            const request: MMLObjectInstanceRequest = {
              name,
              source: {
                type: "source",
                source,
              },
            };
            log("deploying", { deployable });
            let response = await fetch(objectInstancesUrl + "/" + id, {
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
              response = await fetch(objectInstancesUrl, {
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
          } else if (output.endsWith(".json")) {
            const request: MMLWorldInstanceRequest = {
              name,
              mmlDocumentsConfiguration: JSON.parse(source) as unknown,
            };
            log("deploying", { deployable });
            let response = await fetch(worldInstancesUrl + "/" + id, {
              method: "POST",
              body: await gzip(JSON.stringify(request)),
              headers: {
                authorization: `Bearer ${apiKey}`,
                "content-type": "application/json",
                "content-encoding": "gzip",
              },
            });

            if (response.status === 404) {
              log("world instance does not exist, creating...");
              response = await fetch(worldInstancesUrl, {
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
              log("failed to deploy world instance", {
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
