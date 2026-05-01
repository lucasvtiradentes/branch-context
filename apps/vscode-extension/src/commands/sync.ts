import { syncCurrentBranch } from '@branch-context/core';
import * as vscode from 'vscode';
import { APP_NAME, commandIds } from '../constants';
import { refreshBranchContextState } from '../core/state';
import { formatError } from '../lib/format-error';
import { formatLogError, logger } from '../lib/logging';
import { formatActionError, getInitializedState } from './helpers';

export function registerSyncCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(commandIds.sync, async () => {
    try {
      logger.info('sync command invoked');
      const state = await getInitializedState();
      if (!state?.workspaceRoot) {
        logger.warning('sync command aborted: no initialized workspace');
        return;
      }

      logger.info(
        `sync command running: workspace=${state.workspaceRoot} branch=${state.currentBranch ?? 'none'} contextFile=${state.currentContextFile ?? 'none'}`,
      );
      const result = syncCurrentBranch(state.workspaceRoot, { sound: false });
      if (!result.ok) {
        logger.warning(
          `sync command failed: reason=${result.reason} branch=${result.branch ?? 'none'} message=${result.message}`,
        );
        refreshBranchContextState();
        await vscode.window.showErrorMessage(formatActionError(result));
        return;
      }

      logger.info(
        [
          'sync command result:',
          `branch=${result.branch}`,
          `base=${result.baseBranch}`,
          `contextDir=${result.contextDir}`,
          `create=${result.createResult}`,
          `symlink=${result.symlinkResult}`,
          `updates=${result.updates.length}`,
        ].join(' '),
      );
      logger.debug(`sync command updates: ${formatUpdates(result.updates)}`);
      refreshBranchContextState();
      const status =
        result.createResult === 'created_from_template'
          ? 'created from template'
          : result.createResult === 'repaired_from_template'
            ? 'repaired from template'
            : result.createResult === 'created_empty'
              ? 'created'
              : 'synced';
      await vscode.window.showInformationMessage(
        `${APP_NAME}: ${status} '${result.branch}' (${result.updates.length} tag updates)`,
      );
    } catch (error) {
      logger.error(`sync command error: ${formatLogError(error)}`);
      await vscode.window.showErrorMessage(formatError(error));
    }
  });
}

type SyncUpdate =
  ReturnType<typeof syncCurrentBranch> extends infer Result
    ? Result extends { ok: true; updates: infer Updates }
      ? Updates extends Array<infer Update>
        ? Update
        : never
      : never
    : never;

function formatUpdates(updates: SyncUpdate[]): string {
  if (updates.length === 0) {
    return 'none';
  }

  return updates
    .map((update) =>
      [
        `file=${update.file}`,
        `tag=${update.tag}`,
        `old=${truncate(update.old_content)}`,
        `new=${truncate(update.new_content)}`,
      ].join(' '),
    )
    .join(' | ');
}

function truncate(value: string): string {
  return value.length > 180 ? `${value.slice(0, 180)}...` : value;
}
