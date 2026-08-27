import { expect, test, type Download, type Page } from "@playwright/test";
import type { DraftRecord } from "../artifacts/conversational-cover-letter-generator/src/lib/draft-history";

const DB_NAME = "draftwell-local-history";
const DB_VERSION = 1;
const STORE_NAME = "drafts";

const existingDraft = {
  id: "browser-existing",
  version: 1 as const,
  createdAt: 100,
  updatedAt: 100,
  letter: "Keep this browser draft.",
  sections: [
    {
      name: "opening" as const,
      text: "A browser-restored opening.",
      evidence: ["Product strategy"],
      requirements: ["Clear communication"],
    },
  ],
  warnings: [],
  missingEvidence: [],
  form: {
    companyName: "Northstar Health",
    roleTitle: "Product Designer",
    recipientName: "Hiring Team",
    tone: "warm" as const,
    length: "standard" as const,
    useAiGeneratedContent: false,
  },
} satisfies DraftRecord;

async function replaceStoredDrafts(page: Page, drafts: DraftRecord[]) {
  await page.evaluate(
    async ({ dbName, dbVersion, storeName, records }) => {
      const request = indexedDB.open(dbName, dbVersion);
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        store.clear();
        records.forEach((record) => store.put(record));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION, storeName: STORE_NAME, records: drafts },
  );
}

async function readDownloadBuffer(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("The browser did not provide the exported backup.");

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readDownload(download: Download) {
  return (await readDownloadBuffer(download)).toString("utf8");
}

async function expectDraftStillPresent(page: Page) {
  await expect(page.getByTestId("text-history-count")).toHaveText("1");
  await expect(page.getByTestId("button-open-draft-browser-existing")).toHaveCount(1);
  await page.getByTestId("button-open-draft-browser-existing").click();
  await expect(page.getByTestId("textarea-generated-letter")).toHaveValue(existingDraft.letter);
  await page.getByTestId("button-open-history").click();
  await expect(page.getByTestId("list-history-drafts")).toBeVisible();
}

test("exports and restores backups without changing drafts on invalid or duplicate imports", async ({ page }) => {
  await page.goto("/");
  await replaceStoredDrafts(page, [existingDraft]);
  await page.reload();

  await expect(page.getByTestId("text-history-count")).toHaveText("1");
  await page.getByTestId("button-open-history").click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("button-export-all").click(),
  ]);
  const exportedBackup = await readDownload(download);
  const parsedBackup = JSON.parse(exportedBackup) as {
    format: string;
    version: number;
    drafts: DraftRecord[];
  };
  expect(parsedBackup.format).toBe("draftwell-history");
  expect(parsedBackup.version).toBe(1);
  expect(parsedBackup.drafts).toEqual([existingDraft]);

  await replaceStoredDrafts(page, []);
  await page.reload();
  await page.getByTestId("button-open-history").click();
  await expect(page.getByTestId("empty-history")).toBeVisible();

  const importInput = page.getByTestId("input-import-history");
  await importInput.setInputFiles({
    name: "draftwell-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportedBackup),
  });
  await expect(page.getByTestId("status-history-transfer")).toHaveText("1 draft imported.");
  await expectDraftStillPresent(page);

  await importInput.setInputFiles({
    name: "malformed-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from("{ this is not valid JSON"),
  });
  await expect(page.getByTestId("status-history-transfer")).toHaveText("This file is not valid JSON.");
  await expectDraftStillPresent(page);

  const duplicateBackup = JSON.parse(exportedBackup) as { drafts: Array<Record<string, unknown>> };
  duplicateBackup.drafts[0].letter = "This duplicate must not overwrite the stored letter.";
  await importInput.setInputFiles({
    name: "duplicate-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(duplicateBackup)),
  });
  await expect(page.getByTestId("status-history-transfer")).toHaveText(
    "Nothing new was imported. Those drafts are already in this browser.",
  );
  await expectDraftStillPresent(page);
});

test("downloads the edited cover letter as TXT, DOCX, and PDF", async ({ page }) => {
  await page.goto("/");
  await replaceStoredDrafts(page, [existingDraft]);
  await page.reload();
  await page.getByTestId("button-open-history").click();
  await page.getByTestId("button-open-draft-browser-existing").click();

  const editedLetter = "Dear hiring team,\n\nI am excited to apply.";
  await page.getByTestId("textarea-generated-letter").fill(editedLetter);

  const [txtDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("button-download-letter-txt").click(),
  ]);
  expect(txtDownload.suggestedFilename()).toBe("product-designer.txt");
  await expect(readDownload(txtDownload)).resolves.toBe(editedLetter);

  const [docxDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("button-download-letter-docx").click(),
  ]);
  expect(docxDownload.suggestedFilename()).toBe("product-designer.docx");
  await expect(readDownloadBuffer(docxDownload)).resolves.toMatchObject(Buffer.from("PK\u0003\u0004"));

  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("button-download-letter-pdf").click(),
  ]);
  expect(pdfDownload.suggestedFilename()).toBe("product-designer.pdf");
  await expect(readDownloadBuffer(pdfDownload)).resolves.toMatchObject(Buffer.from("%PDF"));
});