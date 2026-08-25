import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { extractTextFromPdfDocument } from "./pdf-text-utils";

GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const document = await getDocument({ data: new Uint8Array(buffer) }).promise;

  try {
    return await extractTextFromPdfDocument(document);
  } finally {
    document.cleanup();
  }
}

export { extractTextFromPdfDocument } from "./pdf-text-utils";
export { normalizePdfText } from "./pdf-text-utils";