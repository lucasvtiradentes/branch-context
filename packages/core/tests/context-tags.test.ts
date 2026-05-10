import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTEXT_FILE_NAME,
  findContextFiles,
  findTagsInFile,
  SYNC_MESSAGE_TEMPLATE,
  TAG_COMMITS,
  TAG_FILES,
  updateTagContent,
} from '../src/index';
import { createTempDir } from './helpers';

describe('context tags', () => {
  it('finds no context files in empty dir', () => {
    expect(findContextFiles(createTempDir())).toEqual([]);
  });

  it('finds markdown context files', () => {
    const dir = createTempDir();
    const file = join(dir, CONTEXT_FILE_NAME);
    writeFileSync(file, '# Test');
    expect(findContextFiles(dir)).toEqual([file]);
  });

  it('finds text context files', () => {
    const dir = createTempDir();
    const file = join(dir, 'notes.txt');
    writeFileSync(file, 'notes');
    expect(findContextFiles(dir)).toEqual([file]);
  });

  it('ignores non-context extensions', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'script.py'), "print('hello')");
    expect(findContextFiles(dir)).toEqual([]);
  });

  it('finds nested context files', () => {
    const dir = createTempDir();
    mkdirSync(join(dir, 'subdir'));
    const file = join(dir, 'subdir', 'nested.md');
    writeFileSync(file, '# Nested');
    expect(findContextFiles(dir)).toEqual([file]);
  });

  it('returns empty for nonexistent context dir', () => {
    expect(findContextFiles('/nonexistent/path')).toEqual([]);
  });

  it('finds no tags in plain file', () => {
    const dir = createTempDir();
    const file = join(dir, 'test.md');
    writeFileSync(file, '# No tags here');
    expect(findTagsInFile(file)).toEqual([]);
  });

  it('finds commits tag', () => {
    const dir = createTempDir();
    const file = join(dir, 'test.md');
    writeFileSync(file, '<bctx:commits>old content</bctx:commits>');
    expect(findTagsInFile(file)).toEqual([[TAG_COMMITS, 'old content']]);
  });

  it('finds files tag', () => {
    const dir = createTempDir();
    const file = join(dir, 'test.md');
    writeFileSync(file, '<bctx:files>file list</bctx:files>');
    expect(findTagsInFile(file)).toEqual([[TAG_FILES, 'file list']]);
  });

  it('finds both tags', () => {
    const dir = createTempDir();
    const file = join(dir, 'test.md');
    writeFileSync(file, '<bctx:commits>commits</bctx:commits>\n<bctx:files>files</bctx:files>');
    const result = findTagsInFile(file);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual([TAG_COMMITS, 'commits']);
    expect(result).toContainEqual([TAG_FILES, 'files']);
  });

  it('finds multiline tag content', () => {
    const dir = createTempDir();
    const file = join(dir, 'test.md');
    writeFileSync(file, '<bctx:commits>\nabc123 first\ndef456 second\n</bctx:commits>');
    const result = findTagsInFile(file);
    expect(result).toHaveLength(1);
    expect(result[0]?.[0]).toBe(TAG_COMMITS);
    expect(result[0]?.[1]).toContain('abc123 first');
  });

  it('returns empty for nonexistent tag file', () => {
    expect(findTagsInFile('/nonexistent/file.md')).toEqual([]);
  });

  it('updates tag content', () => {
    expect(updateTagContent('<bctx:commits>old</bctx:commits>', TAG_COMMITS, 'new')).toBe(
      '<bctx:commits>new</bctx:commits>',
    );
  });

  it('updates tag content and preserves surrounding content', () => {
    const result = updateTagContent(
      '# Header\n<bctx:commits>old</bctx:commits>\n## Footer',
      TAG_COMMITS,
      'new',
    );
    expect(result).toContain('# Header');
    expect(result).toContain('## Footer');
    expect(result).toContain('<bctx:commits>new</bctx:commits>');
  });

  it('updates only specified tag', () => {
    const result = updateTagContent(
      '<bctx:commits>commits</bctx:commits><bctx:files>files</bctx:files>',
      TAG_COMMITS,
      'updated',
    );
    expect(result).toContain('<bctx:commits>updated</bctx:commits>');
    expect(result).toContain('<bctx:files>files</bctx:files>');
  });

  it('formats sync message template', () => {
    const message = SYNC_MESSAGE_TEMPLATE.replace('{base_branch}', 'origin/main');
    expect(message).toContain('origin/main');
    expect(message).toContain('N/A');
  });
});
