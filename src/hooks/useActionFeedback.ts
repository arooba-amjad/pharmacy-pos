import { useCallback, useState } from 'react';
import type { ActionFeedbackAction, ActionFeedbackType } from '@/components/feedback/ActionFeedbackCard';

export type ActionFeedbackState = {
  type: ActionFeedbackType;
  title: string;
  description?: string;
  actions?: ActionFeedbackAction[];
  meta?: string;
};

export function useActionFeedback() {
  const [feedback, setFeedbackState] = useState<ActionFeedbackState | null>(null);

  const setFeedback = useCallback((next: ActionFeedbackState) => {
    setFeedbackState(next);
  }, []);

  const clearFeedback = useCallback(() => {
    setFeedbackState(null);
  }, []);

  return { feedback, setFeedback, clearFeedback };
}
