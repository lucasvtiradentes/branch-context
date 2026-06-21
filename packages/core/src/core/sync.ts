import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { extname, join, relative } from 'node:path';
import {
  ARCHIVED_DIR,
  BRANCHES_DIR,
  CONFIG_DIR,
  CONTEXT_FILE_NAME,
  DEFAULT_SOUND_FILE,
  DEFAULT_SYMLINK,
  TEMPLATE_FILE_EXTENSIONS,
} from '../constants';
import { ensureBranchConfigDir } from '../data/branch-config';
import {
  Config,
  getBranchesDir,
  getDefaultTemplate,
  getTemplateDir,
  listTemplates,
} from '../data/config';
import {
  archiveBranchMeta,
  createBranchMeta,
  deleteArchivedBranchMeta,
  deleteBranchMeta,
  unarchiveBranchMeta,
} from '../data/meta';
import { copyInitTemplatesResource, getResourcesDir } from '../resources';
import { getTemplateVariables, renderTemplateContent } from '../utils/template';

enum Platform {
  Darwin = 'darwin',
  Linux = 'linux',
  Windows = 'win32',
}

const SOUND_COMMANDS = {
  [Platform.Darwin]: 'afplay',
  [Platform.Linux]: 'paplay',
  [Platform.Windows]: 'powershell',
} as const;
const soundPlayers: Partial<
  Record<NodeJS.Platform, (file: string) => { command: string; args: string[] }>
> = {
  [Platform.Darwin]: (file: string) => ({ command: SOUND_COMMANDS[Platform.Darwin], args: [file] }),
  [Platform.Linux]: (file: string) => ({ command: SOUND_COMMANDS[Platform.Linux], args: [file] }),
  [Platform.Windows]: (file: string) => ({
    command: SOUND_COMMANDS[Platform.Windows],
    args: ['-c', `(New-Object Media.SoundPlayer '${file}').Play()`],
  }),
};

export enum CreateBranchContextResult {
  Exists = 'exists',
  RepairedFromTemplate = 'repaired_from_template',
  RestoredFromArchive = 'restored_from_archive',
  CreatedFromTemplate = 'created_from_template',
  CreatedEmpty = 'created_empty',
}

export enum ResetBranchContextResult {
  Reset = 'reset',
  TemplateNotFound = 'template_not_found',
}

export enum UpdateSymlinkResult {
  Unchanged = 'unchanged',
  ErrorNotSymlink = 'error_not_symlink',
  Updated = 'updated',
}

export function getDefaultSoundFile() {
  return join(getResourcesDir(), 'assets', DEFAULT_SOUND_FILE);
}

export function playSound(soundFile?: string | null) {
  const file = soundFile ?? getDefaultSoundFile();
  if (!file || !existsSync(file)) {
    return;
  }

  const spawnSilent = (cmd: string, args: string[]) => {
    try {
      const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
      child.on('error', () => {});
      child.unref();
    } catch {}
  };

  const player = soundPlayers[process.platform];
  if (player) {
    const { command, args } = player(file);
    spawnSilent(command, args);
  }
}

