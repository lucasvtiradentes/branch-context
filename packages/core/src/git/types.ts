export enum GitFileStatus {
  Added = 'A',
  Modified = 'M',
  Deleted = 'D',
  Renamed = 'R',
}

export const GIT_CONFIG_SCOPE_GLOBAL = 'global';

export type GitConfigScope = typeof GIT_CONFIG_SCOPE_GLOBAL;

export type GitChangedFileSummary = {
  status: GitFileStatus | string;
  path: string;
  oldPath: string | null;
  additions: number | null;
  deletions: number | null;
};

export type GitCommitSummary = {
  shortHash: string;
  hash: string;
  subject: string;
  authoredAt: string;
  authorName: string;
};
