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

type CommitSyncSkipReason = 'not_initialized' | 'no_current_branch' | 'missing_context';

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
    return skipped('not_initialized');
  }

  const branch = getCurrentBranch(gitRoot);
  if (!branch) {
    return skipped('no_current_branch');
  }

  const branchKey = sanitizeBranchName(branch);
  const contextDir = join(gitRoot, DEFAULT_SYMLINK);
  if (!existsSync(contextDir)) {
    return skipped('missing_context');
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
