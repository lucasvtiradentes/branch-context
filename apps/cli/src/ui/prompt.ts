import { stdin as input, stdout as output } from 'node:process';
import readline from 'node:readline/promises';

const YES_PROMPT_ANSWERS: readonly string[] = ['y', 'yes'];
const NO_PROMPT_ANSWERS: readonly string[] = ['n', 'no'];

let multiSelectOverride:
  | ((items: string[], labels?: string[]) => Promise<number[]> | number[])
  | null = null;

export function setMultiSelectOverride(
  override: ((items: string[], labels?: string[]) => Promise<number[]> | number[]) | null,
) {
  multiSelectOverride = override;
}

export async function promptYesNo(question: string) {
  if (!input.isTTY) {
    return false;
  }
  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      const answer = await rl.question(`${question} [y/n]: `);
      if (isYesAnswer(answer)) {
        return true;
      }
      if (isNoAnswer(answer)) {
        return false;
      }
      output.write("Please answer 'y' or 'n'.\n");
    }
  } catch {
    return false;
  } finally {
    rl.close();
  }
}

function normalizePromptAnswer(answer: string) {
  return answer.trim().toLowerCase();
}

function isYesAnswer(answer: string) {
  const normalized = normalizePromptAnswer(answer);
  return YES_PROMPT_ANSWERS.includes(normalized);
}

function isNoAnswer(answer: string) {
  const normalized = normalizePromptAnswer(answer);
  return NO_PROMPT_ANSWERS.includes(normalized);
}

export async function multiSelect(items: string[], labels?: string[]) {
  if (multiSelectOverride) {
    return await multiSelectOverride(items, labels);
  }

  if (items.length === 0) {
    return [];
  }

  const display = labels ?? items;
  output.write('\n');
  display.forEach((label, index) => {
    output.write(`  ${index + 1}. ${label}\n`);
  });
  output.write('\n');

  if (!input.isTTY) {
    return [];
  }

  const rl = readline.createInterface({ input, output });
  try {
    const raw = (
      await rl.question('Enter numbers to select (comma-separated, empty to skip): ')
    ).trim();
    if (!raw) {
      return [];
    }

    return Array.from(
      new Set(
        raw
          .split(',')
          .map((part) => part.trim())
          .filter((part) => /^\d+$/.test(part))
          .map((part) => Number.parseInt(part, 10) - 1)
          .filter((index) => index >= 0 && index < items.length),
      ),
    ).sort((a, b) => a - b);
  } catch {
    output.write('\n');
    return [];
  } finally {
    rl.close();
  }
}
