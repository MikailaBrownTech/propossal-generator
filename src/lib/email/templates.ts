function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type DocumentLabel = "Findings Report" | "Proposal";

export function buildDeliveryEmail(params: {
  contactFirstName: string | null;
  firmName: string;
  documentLabel: DocumentLabel;
}) {
  const { contactFirstName, firmName, documentLabel } = params;
  const greeting = contactFirstName ? `Hi ${contactFirstName},` : "Hello,";
  const subject = `Your ${documentLabel} from ClearPath IT`;

  const text = [
    greeting,
    "",
    `Attached is your ${documentLabel.toLowerCase()} from ClearPath IT for ${firmName}.`,
    "",
    "If you have any questions, just reply to this email.",
    "",
    "-- ClearPath IT",
    "reports@clearpathsecure.com",
  ].join("\n");

  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>Attached is your ${documentLabel.toLowerCase()} from ClearPath IT for
    <strong>${escapeHtml(firmName)}</strong>.</p>
    <p>If you have any questions, just reply to this email.</p>
    <p>&mdash; ClearPath IT<br/>reports@clearpathsecure.com</p>
  `.trim();

  return { subject, text, html };
}
