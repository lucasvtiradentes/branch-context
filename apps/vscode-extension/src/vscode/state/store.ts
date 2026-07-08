import {
  type AgentSession,
  getCachedAgentSessions,
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

  setAgentSessions(agentSessions: AgentSession[], source: string): void {
    if (agentSessionsEqual(this.currentState.agentSessions, agentSessions)) {
      return;
    }

    const previousCount = this.currentState.agentSessions.length;
    this.currentState = {
      ...this.currentState,
      agentSessions,
    };
    this.changeEmitter.fire(this.currentState);
    if (previousCount !== agentSessions.length) {
      logger.info(
        `[agent-sessions:state] set sessions source=${source} count=${agentSessions.length} previous=${previousCount}`,
      );
    }
  }

  refresh(): BranchContextExtensionState {
    const nextState = this.read();
    this.currentState = nextState;
    void vscode.commands.executeCommand(
      'setContext',
      contextKeys.initialized,
      nextState.initialized,
    );
    void vscode.commands.executeCommand('setContext', contextKeys.mode, nextState.status?.mode);
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
      const agentSessions = status.initialized
        ? this.readAgentSessions(workspace.workspaceRoot, status.currentBranch)
        : this.readUninitializedAgentSessions(workspace.workspaceRoot, status.currentBranch);
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

  private readAgentSessions(workspaceRoot: string, branch: string | null): AgentSession[] {
    const startedAt = Date.now();
    const result = getCachedAgentSessions(workspaceRoot, { branch });
    const durationMs = Date.now() - startedAt;
    if (!result.ok) {
      logger.warning(
        `[agent-sessions:state] read mode=cache workspace=${workspaceRoot} branch=${branch ?? 'none'} ok=false reason=${result.reason} ms=${durationMs}`,
      );
      return [];
    }

    logger.debug(
      `[agent-sessions:state] read mode=cache workspace=${workspaceRoot} branch=${branch ?? 'none'} agentsFile=${result.agentsFilePath ?? 'none'} count=${result.sessions.length} ms=${durationMs}`,
    );
    return result.sessions;
  }

  private readUninitializedAgentSessions(
    workspaceRoot: string,
    branch: string | null,
  ): AgentSession[] {
    const preserve =
      this.currentState.workspaceRoot === workspaceRoot &&
      this.currentState.currentBranch === branch;
    const sessions = preserve ? this.currentState.agentSessions : [];
    logger.debug(
      `[agent-sessions:state] read mode=preserve-no-bctx workspace=${workspaceRoot} branch=${branch ?? 'none'} preserve=${preserve} count=${sessions.length}`,
    );
    return sessions;
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
      `mode=${state.status?.mode ?? 'none'}`,
      `globalPath=${state.status?.globalPath ?? 'none'}`,
      `repoStorage=${state.status?.repoStorageDir ?? 'none'}`,
      `templatesDir=${state.status?.templatesDir ?? 'none'}`,
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

function agentSessionsEqual(left: AgentSession[], right: AgentSession[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((session, index) => {
    const other = right[index];
    if (!other) {
      return false;
    }

    return (
      session.provider === other.provider &&
      session.sessionId === other.sessionId &&
      session.branch === other.branch &&
      session.scope === other.scope &&
      session.path === other.path &&
      session.model === other.model &&
      session.title === other.title &&
      session.startedAt === other.startedAt &&
      session.updatedAt === other.updatedAt &&
      session.description === other.description &&
      session.pinnedAt === other.pinnedAt
    );
  });
}
