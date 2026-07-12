import { stdin as input, stdout as output } from 'node:process';
import readline from 'node:readline';
import readlinePromises from 'node:readline/promises';
import { dim, green } from './color';

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
  const rl = readlinePromises.createInterface({ input, output });
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

  if (items.length === 0 || !input.isTTY) {
    return [];
  }

  const display = labels ?? items;
  const selected = new Set<number>();
  const maxVisible = Math.max(1, Math.min(items.length, (output.rows ?? 24) - 4));
  const hint = dim('(↑↓ move, space select, a toggle all, enter confirm)');
  let cursor = 0;
  let viewportStart = 0;
  let renderedLines = 0;

  const render = () => {
    if (renderedLines > 0) {
      output.write(`\r\u001b[${renderedLines}A`);
    }

    const viewportEnd = Math.min(viewportStart + maxVisible, items.length);
    output.write(`\u001b[K${hint}\n`);
    for (let index = viewportStart; index < viewportEnd; index += 1) {
      const check = selected.has(index) ? green('✓') : ' ';
      const arrow = index === cursor ? '›' : ' ';
      const hasViewport = items.length > maxVisible;
      const scrollMarker =
        hasViewport && index === viewportStart && viewportStart > 0
          ? '↑ '
          : hasViewport && index === viewportEnd - 1 && viewportEnd < items.length
            ? '↓ '
            : hasViewport
              ? '  '
              : '';
      output.write(`\u001b[K  ${arrow} [${check}] ${scrollMarker}${display[index]}\n`);
    }
    renderedLines = viewportEnd - viewportStart + 1;
  };

  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  render();

  return await new Promise<number[]>((resolve) => {
    const finish = (result: number[]) => {
      input.off('keypress', onKeypress);
      input.setRawMode(false);
      resolve(result);
    };
    const onKeypress = (_value: string, key: readline.Key) => {
      if (key.name === 'up' && cursor > 0) {
        cursor -= 1;
      } else if (key.name === 'down' && cursor < items.length - 1) {
        cursor += 1;
      } else if (key.name === 'space') {
        selected.has(cursor) ? selected.delete(cursor) : selected.add(cursor);
      } else if (key.name === 'a') {
        selected.size === items.length
          ? selected.clear()
          : items.forEach((_, index) => {
              selected.add(index);
            });
      } else if (key.name === 'return') {
        render();
        finish(Array.from(selected).sort((a, b) => a - b));
        return;
      } else if (key.ctrl && key.name === 'c') {
        render();
        finish([]);
        return;
      } else if (key.name === 'escape') {
        render();
        finish([]);
        return;
      } else {
        return;
      }

      if (cursor < viewportStart) {
        viewportStart = cursor;
      } else if (cursor >= viewportStart + maxVisible) {
        viewportStart = cursor - maxVisible + 1;
      }
      render();
    };
    input.on('keypress', onKeypress);
  });
}
