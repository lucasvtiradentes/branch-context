import {
  type GitChangedFileSummary,
  type GitCommitSummary,
  gitChangedFileSummaries,
  gitCommitSummaries,
  gitRefExists,
} from '../utils/git';

export type BranchGitSummary =
  | {
      ok: true;
      baseBranch: string;
      changedFiles: GitChangedFileSummary[];
      commits: GitCommitSummary[];
    }
  | {
      ok: false;
      reason: 'missing_base' | 'base_not_found';
      baseBranch: string | null;
      changedFiles: [];
      commits: [];
    };

export type { GitChangedFileSummary, GitCommitSummary };

export function getGitBranchSummary(
  workspace: string,
  baseBranch: string | null,
): BranchGitSummary {
  if (!baseBranch) {
    return {
      ok: false,
      reason: 'missing_base',
      baseBranch: null,
      changedFiles: [],
      commits: [],
    };
  }

  if (!gitRefExists(workspace, baseBranch)) {
    return {
      ok: false,
      reason: 'base_not_found',
      baseBranch,
      changedFiles: [],
      commits: [],
    };
  }

  return {
    ok: true,
    baseBranch,
    changedFiles: gitChangedFileSummaries(workspace, baseBranch),
    commits: gitCommitSummaries(workspace, baseBranch),
  };
}
