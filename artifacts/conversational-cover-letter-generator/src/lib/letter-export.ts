export type LetterDownloadFormat = "txt" | "docx" | "pdf";

const formatDetails: Record<LetterDownloadFormat, { extension: string; mimeType: string }> = {
  txt: { extension: "txt", mimeType: "text/plain;charset=utf-8" },
  docx: {
    extension: "docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  pdf: { extension: "pdf", mimeType: "application/pdf" },
};

function coverLetterParagraphs(letter: string) {
  return letter.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function fileStem(roleTitle: string) {
  const normalized = roleTitle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "cover-letter";
}

async function createDocxBlob(letter: string) {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const children = coverLetterParagraphs(letter).map((line) => new Paragraph({
    children: line ? [new TextRun(line)] : [],
    spacing: { after: 180 },
  }));

  const document = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,
            right: 720,
            bottom: 720,
            left: 720,
          },
        },
      },
      children,
    }],
  });

  return Packer.toBlob(document);
}

async function createPdfBlob(letter: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 64;
  const lineHeight = 19;
  const maxWidth = pageWidth - (margin * 2);
  let cursorY = margin;

  pdf.setFont("times", "normal");
  pdf.setFontSize(12);

  for (const paragraph of coverLetterParagraphs(letter)) {
    const lines = paragraph ? pdf.splitTextToSize(paragraph, maxWidth) : [""];

    for (const line of lines) {
      if (cursorY + lineHeight > pageHeight - margin) {
        pdf.addPage();
        cursorY = margin;
      }

      if (line) {
        pdf.text(line, margin, cursorY);
      }
      cursorY += lineHeight;
    }
  }

  return pdf.output("blob");
}

export async function createCoverLetterExport(letter: string, format: LetterDownloadFormat) {
  const detail = formatDetails[format];
  let blob: Blob;

  if (format === "txt") {
    blob = new Blob([letter], { type: detail.mimeType });
  } else if (format === "docx") {
    blob = await createDocxBlob(letter);
  } else {
    blob = await createPdfBlob(letter);
  }

  return { blob, extension: detail.extension };
}

export function downloadCoverLetter(letter: string, roleTitle: string, format: LetterDownloadFormat) {
  return createCoverLetterExport(letter, format).then(({ blob, extension }) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileStem(roleTitle)}.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  });
}