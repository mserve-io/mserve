#!/usr/bin/env node
import yargs from "yargs";
import { deployFilesOrDirectories } from "./deploy.js";

async function main() {
  await yargs(process.argv.slice(2))
    .scriptName("mserve")
    .env("MSERVE")
    .completion()
    .options({
      "api-key": {
        alias: "a",
        demandOption: true,
        describe: "your MServe API key",
        type: "string",
      },
      project: {
        alias: "p",
        demandOption: true,
        description: "The project ID to deploy to",
        type: "string",
      },
      origin: {
        alias: ["base-url", "o"],
        description: "MServe API origin or base URL",
        type: "string",
        default: "https://api.mserve.io",
      },
    })
    .command(
      "deploy [files..]",
      "deploy files or directories to MServe",
      (yargs) => {
        return yargs.positional("files", {
          array: true,
          type: "string",
          description: "the files or directories to deploy",
          default: ".",
        }).argv;
      },
      async (argv) => {
        const { apiKey, project, origin } = argv;
        const paths = argv.files as string[];
        await deployFilesOrDirectories({ apiKey, project, paths, origin });
      },
    )
    .help()
    .parse();
}

void main().then(() => process.exit(0));
