import type * as vscode from 'vscode';
import { registerAgentSessionActionCommands } from './branch-ai-sessions/agent-session-actions';
import { registerGroupAgentSessionsCommand } from './branch-ai-sessions/group-agent-sessions';
import { registerResumeAgentSessionCommand } from './branch-ai-sessions/resume-agent-session';
import { registerSyncAgentsCommand } from './branch-ai-sessions/sync-agents';
import { registerToggleAgentSessionTextCommand } from './branch-ai-sessions/toggle-agent-session-text';
import { registerApplyTemplateCommand } from './branch-context/apply-template';
import { registerContextActionCommands } from './branch-context/context-actions';
import { registerOpenConfigCommand } from './branch-context/open-config';
import { registerOpenCurrentContextCommand } from './branch-context/open-current-context';
import { registerOpenCurrentContextFolderCommand } from './branch-context/open-current-context-folder';
import { registerSetBaseCommand } from './branch-context/set-base';
import { registerShowDetailsCommand } from './branch-context/show-details';
import { registerStatusCommand } from './branch-context/status';
import { registerSyncCommand } from './branch-context/sync';
import { registerCommitActionCommands } from './branch-git-changes/commit-actions';
import { registerGroupGitChangedFilesCommand } from './branch-git-changes/group-git-changed-files';
import { registerGroupGitCommitsCommand } from './branch-git-changes/group-git-commits';
import { registerOpenCommitDiffCommand } from './branch-git-changes/open-commit-diff';
import { registerReviewDiffCommand } from './branch-git-changes/review-diff';
import { registerToggleGitChangesModeCommand } from './branch-git-changes/toggle-git-changes-mode';
import { registerGroupContextsCommand } from './other-branches/group-contexts';
import { registerShowLogsCommand } from './show-logs';

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
    registerShowDetailsCommand(),
    registerSyncAgentsCommand(),
    ...registerAgentSessionActionCommands(),
    ...registerCommitActionCommands(),
    ...registerContextActionCommands(),
  );
}
