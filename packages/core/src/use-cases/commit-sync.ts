import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SYMLINK } from '../constants';
import { type TagUpdate, updateContextTags } from '../core/context-tags';
import { getCurrentBranch } from '../core/hooks';
import { CreateBranchContextResult, sanitizeBranchName, syncBranch } from '../core/sync';
import { getBaseBranch } from '../data/branch-base';
import { Config, configExists } from '../data/config';
import { updateBranchMeta } from '../data/meta';
import { syncAgentSessions } from './agents';

const checkoutStatuses: Partial<Record<CreateBranchContextResult, string>> = {
  [CreateBranchContextResult.RestoredFromArchive]: 'restored',
  [CreateBranchContextResult.RepairedFromTemplate]: 'repaired',
  [CreateBranchContextResult.Exists]: 'synced',
};

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

export type CheckoutSyncResult =
  | {
      ok: true;
      skipped: false;
      status: string;
      updates: TagUpdate[];
    }
  | {
      ok: true;
      skipped: true;
      reason: CommitSyncSkipReason.NotInitialized;
      updates: [];
    };

export function syncBranchAfterCheckout(gitRoot: string, newBranch: string): CheckoutSyncResult {
  if (!configExists(gitRoot)) {
    return checkoutSkipped(CommitSyncSkipReason.NotInitialized);
  }

  const result = syncBranch(gitRoot, newBranch);
  const branchKey = sanitizeBranchName(newBranch);
  const contextDir = result.branch_dir;
  const baseBranch = getBaseBranch(gitRoot, contextDir);
  const config = Config.load(gitRoot);

  updateBranchMeta(gitRoot, branchKey, baseBranch, config.commitDescription);

  return {
    ok: true,
    skipped: false,
    status: checkoutStatuses[result.create_result] ?? 'new',
    updates: updateContextTags(gitRoot, contextDir, branchKey, baseBranch),
  };
}

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

function checkoutSkipped(reason: CommitSyncSkipReason.NotInitialized): CheckoutSyncResult {
  return {
    ok: true,
    skipped: true,
    reason,
    updates: [],
  };
}
