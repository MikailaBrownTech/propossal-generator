import { createBrandedDocument, drawHeader, drawSectionHeading } from "./branding";

interface PlanForPdf {
  name: string;
  price_display: string;
  fit_description: string | null;
  inclusions: string[];
}

interface NarrativeForPdf {
  what_we_heard: string;
  why_this_plan_fits: string;
  ninety_day_plan: string;
  open_questions: string[];
}

export function renderProposalPdf(params: {
  firmName: string;
  plan: PlanForPdf;
  narrative: NarrativeForPdf;
  watermark: boolean;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createBrandedDocument(params.watermark);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, "Proposal", params.firmName);

    // Plan card -- rendered directly from the plans table data passed in,
    // never touched by the model.
    doc.font("Helvetica-Bold").fontSize(13).text(params.plan.name, { continued: true });
    doc.font("Helvetica-Bold").fontSize(13).text(`  ${params.plan.price_display}`, { align: "right" });
    if (params.plan.fit_description) {
      doc.font("Helvetica").fontSize(10).text(params.plan.fit_description);
    }
    doc.moveDown(0.25);
    for (const item of params.plan.inclusions) {
      doc.font("Helvetica").fontSize(10).text(`• ${item}`);
    }

    drawSectionHeading(doc, "What we heard");
    doc.fontSize(10).text(params.narrative.what_we_heard);

    drawSectionHeading(doc, "Why this plan fits");
    doc.fontSize(10).text(params.narrative.why_this_plan_fits);

    drawSectionHeading(doc, "First 90 days");
    doc.fontSize(10).text(params.narrative.ninety_day_plan);

    if (params.narrative.open_questions?.length > 0) {
      drawSectionHeading(doc, "Open questions");
      for (const question of params.narrative.open_questions) {
        doc.fontSize(10).text(`• ${question}`);
      }
    }

    doc.end();
  });
}
