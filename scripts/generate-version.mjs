#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const resolveGit = (command) => {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
};

const readManifestVersion = () => {
  try {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    return typeof manifest.version === "string" && manifest.version.length > 0
      ? manifest.version
      : "0.0.0";
  } catch {
    return "0.0.0";
  }
};

const version = readManifestVersion();
const branch = process.env.GIT_BRANCH || resolveGit("git rev-parse --abbrev-ref HEAD");
const commit = process.env.GIT_COMMIT || resolveGit("git rev-parse --short HEAD");

const output = `export const PLUGIN_VERSION = ${JSON.stringify(version)};\n` +
  `export const GIT_BRANCH = ${JSON.stringify(branch)};\n` +
  `export const GIT_COMMIT = ${JSON.stringify(commit)};\n`;

writeFileSync("version.ts", output, "utf8");