export function sanitizeBranchName(branch: string) {
  return branch.replace(/[/\\:*?"<>|~^@[\]\s]/g, '-');
}

export function getBranchDir(workspace: string, branch: string) {
  return join(getBranchesDir(workspace), sanitizeBranchName(branch));
}

export function getBranchRelPath(branch: string) {
  return `${CONFIG_DIR}/${BRANCHES_DIR}/${sanitizeBranchName(branch)}`;
}

export function branchContextExists(workspace: string, branch: string) {
  return existsSync(getBranchDir(workspace, branch));
}

function resolveTemplateDir(workspace: string, branch: string, template?: string | null) {
  const explicit = template != null;
  const selectedTemplate =
    template ?? Config.load(workspace).getTemplateForBranch(branch, listTemplates(workspace));
  let templateDir = getTemplateDir(workspace, selectedTemplate);

  if (!existsSync(templateDir)) {
    if (explicit) {
      return null;
    }
    templateDir = getTemplateDir(workspace, getDefaultTemplate());
  }

  if (!existsSync(templateDir)) {
    return null;
  }

  return templateDir;
}

function shouldRenderTemplateFile(path: string) {
  return TEMPLATE_FILE_EXTENSIONS.includes(extname(path));
}

function copyTemplateToBranch(templateDir: string, branchDir: string, branch: string) {
  const variables = getTemplateVariables(branch);

  const copyWithRender = (srcDir: string, dstDir: string) => {
    mkdirSync(dstDir, { recursive: true });
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const src = join(srcDir, entry.name);
      const dst = join(dstDir, entry.name);
      if (entry.isDirectory()) {
        copyWithRender(src, dst);
      } else if (shouldRenderTemplateFile(entry.name)) {
        writeFileSync(dst, renderTemplateContent(readFileSync(src, 'utf8'), variables));
      } else {
        copyFileSync(src, dst);
      }
    }
  };

  copyWithRender(templateDir, branchDir);
}

export function createBranchContext(
  workspace: string,
  branch: string,
  template?: string | null,
): CreateBranchContextResult {
  const branchDir = getBranchDir(workspace, branch);
  const branchKey = sanitizeBranchName(branch);

  if (existsSync(branchDir)) {
    ensureBranchConfigDir(branchDir);
    createBranchMeta(workspace, branchKey, branch);
    if (!existsSync(join(branchDir, CONTEXT_FILE_NAME))) {
      const templateDir = resolveTemplateDir(workspace, branch, template);
      if (templateDir) {
        copyTemplateToBranch(templateDir, branchDir, branch);
        return CreateBranchContextResult.RepairedFromTemplate;
      }
    }
    return CreateBranchContextResult.Exists;
  }

  if (unarchiveBranch(workspace, branchKey)) {
    return CreateBranchContextResult.RestoredFromArchive;
  }

  mkdirSync(branchDir, { recursive: true });
  ensureBranchConfigDir(branchDir);
  createBranchMeta(workspace, branchKey, branch);

  const templateDir = resolveTemplateDir(workspace, branch, template);
  if (templateDir) {
    copyTemplateToBranch(templateDir, branchDir, branch);
    return CreateBranchContextResult.CreatedFromTemplate;
  }

  return CreateBranchContextResult.CreatedEmpty;
}

export function resetBranchContext(
  workspace: string,
  branch: string,
  template?: string | null,
): ResetBranchContextResult {
  const branchDir = getBranchDir(workspace, branch);
  const templateDir = resolveTemplateDir(workspace, branch, template);

  if (!templateDir) {
    return ResetBranchContextResult.TemplateNotFound;
  }

  mkdirSync(branchDir, { recursive: true });
  ensureBranchConfigDir(branchDir);
  copyTemplateToBranch(templateDir, branchDir, branch);
  return ResetBranchContextResult.Reset;
}

function isSymlink(path: string) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

export function updateSymlink(workspace: string, branch: string): UpdateSymlinkResult {
  const branchDir = getBranchDir(workspace, branch);
  const symlinkPath = join(workspace, DEFAULT_SYMLINK);

  if (!existsSync(branchDir)) {
    createBranchContext(workspace, branch);
  }

  const relPath = relative(workspace, branchDir);

  if (isSymlink(symlinkPath)) {
    try {
      if (readlinkSync(symlinkPath) === relPath) {
        return UpdateSymlinkResult.Unchanged;
      }
    } catch {}
    unlinkSync(symlinkPath);
  } else if (existsSync(symlinkPath)) {
    return UpdateSymlinkResult.ErrorNotSymlink;
  }

  symlinkSync(relPath, symlinkPath);
  return UpdateSymlinkResult.Updated;
}

export type SyncBranchOptions = {
  sound?: boolean;
};

export function syncBranch(workspace: string, branch: string, options: SyncBranchOptions = {}) {
  const config = Config.load(workspace);
  const createResult = createBranchContext(workspace, branch);
  const symlinkResult = updateSymlink(workspace, branch);

  if (options.sound ?? config.sound) {
    playSound(config.soundFile);
  }

  return {
    branch,
    branch_dir: getBranchDir(workspace, branch),
    create_result: createResult,
    symlink_result: symlinkResult,
    symlink_path: DEFAULT_SYMLINK,
  };
}

export function listBranches(workspace: string) {
  const branchesDir = getBranchesDir(workspace);
  if (!existsSync(branchesDir)) {
    return [];
  }

  return readdirSync(branchesDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== ARCHIVED_DIR,
    )
    .map((entry) => entry.name);
}

export function getArchivedDir(workspace: string) {
  return join(getBranchesDir(workspace), ARCHIVED_DIR);
}

export function listArchivedBranches(workspace: string) {
  const archivedDir = getArchivedDir(workspace);
  if (!existsSync(archivedDir)) {
    return [];
  }

  return readdirSync(archivedDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export function archiveBranch(workspace: string, branchName: string) {
  const branchesDir = getBranchesDir(workspace);
  const archivedDir = getArchivedDir(workspace);
  const src = join(branchesDir, branchName);
  const dst = join(archivedDir, branchName);

  if (!existsSync(src)) {
    return false;
  }

  mkdirSync(archivedDir, { recursive: true });
  renameSync(src, dst);
  archiveBranchMeta(workspace, branchName);
  return true;
}

export function unarchiveBranch(workspace: string, branchName: string) {
  const branchesDir = getBranchesDir(workspace);
  const archivedDir = getArchivedDir(workspace);
  const src = join(archivedDir, branchName);
  const dst = join(branchesDir, branchName);

  if (!existsSync(src)) {
    return false;
  }

  renameSync(src, dst);
  unarchiveBranchMeta(workspace, branchName);
  return true;
}

export function deleteBranchContext(workspace: string, branchName: string, archived = false) {
  const rootDir = archived ? getArchivedDir(workspace) : getBranchesDir(workspace);
  const contextDir = join(rootDir, branchName);

  if (!existsSync(contextDir)) {
    return false;
  }

  rmSync(contextDir, { recursive: true, force: true });
  if (archived) {
    deleteArchivedBranchMeta(workspace, branchName);
  } else {
    deleteBranchMeta(workspace, branchName);
  }
  return true;
}

export function copyInitTemplates(dest: string) {
  copyInitTemplatesResource(dest);
}
