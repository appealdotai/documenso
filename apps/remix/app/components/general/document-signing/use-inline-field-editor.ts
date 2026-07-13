import { useCallback, useState } from 'react';

type UseInlineFieldEditorOptions = {
  initialValue?: string;
  validate: (value: string) => string[];
};

/**
 * Shared draft / validation state for inline text and number signing fields.
 *
 * Commit and cancel side-effects (API calls, closing the editor) stay in the
 * caller — this hook only manages draft value and validation errors.
 */
export const useInlineFieldEditor = ({ initialValue = '', validate }: UseInlineFieldEditorOptions) => {
  const [draftValue, setDraftValue] = useState(initialValue);
  const [errors, setErrors] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const hasErrors = errors.length > 0;

  const resetDraft = useCallback(
    (value = initialValue) => {
      setDraftValue(value);
      setErrors([]);
    },
    [initialValue],
  );

  const startEditing = useCallback(
    (value?: string) => {
      setDraftValue(value ?? initialValue);
      setErrors([]);
      setIsEditing(true);
    },
    [initialValue],
  );

  const stopEditing = useCallback(() => {
    setIsEditing(false);
    setErrors([]);
  }, []);

  const updateDraft = useCallback(
    (value: string) => {
      setDraftValue(value);
      setErrors(validate(value));
    },
    [validate],
  );

  /**
   * Returns true when the draft passes validation and can be committed.
   * Leaves errors populated when validation fails.
   */
  const tryValidateForCommit = useCallback(() => {
    const nextErrors = validate(draftValue);
    setErrors(nextErrors);

    return nextErrors.length === 0;
  }, [draftValue, validate]);

  return {
    draftValue,
    errors,
    hasErrors,
    isEditing,
    setDraftValue,
    setErrors,
    setIsEditing,
    resetDraft,
    startEditing,
    stopEditing,
    updateDraft,
    tryValidateForCommit,
  };
};
