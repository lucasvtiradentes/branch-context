import type * as vscode from 'vscode';
import { registerAgentSessionActionCommands } from './agent-session-actions';
import { registerApplyTemplateCommand } from './apply-template';
import { registerContextActionCommands } from './context-actions';
import { registerGroupAgentSessionsCommand } from './group-agent-sessions';
import { registerGroupContextsCommand } from './group-contexts';
import { registerGroupGitChangedFilesCommand } from './group-git-changed-files';
import { registerGroupGitCommitsCommand } from './group-git-commits';
import { registerOpenCommitDiffCommand } from './open-commit-diff';
import { registerOpenConfigCommand } from './open-config';
import { registerOpenCurrentContextCommand } from './open-current-context';
import { registerOpenCurrentContextFolderCommand } from './open-current-context-folder';
import { registerResumeAgentSessionCommand } from './resume-agent-session';
import { registerReviewDiffCommand } from './review-diff';
import { registerSetBaseCommand } from './set-base';
import { registerShowLogsCommand } from './show-logs';
import { registerStatusCommand } from './status';
import { registerSyncCommand } from './sync';
import { registerToggleAgentSessionTextCommand } from './toggle-agent-session-text';
import { registerToggleGitChangesModeCommand } from './toggle-git-changes-mode';

export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    registerOpenCurrentContextCommand(),
    registerSyncCommand(),
    registerStatusCommand(),
    registerSetBaseCommand(),
    registerApplyTemplateCommand(),
    registerOpenConfigCommand(),
    registerOpenCommitDiffCommand(),
    registerOpenCurrentContextFolderCommand(),
    registerResumeAgentSessionCommand(),
    registerReviewDiffCommand(),
    registerToggleGitChangesModeCommand(context),
    registerGroupGitChangedFilesCommand(context),
    registerGroupGitCommitsCommand(context),
    registerGroupAgentSessionsCommand(context),
    registerToggleAgentSessionTextCommand(context),
    registerGroupContextsCommand(context),
    registerShowLogsCommand(),
    ...registerAgentSessionActionCommands(),
    ...registerContextActionCommands(),
  );
}
