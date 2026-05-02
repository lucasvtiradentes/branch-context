import {
  type GitChangedFileSummary,
  type GitCommitSummary,
  gitChangedFileSummaries,
  gitCommitSummaries,
  gitRefExists,
} from '../git';

export enum BranchGitSummaryErrorReason {
  MissingBase = 'missing_base',
  BaseNotFound = 'base_not_found',
}

export type BranchGitSummary =
  | {
      ok: true;
      baseBranch: string;
      changedFiles: GitChangedFileSummary[];
      commits: GitCommitSummary[];
    }
  | {
      ok: false;
      reason: BranchGitSummaryErrorReason;
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
      reason: BranchGitSummaryErrorReason.MissingBase,
      baseBranch: null,
      changedFiles: [],
      commits: [],
    };
  }

  if (!gitRefExists(workspace, baseBranch)) {
    return {
      ok: false,
      reason: BranchGitSummaryErrorReason.BaseNotFound,
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
