#!/usr/bin/env node

import { spawn } from "node:child_process";
import { watch } from "node:fs";

const mode = process.argv[2] ?? "dev";
const watchFiles = new Set(["manifest.json", "main.js", "styles.css"]);

let timer = null;
let running = false;
let pending = false;

const runDeploy = () => {
  if (running) {
    pending = true;
    return;
  }

  running = true;
  const child = spawn("./deploy.sh", [mode], { stdio: "inherit" });

  child.on("exit", () => {
    running = false;
    if (pending) {
      pending = false;
      runDeploy();
    }
  });
};

const scheduleDeploy = () => {
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(runDeploy, 200);
};

watch(process.cwd(), { persistent: true }, (_event, filename) => {
  if (!filename || watchFiles.has(filename)) {
    scheduleDeploy();
  }
});

runDeploy();
