import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { gzip } from "../lib/gzip.js";
import { MMLWorldConfig } from "@mml-io/esbuild-plugin-mml";

// NOTE: URL.parse was only introduced in nodejs 22, but typescript seems to think it exists,
// even though it is configured with the nodejs 20 base. No idea why. This emulates the behaviour.
function parseURL(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export interface BaseArgs {
  apiKey: string;
  project: string;
  origin: string;
}

export interface DeployArgs extends BaseArgs {
  paths: string[];
}

export async function deployFile({
  project,
  file,
  id,
  mserve,
  apiKey,
}: {
  project: string;
  file: string;
  id: string;
  apiKey: string;
  mserve: { protocol?: string; host: string };
}) {
  console.log("deploying file", file, "with id", id);
  interface MMLWorldInstanceRequest {
    name: string;
    mmlDocumentsConfiguration: MMLWorldConfig;
  }

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
  const objectInstancesUrl = `${mserve.protocol}//${mserve.host}/v1/mml-objects/${project}/object-instances`;
  const worldInstancesUrl = `${mserve.protocol}//${mserve.host}/v1/worlds/${project}/web-world-instances`;

  const source = await fs.readFile(file, { encoding: "utf8" });
  if (path.extname(file) === ".html") {
    const request: Request = {
      name: id,
      source: {
        type: "source",
        source,
      },
    };
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
      console.log("object instance does not exist, creating...");
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
      console.log(chalk.red("failed to deploy object instance"), {
        id,
        status,
        message,
      });
      return;
    }
  } else if (file.endsWith(".json")) {
    const request: MMLWorldInstanceRequest = {
      name: id,
      mmlDocumentsConfiguration: JSON.parse(source) as unknown,
    };
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
      console.log("world instance does not exist, creating...");
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
      console.log(chalk.red("failed to deploy world instance"), {
        id,
        status,
        message,
      });
      return;
    }
  }
  console.log(`deployed output ${id} to MServe`);
}

export async function deployFilesOrDirectories({
  apiKey,
  project,
  paths,
  origin,
}: DeployArgs) {
  const parsedURL = parseURL(origin);

  if (parsedURL === null) {
    console.log(chalk.red.bold(`Unable to parse MServe origin: "${origin}"`));
    process.exit(-1);
  }

  const { protocol, host } = parsedURL;

  const deployments: Promise<void>[] = [];

  for (const file of paths) {
    const stat = await fs.stat(file);
    if (
      stat.isFile() &&
      (path.extname(file) === ".html" || path.extname(file) === ".json")
    ) {
      const id = path.basename(file).replace(/\.(html|json)$/, "");
      deployments.push(
        deployFile({
          file,
          id,
          project,
          apiKey,
          mserve: { protocol, host },
        }),
      );
    } else if (stat.isDirectory()) {
      const paths = (await fs.readdir(file)).map((f) => path.join(file, f));
      deployments.push(
        deployFilesOrDirectories({
          paths,
          project,
          apiKey,
          origin,
        }),
      );
    } else {
      console.log("ignoring file:", file);
    }
  }

  await Promise.all(deployments);
}
