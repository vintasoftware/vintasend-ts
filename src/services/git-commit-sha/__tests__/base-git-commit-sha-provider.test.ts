import type { BaseGitCommitShaProvider } from '../base-git-commit-sha-provider';

describe('BaseGitCommitShaProvider', () => {
  describe('interface contract', () => {
    it('should allow synchronous string return', () => {
      const provider: BaseGitCommitShaProvider = {
        getCurrentGitCommitSha: () => 'abc123def456789012345678901234567890abcd',
      };

      const result = provider.getCurrentGitCommitSha();
      expect(result).toBe('abc123def456789012345678901234567890abcd');
    });

    it('should allow synchronous null return', () => {
      const provider: BaseGitCommitShaProvider = {
        getCurrentGitCommitSha: () => null,
      };

      const result = provider.getCurrentGitCommitSha();
      expect(result).toBeNull();
    });

    it('should allow async string return', async () => {
      const provider: BaseGitCommitShaProvider = {
        getCurrentGitCommitSha: async () => 'abc123def456789012345678901234567890abcd',
      };

      const result = await provider.getCurrentGitCommitSha();
      expect(result).toBe('abc123def456789012345678901234567890abcd');
    });

    it('should allow async null return', async () => {
      const provider: BaseGitCommitShaProvider = {
        getCurrentGitCommitSha: async () => null,
      };

      const result = await provider.getCurrentGitCommitSha();
      expect(result).toBeNull();
    });
  });

  describe('example implementations', () => {
    it('should support environment variable provider', () => {
      class EnvGitCommitShaProvider implements BaseGitCommitShaProvider {
        getCurrentGitCommitSha(): string | null {
          return process.env.GIT_COMMIT_SHA || null;
        }
      }

      const provider = new EnvGitCommitShaProvider();
      expect(provider).toBeDefined();
      const result = provider.getCurrentGitCommitSha();
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should support static value provider', () => {
      class StaticGitCommitShaProvider implements BaseGitCommitShaProvider {
        constructor(private readonly sha: string | null) {}

        getCurrentGitCommitSha(): string | null {
          return this.sha;
        }
      }

      const provider = new StaticGitCommitShaProvider('abc123def456789012345678901234567890abcd');
      expect(provider.getCurrentGitCommitSha()).toBe('abc123def456789012345678901234567890abcd');

      const nullProvider = new StaticGitCommitShaProvider(null);
      expect(nullProvider.getCurrentGitCommitSha()).toBeNull();
    });

    it('should support async provider with fallback logic', async () => {
      class AsyncGitCommitShaProviderWithFallback implements BaseGitCommitShaProvider {
        async getCurrentGitCommitSha(): Promise<string | null> {
          try {
            // Simulate async operation
            await new Promise((resolve) => setTimeout(resolve, 10));
            return process.env.GIT_COMMIT_SHA || null;
          } catch {
            return null;
          }
        }
      }

      const provider = new AsyncGitCommitShaProviderWithFallback();
      const result = await provider.getCurrentGitCommitSha();
      expect(result).toBeDefined();
    });
  });

  describe('type safety', () => {
    it('should enforce return type contract', () => {
      // These should all compile successfully
      const syncString: BaseGitCommitShaProvider = {
        getCurrentGitCommitSha: () => 'abc123',
      };

      const syncNull: BaseGitCommitShaProvider = {
        getCurrentGitCommitSha: () => null,
      };

      const asyncString: BaseGitCommitShaProvider = {
        getCurrentGitCommitSha: async () => 'abc123',
      };

      const asyncNull: BaseGitCommitShaProvider = {
        getCurrentGitCommitSha: async () => null,
      };

      expect(syncString).toBeDefined();
      expect(syncNull).toBeDefined();
      expect(asyncString).toBeDefined();
      expect(asyncNull).toBeDefined();
    });
  });
});
