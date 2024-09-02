# MServe

[![main github actions](https://github.com/mserve-io/mserve/actions/workflows/main.yaml/badge.svg)](https://github.com/mserve-io/mserve/actions/workflows/main.yaml)
[![npm version](https://img.shields.io/npm/v/%40mserve-io%2Fmserve?style=flat)](https://www.npmjs.com/package/@mserve-io/mserve)
![GitHub top language](https://img.shields.io/github/languages/top/mserve-io/mserve) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/mserve-io/mserve/blob/main/LICENSE)

[MServe](https://mserve.io) allows you to easily create and host virtual worlds populated with [https://mml.io](MML Documents).

This repository contains tools to aid in deploying your MML documents and world configurations to MServe from the command line or as hook for [esbuild-plugin-mml](https://github.com/mml-io/esbuild-plugin-mml).

## CLI

The CLI currently supports deploying a set of MML documents files (or a directory containing them) to a specific project on MServe.

#### Installation

```
npm i -g @mserve-io/mserve
```

This project also provides a [Nix](https://nixos.org) flake that packages the CLI with it's shell completions.

#### Shell Completions

Shell completions can be generated for your current shell, with install instructions, using the following command:

```shell
mserve completion
```

You can get completions for a specific shell by setting the `$SHELL` environment variable:

```shell
SHELL=bash mserve completion >> ~/.bashrc
```

### Authentication

This tool requires an MServe API key with at least `write` permissions to MML Objects the target project. This can be specified on the command line with the `--api-key` flag, or as an environment variable (recommended).

```shell
mserve --api-key 'msak_<XX>' ...
```

```shell
export MSERVE_API_KEY='msak_<XX>'
mserve ...
```

### Deploy
```
mserve deploy --project <project-id> ./examples
```

## esbuild plugin

This library exports an `OutputProcessorProvider` for [esbuild-plugin-mml](https://github.com/mml-io/esbuild-plugin-mml), which hooks into the build process, re-writes the imports to a format usable on MServe, and optionally deploy them to your chosen project.

Below is an example usage of the outputProcessor

```typescript
import { mserveOutputProcessor } from "@mml-io/mserve";

const {
  MSERVE_PROJECT,
  MSERVE_API_KEY,
  MSERVE_PROTOCOL,
  MSERVE_HOST,
  MMLHOSTING_PROTOCOL = "wss",
  MMLHOSTING_HOST = "mmlhosting.com"
} = process.env as { [env: string]: string };

const buildOptions: esbuild.BuildOptions = {
  entryPoints: ["src/world.ts"],
  outdir,
  bundle: true,
  minify: true,
  plugins: [
    mml({
      verbose: true,
      outputProcessor: mserveOutputProcessor({
        deploy: true, // Optional: Deploy the artifacts to MServe after they have been processed
        mserve: { // Optional: Used to override the endpoint to deploy to for testing purposes.
          host: MSERVE_HOST,
          protocol: MSERVE_PROTOCOL,
        },
        projectId: MSERVE_PROJECT, // Required: The project to deploy the documents and world config to
        apiKey: MSERVE_API_KEY, // Required: Your MServe API key
      }),
      importPrefix: `${MMLHOSTING_PROTOCOL}://${MMLHOSTING_HOST}/v1/`, // Required: re-write the imports to a full URL to the document.
    }),
  ],
};

esbuild.build(buildOptions).catch(() => process.exit(1));
```

