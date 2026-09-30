import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic/client";
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserMessage } from "./prompt";
import { EXTRACTION_TOOL_INPUT_SCHEMA, ExtractionResultSchema, type ExtractionResult } from "./schema";

const TOOL_NAME = "record_extraction";

export class ExtractionError extends Error {}

export interface ExtractionOutcome extends ExtractionResult {
  /** Non-null excerpts the model returned that aren't a verbatim substring
   * of the source text -- surfaced on the review screen as "double check
   * this," not treated as a hard failure (minor whitespace/punctuation
   * drift is common and still worth a human's eyes, not a full reject). */
  unverifiedExcerpts: string[];
}

export async function extractFromSourceDocument(params: {
  sourceType: string;
  redactedText: string;
}): Promise<ExtractionOutcome> {
  const model = process.env.ANTHROPIC_MODEL_EXTRACTION;
  if (!model) {
    throw new ExtractionError("ANTHROPIC_MODEL_EXTRACTION is not configured");
  }

  const client = getAnthropicClient();

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: EXTRACTION_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    // No cache_control here: cache breakpoints are cumulative from the
    // start of the request, so the system block's breakpoint below already
    // covers this tool definition too -- verified empirically (see
    // EXTRACTION_SYSTEM_PROMPT's comment) rather than adding a second,
    // redundant breakpoint.
    tools: [
      {
        name: TOOL_NAME,
        description: "Records structured extraction results from a client intake document.",
        input_schema: EXTRACTION_TOOL_INPUT_SCHEMA,
        // Grammar-constrained sampling guarantees the response matches the
        // schema exactly (type, required fields, enums) instead of just
        // strongly biasing toward it -- see proposal.ts's comment for the
        // real bug this class of guarantee fixes.
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: buildExtractionUserMessage(params),
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === TOOL_NAME,
  );

  if (!toolUse) {
    throw new ExtractionError("Model did not return a tool call with extraction results");
  }

  const parsed = ExtractionResultSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new ExtractionError(`Malformed extraction output: ${parsed.error.message}`);
  }

  const unverifiedExcerpts: string[] = [];
  for (const field of parsed.data.profile_fields) {
    if (field.source_excerpt && !params.redactedText.includes(field.source_excerpt)) {
      unverifiedExcerpts.push(field.source_excerpt);
    }
  }
  for (const finding of parsed.data.findings) {
    if (!params.redactedText.includes(finding.evidence_excerpt)) {
      unverifiedExcerpts.push(finding.evidence_excerpt);
    }
  }

  return { ...parsed.data, unverifiedExcerpts };
}
