import { useToastStore } from '@/store/useToastStore';

export function apiErrMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

export function toastMutationError(context: string, err?: unknown) {
  const suffix = err != null ? `: ${apiErrMessage(err)}` : '';
  useToastStore.getState().show(`${context}${suffix}`, 'error');
}

export function toastMutationSuccess(message: string) {
  useToastStore.getState().show(message, 'success');
}

export function toastMutationInfo(message: string) {
  useToastStore.getState().show(message, 'info');
}
