import { gitUserName } from '../git';

const VAR_PATTERN = /\{\{(\w+)\}\}/g;

export function getTemplateVariables(branch: string) {
  return {
    branch,
    date: new Date().toISOString().slice(0, 10),
    author: gitUserName() ?? '',
  };
}

export function renderTemplateContent(content: string, variables: Record<string, string>) {
  return content.replace(VAR_PATTERN, (match, varName: string) => variables[varName] ?? match);
}
