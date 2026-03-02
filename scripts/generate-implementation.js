#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COMPONENTS = {
  backend: {
    sourceFile: 'backend.ts',
    testFile: 'backend.test.ts',
    exportLines: [
      "export { NotificationBackend, NotificationBackendFactory } from './backend';",
    ],
  },
  adapter: {
    sourceFile: 'adapter.ts',
    testFile: 'adapter.test.ts',
    exportLines: [
      "export { NotificationAdapter, NotificationAdapterFactory } from './adapter';",
    ],
  },
  'template-renderer': {
    sourceFile: 'template-renderer.ts',
    testFile: 'template-renderer.test.ts',
    exportLines: [
      "export { TemplateRenderer, TemplateRendererFactory } from './template-renderer';",
    ],
  },
  logger: {
    sourceFile: 'logger.ts',
    testFile: 'logger.test.ts',
    exportLines: ["export { Logger } from './logger';"],
  },
  'attachment-manager': {
    sourceFile: 'attachment-manager.ts',
    testFile: 'attachment-manager.test.ts',
    exportLines: [
      "export { TemplateAttachmentFile, TemplateAttachmentManager } from './attachment-manager';",
    ],
  },
};

const COMPONENT_ALIASES = {
  backend: 'backend',
  backends: 'backend',
  adapter: 'adapter',
  adapters: 'adapter',
  'notification-adapter': 'adapter',
  'notification-adapters': 'adapter',
  logger: 'logger',
  loggers: 'logger',
  'template-renderer': 'template-renderer',
  'template-renderers': 'template-renderer',
  templaterenderer: 'template-renderer',
  renderer: 'template-renderer',
  renderers: 'template-renderer',
  'attachment-manager': 'attachment-manager',
  'attachment-managers': 'attachment-manager',
  attachmentmanager: 'attachment-manager',
  attachments: 'attachment-manager',
};

const COMPONENT_ORDER = [
  'backend',
  'attachment-manager',
  'adapter',
  'template-renderer',
  'logger',
];

function logInfo(message) {
  console.log(`ℹ ${message}`);
}

function logSuccess(message) {
  console.log(`✓ ${message}`);
}

function logError(message) {
  console.error(`✗ ${message}`);
}

function printUsage() {
  console.log(`
Usage:
  node scripts/generate-implementation.js --dir=<directory-name> --package=<package-name> --components=<list>

Required:
  --dir           New implementation directory under src/implementations (example: vintasend-foo)
  --package       package.json name for the new implementation (example: @my-scope/vintasend-foo)
  --components    Comma-separated components to keep

Optional:
  --force         Overwrite target directory if it already exists
  --help          Show this help

Supported components:
  backend, attachment-manager, adapter, template-renderer, logger

Example:
  node scripts/generate-implementation.js \
    --dir=vintasend-aws-ses \
    --package=@acme/vintasend-aws-ses \
    --components=backend,adapter,template-renderer

If one or more required arguments are omitted, the script will prompt for them interactively.
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const output = {
    dirName: null,
    packageName: null,
    components: null,
    force: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      output.help = true;
      continue;
    }

    if (arg === '--force') {
      output.force = true;
      continue;
    }

    if (arg.startsWith('--dir=')) {
      output.dirName = arg.split('=')[1] || null;
      continue;
    }

    if (arg.startsWith('--package=')) {
      output.packageName = arg.split('=')[1] || null;
      continue;
    }

    if (arg.startsWith('--components=')) {
      output.components = arg.split('=')[1] || null;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return output;
}

function validateDirName(dirName) {
  if (!dirName) {
    throw new Error('Missing required argument --dir');
  }

  if (dirName.includes('/') || dirName.includes('\\')) {
    throw new Error('--dir must be a directory name, not a path');
  }

  if (!/^[a-z0-9][a-z0-9-._]*$/i.test(dirName)) {
    throw new Error('--dir contains invalid characters');
  }
}

function validatePackageName(packageName) {
  if (!packageName) {
    throw new Error('Missing required argument --package');
  }

  if (packageName.includes(' ')) {
    throw new Error('--package must not contain spaces');
  }
}

function normalizeComponents(componentsRaw) {
  if (!componentsRaw) {
    throw new Error('Missing required argument --components');
  }

  const requested = componentsRaw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (requested.length === 0) {
    throw new Error('--components must contain at least one component');
  }

  const normalized = new Set();
  for (const component of requested) {
    const canonical = COMPONENT_ALIASES[component];
    if (!canonical) {
      const supported = Object.keys(COMPONENTS).join(', ');
      throw new Error(`Unsupported component: "${component}". Supported: ${supported}`);
    }
    normalized.add(canonical);
  }

  return COMPONENT_ORDER.filter((component) => normalized.has(component));
}

function removeFileIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
  }
}

function buildReadmeContent(packageName, dirName, keptComponents) {
  const bullets = keptComponents
    .map((component) => `- \`${component}\``)
    .join('\n');

  return `# ${packageName}

Generated from \`vintasend-implementation-template\`.

## Included components

${bullets}

## Quick start

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
2. Implement the selected component files in \`src/\`.
3. Run tests:
   \`\`\`bash
   npm test
   \`\`\`
4. Build:
   \`\`\`bash
   npm run build
   \`\`\`

## Notes

- Directory: \`src/implementations/${dirName}\`
- Package name: \`${packageName}\`
`;
}

