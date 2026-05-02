import {
  type AgentSession,
  getAgentSessions,
  getGitBranchSummary,
  getStatus,
} from '@branch-context/core';
import * as vscode from 'vscode';
import { contextKeys } from '../../constants';
import { logger } from '../../shared/logger';
import { getWorkspaceInfo } from '../workspace';
import type { BranchContextExtensionState } from './types';

class BranchContextStateStore {
  private readonly changeEmitter = new vscode.EventEmitter<BranchContextExtensionState>();

  private currentState = this.createEmptyState();

  readonly onDidChange = this.changeEmitter.event;

  initialize(context: vscode.ExtensionContext): void {
    context.subscriptions.push(this.changeEmitter);
    logger.info('state initialized');
    this.refresh();
  }

  get(): BranchContextExtensionState {
    return this.currentState;
  }

  refresh(): BranchContextExtensionState {
    const nextState = this.read();
    this.currentState = nextState;
    void vscode.commands.executeCommand(
      'setContext',
      contextKeys.initialized,
      nextState.initialized,
    );
    this.changeEmitter.fire(this.currentState);
    logger.debug(this.formatRefresh(this.currentState));
    return this.currentState;
  }

  private read(): BranchContextExtensionState {
    const workspace = getWorkspaceInfo();
    if (!workspace.workspaceRoot) {
      return this.createEmptyState();
    }

    try {
      const status = getStatus(workspace.workspaceRoot);
      const agentSessions = this.readAgentSessions(workspace.workspaceRoot);
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
        `state read failed: workspace=${workspace.workspaceRoot} error=${logger.formatError(error)}`,
      );
      return {
        ...this.createEmptyState(),
        workspaceRoot: workspace.workspaceRoot,
        configPath: workspace.configPath,
      };
    }
  }

  private createEmptyState(): BranchContextExtensionState {
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

  private readAgentSessions(workspaceRoot: string): AgentSession[] {
    const result = getAgentSessions(workspaceRoot);
    return result.ok ? result.sessions : [];
  }

  private formatRefresh(state: BranchContextExtensionState): string {
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
}

export const branchContextState = new BranchContextStateStore();
