import { useCallback, useEffect, useState } from "react";
import {
  clearDrafts,
  deleteDraft,
  listDrafts,
  saveDraft,
  updateDraft,
  type DraftRecord,
  type DraftUpdate,
} from "@/lib/draft-history";

export function useDraftHistory() {
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setDrafts(await listDrafts());
      setIsAvailable(true);
      setError("");
    } catch (historyError) {
      setIsAvailable(false);
      setError(historyError instanceof Error ? historyError.message : "Local draft history is unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (draft: DraftRecord) => {
    try {
      const saved = await saveDraft(draft);
      await refresh();
      setIsAvailable(true);
      setError("");
      return saved;
    } catch (historyError) {
      setIsAvailable(false);
      setError(historyError instanceof Error ? historyError.message : "Local draft history is unavailable.");
      throw historyError;
    }
  }, [refresh]);

  const update = useCallback(async (id: string, changes: DraftUpdate) => {
    try {
      const updated = await updateDraft(id, changes);
      await refresh();
      return updated;
    } catch (historyError) {
      setIsAvailable(false);
      setError(historyError instanceof Error ? historyError.message : "Local draft history is unavailable.");
      throw historyError;
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteDraft(id);
      await refresh();
    } catch (historyError) {
      setIsAvailable(false);
      setError(historyError instanceof Error ? historyError.message : "Local draft history is unavailable.");
      throw historyError;
    }
  }, [refresh]);

  const clear = useCallback(async () => {
    try {
      await clearDrafts();
      await refresh();
    } catch (historyError) {
      setIsAvailable(false);
      setError(historyError instanceof Error ? historyError.message : "Local draft history is unavailable.");
      throw historyError;
    }
  }, [refresh]);

  return { drafts, isLoading, isAvailable, error, refresh, save, update, remove, clear };
}