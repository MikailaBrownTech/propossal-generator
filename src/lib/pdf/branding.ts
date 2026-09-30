import PDFDocument from "pdfkit";

// ClearPath brand colors, adapted for a printed/exported document rather
// than the app's dark-mode UI (see src/app/globals.css for the app's own
// token file and its WCAG notes). A client-facing proposal or findings
// report is conventionally a white/light page, not a dark screen theme, so
// this keeps the brand's navy/electric palette but on a light background:
// navy text (#0D1525, 18.2:1 on white), the brand's electric blue for
// accents (#0066FF, 4.83:1 on white -- passes AA), and a darker muted gray
// than the app uses (the app's --muted #8895B3 only reaches 3.0:1 on white,
// well under the 4.5:1 body-text minimum -- #54607A reaches 6.3:1 instead).
const NAVY = "#0d1525";
const MUTED = "#54607a";
const ELECTRIC = "#0066ff";
const WATERMARK_RED = "#c0392b";

export function createBrandedDocument(watermark: boolean) {
  const doc = new PDFDocument({ size: "LETTER", margin: 54, bufferPages: true });

  const decoratePage = () => {
    drawFooter(doc);
    if (watermark) {
      drawDraftWatermark(doc);
    }
    // Both draws above move doc.x/doc.y as a side effect of doc.text() --
    // reset the cursor to the top of the content area so whatever content
    // triggered this page (or the caller's next doc.text() call) starts
    // fresh, instead of continuing from down near the footer.
    doc.x = doc.page.margins.left;
    doc.y = doc.page.margins.top;
  };

  // pageAdded fires for every page after the first -- the first page needs
  // its own decoration call once content starts.
  doc.on("pageAdded", decoratePage);
  decoratePage();

  return doc;
}

export function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(18).text("ClearPath IT");
  doc.fillColor(ELECTRIC).font("Helvetica").fontSize(10).text("FTC Safeguards Rule & IRS Pub 4557 Compliance");
  doc.moveDown(0.75);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(14).text(title);
  doc.fillColor(MUTED).font("Helvetica").fontSize(11).text(subtitle);
  doc.moveDown(0.5);

  const lineY = doc.y;
  doc
    .strokeColor(ELECTRIC)
    .lineWidth(1)
    .moveTo(doc.page.margins.left, lineY)
    .lineTo(doc.page.width - doc.page.margins.right, lineY)
    .stroke();

  doc.moveDown(1);
  doc.fillColor(NAVY).font("Helvetica");
}

export function drawSectionHeading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.5);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(13).text(text);
  doc.moveDown(0.25);
  doc.fillColor(NAVY).font("Helvetica").fontSize(10);
}

function drawFooter(doc: PDFKit.PDFDocument) {
  // Drawing inside the bottom margin's whitespace would put the footer's y
  // past maxY (page.height - margins.bottom), which makes pdfkit think the
  // content overflowed and add ANOTHER page -- whose footer has the same
  // problem, recursing until the call stack blows up. Zeroing the bottom
  // margin just for this call raises maxY to the full page height, so an
  // in-bounds y comfortably clears the check without triggering a new page.
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8)
    .text(
      "ClearPath IT — reports@clearpathsecure.com — Confidential, prepared for the named client only.",
      doc.page.margins.left,
      doc.page.height - 30,
      {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
        lineBreak: false,
      },
    );

  doc.page.margins.bottom = originalBottomMargin;
}

function drawDraftWatermark(doc: PDFKit.PDFDocument) {
  const centerX = doc.page.width / 2;
  const centerY = doc.page.height / 2;

  doc.save();
  doc.rotate(-45, { origin: [centerX, centerY] });
  doc
    .fillColor(WATERMARK_RED)
    .opacity(0.15)
    .font("Helvetica-Bold")
    .fontSize(96)
    .text("DRAFT", 0, centerY - 60, { width: doc.page.width, align: "center" });
  doc.opacity(1);
  doc.restore();
  doc.fillColor(NAVY).font("Helvetica").fontSize(10);
}
