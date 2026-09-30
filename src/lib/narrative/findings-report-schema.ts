import { z } from "zod";

export const TranslatedFindingSchema = z.object({
  finding_index: z.number().int().positive(),
  what_we_found: z.string().min(1),
  why_it_matters: z.string().min(1),
  what_we_will_do: z.string().min(1),
  what_we_need_from_you: z.string().min(1),
});

export const TopPrioritySchema = z.object({
  finding_index: z.number().int().positive(),
  rationale: z.string().min(1),
});

export const FindingsReportResultSchema = z.object({
  executive_summary: z.string().min(1),
  top_priorities: z.array(TopPrioritySchema).max(3),
  finding_translations: z.array(TranslatedFindingSchema),
});

export type FindingsReportResult = z.infer<typeof FindingsReportResultSchema>;

export const FINDINGS_REPORT_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    executive_summary: { type: "string" },
    top_priorities: {
      // maxItems support under strict mode is unconfirmed -- "up to 3" is
      // enforced by the prompt plus the app-side Zod .max(3) check instead
      // of relying on a JSON Schema keyword that might be silently ignored
      // or, worse, rejected by the API.
      type: "array",
      items: {
        type: "object",
        properties: {
          finding_index: { type: "integer" },
          rationale: { type: "string" },
        },
        required: ["finding_index", "rationale"],
        additionalProperties: false,
      },
    },
    finding_translations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          finding_index: { type: "integer" },
          what_we_found: { type: "string" },
          why_it_matters: { type: "string" },
          what_we_will_do: { type: "string" },
          what_we_need_from_you: { type: "string" },
        },
        required: ["finding_index", "what_we_found", "why_it_matters", "what_we_will_do", "what_we_need_from_you"],
        additionalProperties: false,
      },
    },
  },
  required: ["executive_summary", "top_priorities", "finding_translations"],
  additionalProperties: false,
};
