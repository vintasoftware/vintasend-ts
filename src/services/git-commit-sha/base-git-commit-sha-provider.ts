/**
 * Base interface for Git commit SHA providers.
 * 
 * Implementations of this interface can resolve the current Git commit SHA
 * at runtime, allowing VintaSend to automatically track which version of code
 * produced each notification render.
 * 
 * @example
 * ```typescript
 * // Environment variable provider
 * class EnvGitCommitShaProvider implements BaseGitCommitShaProvider {
 *   getCurrentGitCommitSha(): string | null {
 *     return process.env.GIT_COMMIT_SHA || null;
 *   }
 * }
 * 
 * // Shell command provider (for development)
 * class ShellGitCommitShaProvider implements BaseGitCommitShaProvider {
 *   async getCurrentGitCommitSha(): Promise<string | null> {
 *     try {
 *       const { execSync } = require('child_process');
 *       const sha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
 *       return sha || null;
 *     } catch {
 *       return null;
 *     }
 *   }
 * }
 * ```
 */
export interface BaseGitCommitShaProvider {
  /**
   * Resolve the current Git commit SHA.
   * 
   * Must return:
   * - Full 40-character hex SHA (will be normalized to lowercase)
   * - null if SHA cannot be determined
   * 
   * May return synchronously or asynchronously.
   * Invalid SHA formats will be rejected at notification creation boundary.
   * 
   * @returns The current Git commit SHA, or null if unavailable
   */
  getCurrentGitCommitSha(): string | Promise<string | null> | null;
}
