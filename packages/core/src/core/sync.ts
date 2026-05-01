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
import { dirname, extname, join, relative } from 'node:path';
import { initTemplates } from '../assets';
import {
  ARCHIVED_DIR,
  BRANCHES_DIR,
  CONFIG_DIR,
  DEFAULT_SOUND_FILE,
  DEFAULT_SYMLINK,
  TEMPLATE_FILE_EXTENSIONS,
} from '../constants';
import { Config, getBranchesDir, getDefaultTemplate, getTemplateDir } from '../data/config';
import {
  archiveBranchMeta,
  createBranchMeta,
  deleteArchivedBranchMeta,
  deleteBranchMeta,
  unarchiveBranchMeta,
} from '../data/meta';
import { getTemplateVariables, renderTemplateContent } from '../utils/template';

export type CreateBranchContextResult =
  | 'exists'
  | 'restored_from_archive'
  | 'created_from_template'
  | 'created_empty';

export type ResetBranchContextResult = 'reset' | 'template_not_found';
export type UpdateSymlinkResult = 'unchanged' | 'error_not_symlink' | 'updated';

export function getDefaultSoundFile() {
  return join(dirname(new URL(import.meta.url).pathname), '..', 'assets', DEFAULT_SOUND_FILE);
}

export function playSound(soundFile?: string | null) {
  const file = soundFile ?? getDefaultSoundFile();
  if (!file || !existsSync(file)) {
    return;
  }

  try {
    if (process.platform === 'darwin') {
      spawn('afplay', [file], { stdio: 'ignore', detached: true }).unref();
    } else if (process.platform === 'linux') {
      spawn('paplay', [file], { stdio: 'ignore', detached: true }).unref();
    } else if (process.platform === 'win32') {
      spawn('powershell', ['-c', `(New-Object Media.SoundPlayer '${file}').Play()`], {
        stdio: 'ignore',
        detached: true,
      }).unref();
    }
  } catch {}
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
  const selectedTemplate = template ?? Config.load(workspace).getTemplateForBranch(branch);
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
    return 'exists';
  }

  if (unarchiveBranch(workspace, branchKey)) {
    return 'restored_from_archive';
  }

  mkdirSync(branchDir, { recursive: true });
  createBranchMeta(workspace, branchKey, branch);

  const templateDir = resolveTemplateDir(workspace, branch, template);
  if (templateDir) {
    copyTemplateToBranch(templateDir, branchDir, branch);
    return 'created_from_template';
  }

  return 'created_empty';
}

export function resetBranchContext(
  workspace: string,
  branch: string,
  template?: string | null,
): ResetBranchContextResult {
  const branchDir = getBranchDir(workspace, branch);
  const templateDir = resolveTemplateDir(workspace, branch, template);

  if (!templateDir) {
    return 'template_not_found';
  }

  mkdirSync(branchDir, { recursive: true });
  copyTemplateToBranch(templateDir, branchDir, branch);
  return 'reset';
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
        return 'unchanged';
      }
    } catch {}
    unlinkSync(symlinkPath);
  } else if (existsSync(symlinkPath)) {
    return 'error_not_symlink';
  }

  symlinkSync(relPath, symlinkPath);
  return 'updated';
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
  mkdirSync(dest, { recursive: true });
  for (const [templateName, files] of Object.entries(initTemplates)) {
    const templateDir = join(dest, templateName);
    mkdirSync(templateDir, { recursive: true });
    for (const [filename, content] of Object.entries(files)) {
      writeFileSync(join(templateDir, filename), content);
    }
  }
}
