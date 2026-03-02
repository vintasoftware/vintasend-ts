#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function getImplementationsRoot(repoRoot) {
  return path.join(repoRoot, "src", "implementations");
}

function getImplementationDirs(implementationsRoot) {
  return fs
    .readdirSync(implementationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'vintasend-implementation-template')
    .map((entry) => path.join(implementationsRoot, entry.name))
    .filter((dirPath) => fs.existsSync(path.join(dirPath, "package.json")))
    .sort((a, b) => a.localeCompare(b));
}

const scriptName = process.argv[2];

if (!scriptName) {
  console.error("Usage: node scripts/run-implementations-script.js <script>");
  process.exit(1);
}

const repoRoot = process.cwd();
const implementationsRoot = getImplementationsRoot(repoRoot);
const implementationDirs = getImplementationDirs(implementationsRoot);

if (implementationDirs.length === 0) {
  console.log("No implementation packages found.");
  process.exit(0);
}

for (const packageDir of implementationDirs) {
  const name = path.basename(packageDir);
  console.log(`\nRunning ${scriptName} in ${name}...`);
  run("npm", ["run", scriptName], packageDir);
}
