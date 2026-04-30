import {
  type BranchContextArchivedContextSummary,
  type BranchContextContextSummary,
  type BranchContextStatus,
  getStatus,
} from '@branch-context/core/services/status';
import * as vscode from 'vscode';
import { getWorkspaceInfo } from './workspace';

export type BranchContextSummary = BranchContextContextSummary;
export type ArchivedBranchContextSummary = BranchContextArchivedContextSummary;

export type BranchContextExtensionState = {
  workspaceRoot: string | null;
  initialized: boolean;
  status: BranchContextStatus | null;
  currentBranch: string | null;
  currentContextDir: string | null;
  currentContextFile: string | null;
  recentContexts: BranchContextSummary[];
  archivedContexts: ArchivedBranchContextSummary[];
  templates: string[];
  configPath: string | null;
};

const changeEmitter = new vscode.EventEmitter<BranchContextExtensionState>();

let currentState = createEmptyState();

export const onDidChangeState = changeEmitter.event;

export function initializeBranchContextState(context: vscode.ExtensionContext): void {
  context.subscriptions.push(changeEmitter);
  refreshBranchContextState();
}

export function getBranchContextState(): BranchContextExtensionState {
  return currentState;
}

export function refreshBranchContextState(): BranchContextExtensionState {
  const nextState = readBranchContextState();
  currentState = nextState;
  changeEmitter.fire(currentState);
  return currentState;
}

function readBranchContextState(): BranchContextExtensionState {
  const workspace = getWorkspaceInfo();
  if (!workspace.workspaceRoot) {
    return createEmptyState();
  }

  try {
    const status = getStatus(workspace.workspaceRoot);
    return {
      workspaceRoot: workspace.workspaceRoot,
      initialized: status.initialized,
      status,
      currentBranch: status.currentBranch,
      currentContextDir: status.currentContextDir,
      currentContextFile: workspace.currentContextFile,
      recentContexts: status.recentContexts,
      archivedContexts: status.archivedContexts,
      templates: status.templates,
      configPath: workspace.configPath,
    };
  } catch {
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
    templates: [],
    configPath: null,
  };
}
