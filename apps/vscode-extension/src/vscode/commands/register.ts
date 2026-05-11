import type * as vscode from 'vscode';
import { registerAgentSessionActionCommands } from '../../features/agent-sessions/commands/agent-session-actions';
import { registerGroupAgentSessionsCommand } from '../../features/agent-sessions/commands/group-agent-sessions';
import { registerResumeAgentSessionCommand } from '../../features/agent-sessions/commands/resume-agent-session';
import {
  registerSyncAgentsCommand,
  registerSyncAllAgentSessionsCommand,
} from '../../features/agent-sessions/commands/sync-agents';
import { registerToggleAgentSessionTextCommand } from '../../features/agent-sessions/commands/toggle-agent-session-text';
import { registerApplyTemplateCommand } from '../../features/branch-context/commands/apply-template';
import { registerContextActionCommands } from '../../features/branch-context/commands/context-actions';
import { registerOpenConfigCommand } from '../../features/branch-context/commands/open-config';
import { registerOpenCurrentContextCommand } from '../../features/branch-context/commands/open-current-context';
import { registerOpenCurrentContextFolderCommand } from '../../features/branch-context/commands/open-current-context-folder';
import { registerSetBaseCommand } from '../../features/branch-context/commands/set-base';
import { registerShowDetailsCommand } from '../../features/branch-context/commands/show-details';
import { registerStatusCommand } from '../../features/branch-context/commands/status';
import { registerSyncCommand } from '../../features/branch-context/commands/sync';
import { registerCommitActionCommands } from '../../features/git-changes/commands/commit-actions';
import { registerGroupGitChangedFilesCommand } from '../../features/git-changes/commands/group-git-changed-files';
import { registerGroupGitCommitsCommand } from '../../features/git-changes/commands/group-git-commits';
import { registerOpenCommitDiffCommand } from '../../features/git-changes/commands/open-commit-diff';
import { registerReviewDiffCommand } from '../../features/git-changes/commands/review-diff';
import { registerToggleGitChangesModeCommand } from '../../features/git-changes/commands/toggle-git-changes-mode';
import { registerGroupContextsCommand } from '../../features/other-branches/commands/group-contexts';
import { registerMoveAgentSessionCommand } from '../../features/other-branches/commands/move-agent-session';
import { registerToggleOtherBranchesModeCommand } from '../../features/other-branches/commands/toggle-other-branches-mode';
import { registerShowLogsCommand } from './show-logs';
import { registerUpdateCliCommand } from './update-cli';
import { registerUpdateExtensionCommand } from './update-extension';

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
    registerToggleOtherBranchesModeCommand(context),
    registerMoveAgentSessionCommand(),
    registerUpdateCliCommand(),
    registerUpdateExtensionCommand(),
    registerShowLogsCommand(),
    registerShowDetailsCommand(),
    registerSyncAllAgentSessionsCommand(),
    registerSyncAgentsCommand(),
    ...registerAgentSessionActionCommands(),
    ...registerCommitActionCommands(),
    ...registerContextActionCommands(),
  );
}