function updatePackageJson(packageJsonPath, packageName, keptComponents) {
  const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageData.name = packageName;
  packageData.description = `VintaSend implementation package (${keptComponents.join(', ')})`;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageData, null, 2)}\n`, 'utf8');
}

function writeIndex(indexPath, keptComponents) {
  const exports = keptComponents.flatMap((component) => COMPONENTS[component].exportLines);
  const indexContent = `${exports.join('\n')}\n`;
  fs.writeFileSync(indexPath, indexContent, 'utf8');
}

function pruneFiles(targetDir, keptComponents) {
  const sourceDir = path.join(targetDir, 'src');
  const testsDir = path.join(sourceDir, '__tests__');
  const keepSet = new Set(keptComponents);

  for (const [component, metadata] of Object.entries(COMPONENTS)) {
    if (keepSet.has(component)) {
      continue;
    }

    removeFileIfExists(path.join(sourceDir, metadata.sourceFile));
    removeFileIfExists(path.join(testsDir, metadata.testFile));
  }
}

function copyTemplate(templateDir, targetDir, force) {
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template directory not found: ${templateDir}`);
  }

  if (fs.existsSync(targetDir)) {
    if (!force) {
      throw new Error(`Target directory already exists: ${targetDir}. Use --force to overwrite.`);
    }
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  fs.cpSync(templateDir, targetDir, { recursive: true });
}

function cleanupReadme(readmePath, packageName, dirName, keptComponents) {
  const content = buildReadmeContent(packageName, dirName, keptComponents);
  fs.writeFileSync(readmePath, content, 'utf8');
}

function createQuestionInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function askQuestion(rl, message) {
  return new Promise((resolve) => {
    rl.question(message, resolve);
  });
}

async function promptUntilValid(rl, questionText, resolver) {
  while (true) {
    const rawValue = await askQuestion(rl, questionText);
    const value = rawValue.trim();

    try {
      return resolver(value);
    } catch (error) {
      logError(error.message);
    }
  }
}

function hasMissingRequiredArgs(parsedArgs) {
  return !parsedArgs.dirName || !parsedArgs.packageName || !parsedArgs.components;
}

async function collectInteractiveInput(parsedArgs, rl) {
  const result = {
    dirName: parsedArgs.dirName,
    packageName: parsedArgs.packageName,
    componentsRaw: parsedArgs.components,
  };

  if (!result.dirName) {
    result.dirName = await promptUntilValid(
      rl,
      'Directory name (inside src/implementations): ',
      (input) => {
        validateDirName(input);
        return input;
      },
    );
  }

  if (!result.packageName) {
    result.packageName = await promptUntilValid(rl, 'Package name: ', (input) => {
      validatePackageName(input);
      return input;
    });
  }

  if (!result.componentsRaw) {
    result.componentsRaw = await promptUntilValid(
      rl,
      `Components to keep (comma-separated: ${Object.keys(COMPONENTS).join(', ')}): `,
      (input) => {
        normalizeComponents(input);
        return input;
      },
    );
  }

  return result;
}

async function shouldForceOverwriteIfNeeded(rl, targetDir, forceFromArgs) {
  if (forceFromArgs) {
    return true;
  }

  if (!fs.existsSync(targetDir)) {
    return false;
  }

  if (!rl) {
    throw new Error(`Target directory already exists: ${targetDir}. Use --force to overwrite.`);
  }

  const answer = await askQuestion(
    rl,
    `Target directory already exists (${targetDir}). Overwrite it? (y/N): `,
  );

  return ['y', 'yes'].includes(answer.trim().toLowerCase());
}

async function main() {
  let rl = null;

  try {
    const parsed = parseArgs(process.argv);

    if (parsed.help) {
      printUsage();
      process.exit(0);
    }

    let dirName = parsed.dirName;
    let packageName = parsed.packageName;
    let componentsRaw = parsed.components;

    if (hasMissingRequiredArgs(parsed)) {
      rl = createQuestionInterface();
      logInfo('Missing required arguments. Starting interactive setup...');

      const interactiveInput = await collectInteractiveInput(parsed, rl);
      dirName = interactiveInput.dirName;
      packageName = interactiveInput.packageName;
      componentsRaw = interactiveInput.componentsRaw;
    }

    validateDirName(dirName);
    validatePackageName(packageName);

    const keptComponents = normalizeComponents(componentsRaw);

    const rootDir = path.join(__dirname, '..');
    const implementationsDir = path.join(rootDir, 'src', 'implementations');
    const templateDir = path.join(implementationsDir, 'vintasend-implementation-template');
    const targetDir = path.join(implementationsDir, dirName);
    const force = await shouldForceOverwriteIfNeeded(rl, targetDir, parsed.force);

    if (fs.existsSync(targetDir) && !force) {
      throw new Error('Generation canceled: target directory already exists.');
    }

    if (path.resolve(templateDir) === path.resolve(targetDir)) {
      throw new Error('--dir cannot be vintasend-implementation-template');
    }

    logInfo('Copying template...');
    copyTemplate(templateDir, targetDir, force);

    logInfo('Removing unused component files...');
    pruneFiles(targetDir, keptComponents);

    logInfo('Updating exports...');
    writeIndex(path.join(targetDir, 'src', 'index.ts'), keptComponents);

    logInfo('Updating package metadata...');
    updatePackageJson(path.join(targetDir, 'package.json'), packageName, keptComponents);

    logInfo('Cleaning README...');
    cleanupReadme(
      path.join(targetDir, 'README.md'),
      packageName,
      dirName,
      keptComponents,
    );

    logSuccess(`Implementation generated at src/implementations/${dirName}`);
  } catch (error) {
    logError(error.message);
    printUsage();
    process.exit(1);
  } finally {
    if (rl) {
      rl.close();
    }
  }
}

main();
