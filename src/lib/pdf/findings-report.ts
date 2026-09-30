import { createBrandedDocument, drawHeader, drawSectionHeading } from "./branding";

interface FindingRow {
  id: string;
  control_area: string;
  severity: string;
}

interface FindingTranslation {
  finding_id: string;
  what_we_found: string;
  why_it_matters: string;
  what_we_will_do: string;
  what_we_need_from_you: string;
}

interface TopPriority {
  finding_id: string;
  rationale: string;
}

export function renderFindingsReportPdf(params: {
  firmName: string;
  executiveSummary: string;
  topPriorities: TopPriority[];
  findingTranslations: FindingTranslation[];
  findings: FindingRow[];
  watermark: boolean;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createBrandedDocument(params.watermark);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const findingsById = new Map(params.findings.map((f) => [f.id, f]));

    drawHeader(doc, "Findings Report", params.firmName);

    drawSectionHeading(doc, "Executive Summary");
    doc.fontSize(10).text(params.executiveSummary);

    drawSectionHeading(doc, "Top Priorities");
    for (const priority of params.topPriorities) {
      const finding = findingsById.get(priority.finding_id);
      doc.font("Helvetica-Bold").fontSize(10).text(finding?.control_area ?? "Finding", { continued: true });
      doc.font("Helvetica").text(` — ${priority.rationale}`);
    }

    drawSectionHeading(doc, "Findings");
    for (const translation of params.findingTranslations) {
      const finding = findingsById.get(translation.finding_id);
      doc.moveDown(0.5);
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(`${finding?.control_area ?? "Finding"}${finding ? ` (${finding.severity})` : ""}`);
      doc.font("Helvetica").fontSize(10);
      doc.text(`What we found: ${translation.what_we_found}`);
      doc.text(`Why it matters: ${translation.why_it_matters}`);
      doc.text(`What we'll do: ${translation.what_we_will_do}`);
      doc.text(`What we need from you: ${translation.what_we_need_from_you}`);
    }

    doc.end();
  });
}
