import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTEXT_FILE_EXTENSIONS } from '../constants';
import { getBranchMeta } from '../data/meta';

export const TAG_COMMITS = 'bctx:commits';
export const TAG_FILES = 'bctx:files';
export const TAG_PATTERN = /<(bctx:(?:commits|files))>(.*?)<\/\1>/gs;
export const SYNC_MESSAGE_TEMPLATE = 'N/A - in sync with {base_branch}';

export type TagUpdate = {
  file: string;
  tag: string;
  old_content: string;
  new_content: string;
};

export function findContextFiles(contextDir: string): string[] {
  if (!existsSync(contextDir)) {
    return [];
  }

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (CONTEXT_FILE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
        files.push(fullPath);
      }
    }
  };

  try {
    if (statSync(contextDir).isDirectory()) {
      walk(contextDir);
    }
  } catch {
    return [];
  }

  return files;
}

export function findTagsInFile(filepath: string): Array<[string, string]> {
  try {
    const content = readFileSync(filepath, 'utf8');
    return Array.from(content.matchAll(TAG_PATTERN)).flatMap((match) => {
      const tag = match[1];
      const value = match[2];
      return tag != null && value != null ? [[tag, value] as [string, string]] : [];
    });
  } catch {
    return [];
  }
}

export function updateTagContent(content: string, tag: string, newValue: string) {
  const pattern = new RegExp(`<(${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})>(.*?)</\\1>`, 'gs');
  return content.replace(pattern, `<$1>${newValue}</$1>`);
}

export function updateContextTags(
  workspace: string,
  contextDir: string,
  branchKey: string,
  baseBranch: string,
) {
  const updates: TagUpdate[] = [];
  const meta = getBranchMeta(workspace, branchKey);
  const syncMessage = SYNC_MESSAGE_TEMPLATE.replace('{base_branch}', baseBranch);
  const commitsContent = meta?.commits || syncMessage;
  const filesContent = meta?.changed_files || syncMessage;

  for (const filepath of findContextFiles(contextDir)) {
    let originalContent: string;
    try {
      originalContent = readFileSync(filepath, 'utf8');
    } catch {
      continue;
    }

    const tags = findTagsInFile(filepath);
    if (tags.length === 0) {
      continue;
    }

    let newContent = originalContent;
    const fileUpdates: TagUpdate[] = [];
    const tagContentMap = new Map([
      [TAG_COMMITS, commitsContent],
      [TAG_FILES, filesContent],
    ]);

    for (const [tag, oldValue] of tags) {
      const contentValue = tagContentMap.get(tag);
      if (contentValue == null) {
        continue;
      }

      const newValue = `\n${contentValue}\n`;
      newContent = updateTagContent(newContent, tag, newValue);
      fileUpdates.push({
        file: filepath,
        tag,
        old_content: oldValue.trim(),
        new_content: contentValue,
      });
    }

    if (newContent !== originalContent) {
      writeFileSync(filepath, newContent);
      updates.push(...fileUpdates);
    }
  }

  return updates;
}
