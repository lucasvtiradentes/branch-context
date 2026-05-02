function supportsColor() {
  if (process.env.NO_COLOR) {
    return false;
  }
  if (process.env.FORCE_COLOR) {
    return true;
  }
  return Boolean(process.stdout.isTTY);
}

function wrap(code: string, text: string) {
  if (!supportsColor()) {
    return text;
  }
  return `\u001b[${code}m${text}\u001b[0m`;
}

export function red(text: string) {
  return wrap('31', text);
}

export function green(text: string) {
  return wrap('32', text);
}

export function yellow(text: string) {
  return wrap('33', text);
}
