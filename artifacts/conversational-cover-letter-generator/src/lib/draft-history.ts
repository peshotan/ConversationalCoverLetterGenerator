import type {
  CoverLetterInput,
  CoverLetterResult,
} from "@workspace/api-client-react";

export const DRAFT_HISTORY_DB_NAME = "draftwell-local-history";
export const DRAFT_HISTORY_DB_VERSION = 1;
export const DRAFT_HISTORY_STORE_NAME = "drafts";

export type DraftFormMetadata = {
  companyName: string;
  roleTitle: string;
  recipientName: string;
  tone: NonNullable<CoverLetterInput["tone"]>;
  length: NonNullable<CoverLetterInput["length"]>;
  useAiGeneratedContent: boolean;
};

export type DraftRecord = {
  id: string;
  version: 1;
  createdAt: number;
  updatedAt: number;
  letter: string;
  sections: CoverLetterResult["sections"];
  warnings: string[];
  missingEvidence: string[];
  form: DraftFormMetadata;
};

export type DraftUpdate = {
  letter: string;
};

export type DraftSerializationInput = {
  result: CoverLetterResult;
  letter: string;
  form: DraftFormMetadata;
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export class DraftHistoryUnavailableError extends Error {
  constructor(message = "Local draft history is unavailable in this browser.") {
    super(message);
    this.name = "DraftHistoryUnavailableError";
  }
}

function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Serializes only the generated result and non-sensitive display metadata.
 * Resume text, job descriptions, uploaded files, and request credentials are
 * deliberately not accepted by this shape.
 */
export function serializeDraft({
  result,
  letter,
  form,
  id = createDraftId(),
  createdAt = Date.now(),
  updatedAt = createdAt,
}: DraftSerializationInput): DraftRecord {
  return {
    id,
    version: 1,
    createdAt,
    updatedAt,
    letter,
    sections: result.sections,
    warnings: [...result.warnings],
    missingEvidence: [...result.missingEvidence],
    form: { ...form },
  };
}

export function draftToResult(draft: DraftRecord): CoverLetterResult {
  return {
    letter: draft.letter,
    sections: draft.sections,
    warnings: draft.warnings,
    missingEvidence: draft.missingEvidence,
  };
}

function openDatabase() {
  if (typeof indexedDB === "undefined") {
    throw new DraftHistoryUnavailableError();
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DRAFT_HISTORY_DB_NAME, DRAFT_HISTORY_DB_VERSION);
    } catch {
      reject(new DraftHistoryUnavailableError());
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DRAFT_HISTORY_STORE_NAME)) {
        database.createObjectStore(DRAFT_HISTORY_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new DraftHistoryUnavailableError());
    request.onblocked = () => reject(new DraftHistoryUnavailableError("Local draft history is blocked by another browser tab."));
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    let result: T;
    let settled = false;
    const finishWithError = (error: unknown) => {
      if (!settled) {
        settled = true;
        database.close();
        reject(error instanceof DraftHistoryUnavailableError ? error : new DraftHistoryUnavailableError());
      }
    };

    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(DRAFT_HISTORY_STORE_NAME, mode);
      const request = operation(transaction.objectStore(DRAFT_HISTORY_STORE_NAME));
      request.onsuccess = () => {
        result = request.result as T;
      };
      request.onerror = () => finishWithError(request.error);
      transaction.oncomplete = () => {
        if (!settled) {
          settled = true;
          database.close();
          resolve(result);
        }
      };
      transaction.onerror = () => finishWithError(transaction.error);
      transaction.onabort = () => finishWithError(transaction.error);
    } catch (error) {
      finishWithError(error);
    }
  });
}

export async function listDrafts(): Promise<DraftRecord[]> {
  const records = await runTransaction<unknown[]>("readonly", (store) => store.getAll());
  return (records as DraftRecord[]).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveDraft(draft: DraftRecord): Promise<DraftRecord> {
  await runTransaction("readwrite", (store) => store.put(draft));
  return draft;
}

async function getDraft(id: string): Promise<DraftRecord | undefined> {
  return runTransaction<DraftRecord | undefined>("readonly", (store) => store.get(id));
}

export async function updateDraft(id: string, changes: DraftUpdate): Promise<DraftRecord> {
  const existing = await getDraft(id);
  if (!existing) {
    throw new Error("Draft not found.");
  }

  const updated: DraftRecord = {
    ...existing,
    letter: changes.letter,
    updatedAt: Date.now(),
  };
  await saveDraft(updated);
  return updated;
}

export async function deleteDraft(id: string): Promise<void> {
  await runTransaction("readwrite", (store) => store.delete(id));
}

export async function clearDrafts(): Promise<void> {
  await runTransaction("readwrite", (store) => store.clear());
}