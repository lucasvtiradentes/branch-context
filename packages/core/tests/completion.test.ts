import { describe, expect, it } from 'vitest';
import { getBashCompletion, getFishCompletion, getZshCompletion, safeFuncName } from '../src/index';

describe('completion', () => {
  it('keeps simple function names', () => {
    expect(safeFuncName('bctx')).toBe('bctx');
  });

  it('converts hyphenated function names', () => {
    expect(safeFuncName('branch-ctx')).toBe('branch_ctx');
  });

  it('converts dotted function names', () => {
    expect(safeFuncName('my.tool')).toBe('my_tool');
  });

  it('generates zsh completion for bctx', () => {
    const output = getZshCompletion('bctx');
    expect(output).toContain('#compdef bctx');
    expect(output).toContain('_bctx()');
    expect(output).toContain('compdef _bctx bctx');
  });

  it('generates zsh completion for different program', () => {
    const output = getZshCompletion('bctxd');
    expect(output).toContain('#compdef bctxd');
    expect(output).toContain('_bctxd()');
    expect(output).toContain('compdef _bctxd bctxd');
  });

  it('generates zsh completion for hyphenated program', () => {
    const output = getZshCompletion('branch-ctx');
    expect(output).toContain('#compdef branch-ctx');
    expect(output).toContain('_branch_ctx()');
    expect(output).toContain('compdef _branch_ctx branch-ctx');
  });

  it('generates bash completion for bctx', () => {
    const output = getBashCompletion('bctx');
    expect(output).toContain('_bctx()');
    expect(output).toContain('complete -F _bctx bctx');
  });

  it('generates bash completion for different program', () => {
    const output = getBashCompletion('bctxd');
    expect(output).toContain('_bctxd()');
    expect(output).toContain('complete -F _bctxd bctxd');
  });

  it('generates fish completion for bctx', () => {
    expect(getFishCompletion('bctx')).toContain('complete -c bctx');
  });

  it('generates fish completion for different program', () => {
    const output = getFishCompletion('bctxd');
    expect(output).toContain('complete -c bctxd');
    expect(output).not.toContain('complete -c bctx ');
  });

  it('includes all commands in zsh completion', () => {
    const output = getZshCompletion('bctx');
    for (const cmd of [
      'init',
      'sync',
      'status',
      'agents',
      'prune',
      'base',
      'template',
      'completion',
      'uninstall',
    ]) {
      expect(output).toContain(cmd);
    }
  });

  it('includes all commands in bash completion', () => {
    const output = getBashCompletion('bctx');
    for (const cmd of [
      'init',
      'sync',
      'status',
      'agents',
      'prune',
      'base',
      'template',
      'completion',
      'uninstall',
    ]) {
      expect(output).toContain(cmd);
    }
  });
});
