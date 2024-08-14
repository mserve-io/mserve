import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { gzip as gzip_ } from "node:zlib";
import { promisify } from "node:util";

const gzip = promisify(gzip_);

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
  files: string[];
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
  const url = `${mserve.protocol}//${mserve.host}/v1/mml-objects/${project}/object-instances`;
  const source = await fs.readFile(file, { encoding: "utf8" });
  const request: Request = {
    name: id,
    source: {
      type: "source",
      source,
    },
  };
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
    console.log("object instance does not exist, creating...");
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
    console.log(chalk.red("failed to deploy object instance"), {
      id,
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
  console.log(`deployed output ${id} to MServe`);
}

export async function deployFileOrDirectory({
  apiKey,
  project,
  files,
  origin,
}: DeployArgs) {
  const parsedURL = parseURL(origin);

  if (parsedURL === null) {
    console.log(chalk.red.bold(`Unable to parse MServer origin: "${origin}"`));
    process.exit(-1);
  }

  const { protocol, host } = parsedURL;

  for (const file of files) {
    const stat = await fs.stat(file);
    if (stat.isFile() && path.extname(file) === ".html") {
      const id = path.basename(file, ".html");
      void deployFile({
        file,
        id,
        project,
        apiKey,
        mserve: { protocol, host },
      });
    } else if (stat.isDirectory()) {
      const dir = file;
      const files = await fs.readdir(file);
      for (const file of files) {
        const id = path.basename(file, ".html");
        void deployFile({
          file: path.join(dir, file),
          id,
          project,
          apiKey,
          mserve: { protocol, host },
        });
      }
    }
  }
}
