import { z } from "zod";
import { PROFILE_FIELDS } from "./fields";

export const FINDING_SEVERITIES = ["critical", "high", "medium", "low"] as const;

export const ExtractedFieldSchema = z.object({
  field_name: z.enum(PROFILE_FIELDS),
  value: z.string().nullable(),
  source_excerpt: z.string().nullable(),
});

export const ExtractedFindingSchema = z.object({
  control_area: z.string().min(1),
  technical_description: z.string().min(1),
  affected_scope: z.string().nullable(),
  severity: z.enum(FINDING_SEVERITIES),
  evidence_excerpt: z.string().min(1),
});

export const ExtractionResultSchema = z.object({
  profile_fields: z.array(ExtractedFieldSchema),
  findings: z.array(ExtractedFindingSchema),
});

export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;
export type ExtractedFinding = z.infer<typeof ExtractedFindingSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// JSON Schema (not Zod) for the Anthropic tool definition -- this is what
// forces the model's response into this exact shape via tool_choice.
export const EXTRACTION_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    profile_fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field_name: { type: "string", enum: PROFILE_FIELDS },
          value: { type: ["string", "null"] },
          source_excerpt: { type: ["string", "null"] },
        },
        required: ["field_name", "value", "source_excerpt"],
        additionalProperties: false,
      },
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          control_area: { type: "string" },
          technical_description: { type: "string" },
          affected_scope: { type: ["string", "null"] },
          severity: { type: "string", enum: FINDING_SEVERITIES },
          evidence_excerpt: { type: "string" },
        },
        required: ["control_area", "technical_description", "affected_scope", "severity", "evidence_excerpt"],
        additionalProperties: false,
      },
    },
  },
  required: ["profile_fields", "findings"],
  additionalProperties: false,
};
