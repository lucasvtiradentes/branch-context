import { execFileSync } from 'node:child_process';

const customType = 'branch-context';

type ExtensionAPI = {
  on(event: 'session_start', handler: (event: SessionStartEvent, ctx: PiContext) => unknown): void;
  appendEntry(customType: string, data?: Record<string, unknown>): void;
};

type SessionStartEvent = {
  reason?: string;
};

type PiContext = {
  cwd?: string;
  sessionManager?: {
    getSessionFile?: () => string | null;
  };
};

export default function branchContextPi(pi: ExtensionAPI): void {
  pi.on('session_start', (_event: SessionStartEvent, ctx: PiContext) => {
    const cwd = ctx.cwd || process.cwd();
    const sessionFile = ctx.sessionManager?.getSessionFile?.();
    if (!sessionFile) {
      return;
    }

    const git = getGitContext(cwd);
    if (!git) {
      return;
    }

    pi.appendEntry(customType, {
      cwd,
      repoRoot: git.repoRoot,
      gitBranch: git.gitBranch,
      recordedAt: new Date().toISOString(),
    });
  });
}

function getGitContext(cwd: string): { repoRoot: string; gitBranch: string } | null {
  const repoRoot = runGit(cwd, ['rev-parse', '--show-toplevel']);
  const gitBranch = runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);

  if (!repoRoot || !gitBranch || gitBranch === 'HEAD') {
    return null;
  }

  return { repoRoot, gitBranch };
}

function runGit(cwd: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}
