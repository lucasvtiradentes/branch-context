import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SYMLINK } from '../constants';
import { type TagUpdate, updateContextTags } from '../core/context-tags';
import { getCurrentBranch } from '../core/hooks';
import { sanitizeBranchName } from '../core/sync';
import { getBaseBranch } from '../data/branch-base';
import { Config, configExists } from '../data/config';
import { updateBranchMeta } from '../data/meta';
import { syncAgentSessions } from './agents';

export enum CommitSyncSkipReason {
  NotInitialized = 'not_initialized',
  NoCurrentBranch = 'no_current_branch',
  MissingContext = 'missing_context',
}

export type CommitSyncResult =
  | {
      ok: true;
      skipped: false;
      updates: TagUpdate[];
    }
  | {
      ok: true;
      skipped: true;
      reason: CommitSyncSkipReason;
      updates: [];
    };

export function syncBranchAfterCommit(gitRoot: string): CommitSyncResult {
  if (!configExists(gitRoot)) {
    return skipped(CommitSyncSkipReason.NotInitialized);
  }

  const branch = getCurrentBranch(gitRoot);
  if (!branch) {
    return skipped(CommitSyncSkipReason.NoCurrentBranch);
  }

  const branchKey = sanitizeBranchName(branch);
  const contextDir = join(gitRoot, DEFAULT_SYMLINK);
  if (!existsSync(contextDir)) {
    return skipped(CommitSyncSkipReason.MissingContext);
  }

  const baseBranch = getBaseBranch(gitRoot, contextDir);
  const config = Config.load(gitRoot);
  updateBranchMeta(gitRoot, branchKey, baseBranch, config.commitDescription);
  syncAgentSessions(gitRoot);

  return {
    ok: true,
    skipped: false,
    updates: updateContextTags(gitRoot, contextDir, branchKey, baseBranch),
  };
}

function skipped(reason: CommitSyncSkipReason): CommitSyncResult {
  return {
    ok: true,
    skipped: true,
    reason,
    updates: [],
  };
}
