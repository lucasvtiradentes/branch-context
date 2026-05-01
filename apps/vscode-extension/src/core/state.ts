import { type AgentSession, getAgentSessions } from '@branch-context/core/services/agents';
import {
  type BranchGitSummary,
  getGitBranchSummary,
} from '@branch-context/core/services/git-summary';
import {
  type BranchContextArchivedContextSummary,
  type BranchContextContextSummary,
  type BranchContextStatus,
  getStatus,
} from '@branch-context/core/services/status';
import * as vscode from 'vscode';
import { contextKeys } from '../constants';
import { formatLogError, logger } from '../lib/logging';
import { getWorkspaceInfo } from './workspace';

export type BranchContextExtensionState = {
  workspaceRoot: string | null;
  initialized: boolean;
  status: BranchContextStatus | null;
  currentBranch: string | null;
  currentContextDir: string | null;
  currentContextFile: string | null;
  recentContexts: BranchContextContextSummary[];
  archivedContexts: BranchContextArchivedContextSummary[];
  agentSessions: AgentSession[];
  gitSummary: BranchGitSummary | null;
  templates: string[];
  configPath: string | null;
};

const changeEmitter = new vscode.EventEmitter<BranchContextExtensionState>();

let currentState = createEmptyState();

export const onDidChangeState = changeEmitter.event;

export function initializeBranchContextState(context: vscode.ExtensionContext): void {
  context.subscriptions.push(changeEmitter);
  logger.info('state initialized');
  refreshBranchContextState();
}

export function getBranchContextState(): BranchContextExtensionState {
  return currentState;
}

export function refreshBranchContextState(): BranchContextExtensionState {
  const nextState = readBranchContextState();
  currentState = nextState;
  void vscode.commands.executeCommand('setContext', contextKeys.initialized, nextState.initialized);
  changeEmitter.fire(currentState);
  logger.debug(formatStateRefresh(currentState));
  return currentState;
}

function readBranchContextState(): BranchContextExtensionState {
  const workspace = getWorkspaceInfo();
  if (!workspace.workspaceRoot) {
    return createEmptyState();
  }

  try {
    const status = getStatus(workspace.workspaceRoot);
    const agentSessions = readAgentSessions(workspace.workspaceRoot);
    const gitSummary = status.initialized
      ? getGitBranchSummary(workspace.workspaceRoot, status.baseBranch)
      : null;
    return {
      workspaceRoot: workspace.workspaceRoot,
      initialized: status.initialized,
      status,
      currentBranch: status.currentBranch,
      currentContextDir: status.currentContextDir,
      currentContextFile: workspace.currentContextFile,
      recentContexts: status.recentContexts,
      archivedContexts: status.archivedContexts,
      agentSessions,
      gitSummary,
      templates: status.templates,
      configPath: workspace.configPath,
    };
  } catch (error) {
    logger.error(
      `state read failed: workspace=${workspace.workspaceRoot} error=${formatLogError(error)}`,
    );
    return {
      ...createEmptyState(),
      workspaceRoot: workspace.workspaceRoot,
      configPath: workspace.configPath,
    };
  }
}

function createEmptyState(): BranchContextExtensionState {
  return {
    workspaceRoot: null,
    initialized: false,
    status: null,
    currentBranch: null,
    currentContextDir: null,
    currentContextFile: null,
    recentContexts: [],
    archivedContexts: [],
    agentSessions: [],
    gitSummary: null,
    templates: [],
    configPath: null,
  };
}

function readAgentSessions(workspaceRoot: string): AgentSession[] {
  const result = getAgentSessions(workspaceRoot);
  return result.ok ? result.sessions : [];
}

function formatStateRefresh(state: BranchContextExtensionState): string {
  const issueCount = state.status?.issues.length ?? 0;
  const recentCount = state.recentContexts.length;
  const archivedCount = state.archivedContexts.length;
  const commitCount = state.gitSummary?.ok ? state.gitSummary.commits.length : 0;
  const changedFileCount = state.gitSummary?.ok ? state.gitSummary.changedFiles.length : 0;
  return [
    'state refreshed:',
    `workspace=${state.workspaceRoot ?? 'none'}`,
    `initialized=${state.initialized}`,
    `branch=${state.currentBranch ?? 'none'}`,
    `contextDir=${state.currentContextDir ?? 'none'}`,
    `contextFile=${state.currentContextFile ?? 'none'}`,
    `recent=${recentCount}`,
    `archived=${archivedCount}`,
    `agents=${state.agentSessions.length}`,
    `commits=${commitCount}`,
    `changedFiles=${changedFileCount}`,
    `templates=${state.templates.length}`,
    `issues=${issueCount}`,
  ].join(' ');
}
