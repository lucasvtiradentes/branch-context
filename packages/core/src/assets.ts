export const defaultConfig = {
  default_base_branch: 'origin/main',
  sound: true,
  commit_description: false,
  template_rules: [
    { prefix: 'feature/', template: 'feature' },
    { prefix: 'fix/', template: 'fix' },
    { prefix: 'bugfix/', template: 'fix' },
    { prefix: 'chore/', template: 'chore' },
    { prefix: 'refactor/', template: 'chore' },
  ],
};

export const postCheckoutHookTemplate = `#!/bin/bash
{marker}

PREV_HEAD="$1"
NEW_HEAD="$2"
CHECKOUT_TYPE="$3"

if [ "$CHECKOUT_TYPE" == "1" ]; then
    OLD_BRANCH=$(git rev-parse --abbrev-ref @{-1} 2>/dev/null || echo "unknown")
    NEW_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    {callback} "$OLD_BRANCH" "$NEW_BRANCH" "$PREV_HEAD" "$NEW_HEAD"
fi
`;

export const postCommitHookTemplate = `#!/bin/bash
{marker}

{callback}
`;

const defaultContext = `---
branch: {{branch}}
created: {{date}}
author: {{author}}
---

<!--
  This file tracks branch context for AI coding agents (e.g. Claude Code).
  DO NOT remove this comment or the frontmatter above.

  Guidelines:
  - Description: what this branch does and WHY, not just "batch of fixes" — be specific
  - Key Paths: list paths central to the changes with a short reason why each matters
  - Notes: non-obvious findings, gotchas, or decisions worth remembering across sessions
  - References: links to issues, PRs, docs, or prior work that motivated this branch
  - Tasks: group by theme (e.g. "Fixes:", "Cleanup:"), mark [x] when done
  - Commits / Changed Files: auto-managed by git hooks, never edit manually
-->

## Description

-

## Key Paths

-

## Notes

-

## References

-

## Tasks

- [ ]

## Commits

<bctx:commits></bctx:commits>

## Changed Files

<bctx:files></bctx:files>
`;

const featureContext = `---
branch: {{branch}}
created: {{date}}
author: {{author}}
---

<!--
  This file tracks branch context for AI coding agents (e.g. Claude Code).
  DO NOT remove this comment or the frontmatter above.

  Guidelines:
  - Description: what this feature does and WHY — be specific, not "add new feature"
  - Decisions: key choices and tradeoffs — include what was ruled out and why
  - Constraints: hard requirements, limitations, or compatibility concerns
  - Key Paths: list paths central to the feature with a short reason why each matters
  - Out of Scope: explicit boundaries to avoid scope creep across sessions
  - Notes: non-obvious findings, gotchas, or decisions worth remembering across sessions
  - References: links to issues, PRs, docs, or prior work that motivated this feature
  - Tasks: group by theme when >5 items, mark [x] when done
  - Current Status: what's done, in progress, or blocked
  - Commits / Changed Files: auto-managed by git hooks, never edit manually
-->

## Description

-

## Decisions

-

## Constraints

-

## Key Paths

-

## Out of Scope

-

## Notes

-

## References

-

## Tasks

- [ ]

## Current Status

-

## Commits

<bctx:commits></bctx:commits>

## Changed Files

<bctx:files></bctx:files>
`;

const fixContext = `---
branch: {{branch}}
created: {{date}}
author: {{author}}
---

<!--
  This file tracks branch context for AI coding agents (e.g. Claude Code).
  DO NOT remove this comment or the frontmatter above.

  Guidelines:
  - Problem: what's broken, how to reproduce, and what the expected behavior is
  - Root Cause: why it happens — fill after investigation, not before
  - Fix: what was changed and why this approach over alternatives
  - Key Paths: list paths central to the fix with a short reason why each matters
  - Notes: non-obvious findings, gotchas, or decisions worth remembering across sessions
  - References: links to issues, PRs, docs, or error reports that motivated this fix
  - Tasks: group by theme when >5 items, mark [x] when done
  - Commits / Changed Files: auto-managed by git hooks, never edit manually
-->

## Problem

-

## Root Cause

-

## Fix

-

## Key Paths

-

## Notes

-

## References

-

## Tasks

- [ ]

## Commits

<bctx:commits></bctx:commits>

## Changed Files

<bctx:files></bctx:files>
`;

export const initTemplates: Record<string, Record<string, string>> = {
  _default: { 'context.md': defaultContext },
  chore: { 'context.md': defaultContext },
  feature: { 'context.md': featureContext },
  fix: { 'context.md': fixContext },
};
