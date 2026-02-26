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

function toPosix(filePath) {
  return filePath.replace(/\\/g, "/");
}

function getLocalSpec(packageDir, repoRoot) {
  const relative = toPosix(path.relative(packageDir, repoRoot)) || ".";
  return `file:${relative}`;
}

function readPackageJson(packagePath) {
  return JSON.parse(fs.readFileSync(packagePath, "utf8"));
}

function writePackageJson(packagePath, data) {
  fs.writeFileSync(packagePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function ensureLocalVintaSend(pkgJson, localSpec) {
  let changed = false;

  if (pkgJson.dependencies?.vintasend) {
    pkgJson.dependencies.vintasend = localSpec;
    changed = true;
  }

  if (pkgJson.peerDependencies?.vintasend) {
    pkgJson.peerDependencies.vintasend = localSpec;
    changed = true;
  }

  if (!pkgJson.dependencies?.vintasend && !pkgJson.devDependencies?.vintasend) {
    pkgJson.devDependencies = {
      ...(pkgJson.devDependencies || {}),
      vintasend: localSpec,
    };
    changed = true;
  }

  return changed;
}

const repoRoot = process.cwd();
const implementationsRoot = path.join(repoRoot, "src", "implementations");
const originalContents = new Map();
const requestedImplementations = process.argv.slice(2);

const allImplementationDirs = fs
  .readdirSync(implementationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .filter((entry) => entry.name !== "vintasend-implementation-template")
  .map((entry) => path.join(implementationsRoot, entry.name))
  .filter((dirPath) => fs.existsSync(path.join(dirPath, "package.json")));

const implementationDirs =
  requestedImplementations.length > 0
    ? allImplementationDirs.filter((dirPath) =>
        requestedImplementations.includes(path.basename(dirPath)),
      )
    : allImplementationDirs;

if (requestedImplementations.length > 0) {
  const foundImplementations = new Set(
    implementationDirs.map((dirPath) => path.basename(dirPath)),
  );
  const missingImplementations = requestedImplementations.filter(
    (name) => !foundImplementations.has(name),
  );

  if (missingImplementations.length > 0) {
    console.error(
      `Unknown implementation(s): ${missingImplementations.join(", ")}`,
    );
    process.exit(1);
  }
}

if (implementationDirs.length === 0) {
  console.log("No implementation packages found.");
  process.exit(0);
}

try {
  console.log("Building local vintasend...");
  run("npm", ["run", "build"], repoRoot);

  for (const packageDir of implementationDirs) {
    const packagePath = path.join(packageDir, "package.json");
    const original = fs.readFileSync(packagePath, "utf8");
    originalContents.set(packagePath, original);

    const pkgJson = readPackageJson(packagePath);
    const localSpec = getLocalSpec(packageDir, repoRoot);

    if (ensureLocalVintaSend(pkgJson, localSpec)) {
      writePackageJson(packagePath, pkgJson);
    }
  }

  for (const packageDir of implementationDirs) {
    const name = path.basename(packageDir);
    console.log(`\nTesting ${name} with local vintasend...`);
    run("npm", ["install", "--no-package-lock"], packageDir);
    run("npm", ["test"], packageDir);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  for (const [packagePath, original] of originalContents.entries()) {
    fs.writeFileSync(packagePath, original, "utf8");
  }
}
