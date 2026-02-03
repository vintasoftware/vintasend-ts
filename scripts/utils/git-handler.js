const { execSync } = require('child_process');

/**
 * Stage files for commit
 * @param {string[]} files - Array of file paths to stage
 * @param {boolean} dryRun - If true, don't actually stage files
 * @param {string} cwd - Working directory to run git command in
 */
function stageFiles(files, dryRun = false, cwd = process.cwd()) {
  if (files.length === 0) return;

  // Use -A flag to include untracked files when staging all
  const isStageAll = files.length === 1 && files[0] === '.';
  const command = isStageAll ? 'git add -A' : `git add ${files.join(' ')}`;

  if (dryRun) {
    return { command, dryRun: true };
  }

  try {
    execSync(command, { encoding: 'utf8', stdio: 'inherit', cwd });
    return { command, success: true };
  } catch (error) {
    throw new Error(`Failed to stage files: ${error.message}`);
  }
}

/**
 * Commit staged changes
 * @param {string} message - Commit message
 * @param {boolean} dryRun - If true, don't actually commit
 * @param {string} cwd - Working directory to run git command in
 */
function commit(message, dryRun = false, cwd = process.cwd()) {
  const command = `git commit -m "${message}"`;

  if (dryRun) {
    return { command, dryRun: true };
  }

  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe', cwd });
    return { command, output, success: true };
  } catch (error) {
    throw new Error(`Failed to commit: ${error.message}`);
  }
}

/**
 * Check git status
 * @returns {string} - Git status output
 */
function getStatus() {
  try {
    return execSync('git status --porcelain', { encoding: 'utf8' });
  } catch (error) {
    throw new Error(`Failed to get git status: ${error.message}`);
  }
}

/**
 * Check if working directory is clean
 * @returns {boolean}
 */
function isClean() {
  const status = getStatus();
  return status.trim().length === 0;
}

module.exports = {
  stageFiles,
  commit,
  getStatus,
  isClean
};
