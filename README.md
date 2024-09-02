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
npm i -g git+https://github.com/mserve-io/mserve.git
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

TODO
