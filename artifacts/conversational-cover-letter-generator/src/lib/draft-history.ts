import type {
  CoverLetterInput,
  CoverLetterResult,
} from "@workspace/api-client-react";

export const DRAFT_HISTORY_DB_NAME = "draftwell-local-history";
export const DRAFT_HISTORY_DB_VERSION = 1;
export const DRAFT_HISTORY_STORE_NAME = "drafts";
export const DRAFT_HISTORY_EXPORT_FORMAT = "draftwell-history";
export const DRAFT_HISTORY_EXPORT_VERSION = 1;

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

export type DraftHistoryImportResult = {
  imported: DraftRecord[];
  skipped: DraftRecord[];
};

export class DraftHistoryImportError extends Error {
  constructor(message = "This file is not a valid Draftwell history backup.") {
    super(message);
    this.name = "DraftHistoryImportError";
  }
}

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

type DraftHistoryExport = {
  format: typeof DRAFT_HISTORY_EXPORT_FORMAT;
  version: typeof DRAFT_HISTORY_EXPORT_VERSION;
  exportedAt: number;
  drafts: DraftRecord[];
};

const DRAFT_RECORD_KEYS = ["id", "version", "createdAt", "updatedAt", "letter", "sections", "warnings", "missingEvidence", "form"];
const SECTION_KEYS = ["name", "text", "evidence", "requirements"];
const FORM_KEYS = ["companyName", "roleTitle", "recipientName", "tone", "length", "useAiGeneratedContent"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actualKeys = Object.keys(value).sort();
  return actualKeys.length === keys.length && actualKeys.every((key, index) => key === [...keys].sort()[index]);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isValidDraftRecord(value: unknown): value is DraftRecord {
  if (!isPlainObject(value) || !hasExactKeys(value, DRAFT_RECORD_KEYS)) return false;
  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    value.id.length > 200 ||
    value.version !== 1 ||
    typeof value.createdAt !== "number" ||
    !Number.isFinite(value.createdAt) ||
    typeof value.updatedAt !== "number" ||
    !Number.isFinite(value.updatedAt) ||
    typeof value.letter !== "string" ||
    !Array.isArray(value.sections) ||
    !isStringArray(value.warnings) ||
    !isStringArray(value.missingEvidence) ||
    !isPlainObject(value.form) ||
    !hasExactKeys(value.form, FORM_KEYS)
  ) {
    return false;
  }

  if (
    typeof value.form.companyName !== "string" ||
    typeof value.form.roleTitle !== "string" ||
    typeof value.form.recipientName !== "string" ||
    !["professional", "warm", "confident", "direct"].includes(value.form.tone as string) ||
    !["concise", "standard", "detailed"].includes(value.form.length as string) ||
    typeof value.form.useAiGeneratedContent !== "boolean"
  ) {
    return false;
  }

  return value.sections.every((section) => (
    isPlainObject(section) &&
    hasExactKeys(section, SECTION_KEYS) &&
    ["opening", "evidence", "closing"].includes(section.name as string) &&
    typeof section.text === "string" &&
    isStringArray(section.evidence) &&
    isStringArray(section.requirements)
  ));
}

/**
 * Creates a human-readable backup containing only the safe, versioned history
 * record shape. Explicitly rebuilding each object prevents extra IndexedDB
 * properties from leaking into a backup.
 */
export function serializeDraftHistory(drafts: DraftRecord[], exportedAt = Date.now()): string {
  const safeDrafts = drafts.map((draft) => {
    if (!isValidDraftRecord(draft)) {
      throw new DraftHistoryImportError("A saved draft could not be safely exported.");
    }

    return {
      id: draft.id,
      version: 1 as const,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      letter: draft.letter,
      sections: draft.sections.map((section) => ({
        name: section.name,
        text: section.text,
        evidence: [...section.evidence],
        requirements: [...section.requirements],
      })),
      warnings: [...draft.warnings],
      missingEvidence: [...draft.missingEvidence],
      form: {
        companyName: draft.form.companyName,
        roleTitle: draft.form.roleTitle,
        recipientName: draft.form.recipientName,
        tone: draft.form.tone,
        length: draft.form.length,
        useAiGeneratedContent: draft.form.useAiGeneratedContent,
      },
    };
  });

  const backup: DraftHistoryExport = {
    format: DRAFT_HISTORY_EXPORT_FORMAT,
    version: DRAFT_HISTORY_EXPORT_VERSION,
    exportedAt,
    drafts: safeDrafts,
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * Parses and strictly validates a history backup before it can reach storage.
 * Unknown keys are rejected so source materials and credentials cannot be
 * smuggled into imported records.
 */
export function parseDraftHistory(value: string): DraftRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new DraftHistoryImportError("This file is not valid JSON.");
  }

  if (
    !isPlainObject(parsed) ||
    !hasExactKeys(parsed, ["format", "version", "exportedAt", "drafts"]) ||
    parsed.format !== DRAFT_HISTORY_EXPORT_FORMAT ||
    parsed.version !== DRAFT_HISTORY_EXPORT_VERSION ||
    typeof parsed.exportedAt !== "number" ||
    !Number.isFinite(parsed.exportedAt) ||
    !Array.isArray(parsed.drafts) ||
    !parsed.drafts.every(isValidDraftRecord)
  ) {
    throw new DraftHistoryImportError("This file is not a valid Draftwell history backup.");
  }

  return parsed.drafts;
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

async function saveDrafts(drafts: DraftRecord[]): Promise<void> {
  if (drafts.length === 0) return;
  await runTransaction("readwrite", (store) => {
    let lastRequest: IDBRequest<unknown> | undefined;
    drafts.forEach((draft) => {
      lastRequest = store.put(draft);
    });
    return lastRequest as IDBRequest<unknown>;
  });
}

export async function importDraftHistory(value: string): Promise<DraftHistoryImportResult> {
  const importedRecords = parseDraftHistory(value);
  const seenIds = new Set((await listDrafts()).map((draft) => draft.id));
  const newRecords: DraftRecord[] = [];
  const skipped: DraftRecord[] = [];
  importedRecords.forEach((draft) => {
    if (seenIds.has(draft.id)) {
      skipped.push(draft);
      return;
    }
    seenIds.add(draft.id);
    newRecords.push(draft);
  });
  await saveDrafts(newRecords);
  return { imported: newRecords, skipped };
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