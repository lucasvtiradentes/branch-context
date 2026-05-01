import { APP_NAME } from '../constants';

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return `${APP_NAME}: unexpected error`;
}
