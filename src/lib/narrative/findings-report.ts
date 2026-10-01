import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic/client";
import {
  FINDINGS_REPORT_SYSTEM_PROMPT,
  buildFindingsReportUserMessage,
} from "./findings-report-prompt";
import {
  FINDINGS_REPORT_TOOL_INPUT_SCHEMA,
  FindingsReportResultSchema,
  type FindingsReportResult,
} from "./findings-report-schema";

const TOOL_NAME = "record_findings_report";

export class FindingsReportError extends Error {}

export interface ConfirmedFindingInput {
  id: string;
  control_area: string;
  severity: string;
  technical_description: string;
  affected_scope: string | null;
  evidence_excerpt: string;
}

export interface FindingsReportOutcome {
  executiveSummary: string;
  topPriorities: { findingId: string; rationale: string }[];
  findingTranslations: {
    findingId: string;
    whatWeFound: string;
    whyItMatters: string;
    whatWeWillDo: string;
    whatWeNeedFromYou: string;
  }[];
}

// Non-streaming requests should stay comfortably under the SDK's HTTP
// timeout, so we cap well below the model's 128K ceiling (which requires
// streaming). Within that cap, size the budget to the actual job: one full
// 4-field translation per finding, plus a fixed allowance for the executive
// summary and up to 3 top priorities.
const NON_STREAMING_MAX_TOKENS_CAP = 16000;
const TOKENS_PER_FINDING = 500;
const FIXED_OUTPUT_TOKENS = 1500;

function computeMaxTokens(findingCount: number): number {
  return Math.min(NON_STREAMING_MAX_TOKENS_CAP, FIXED_OUTPUT_TOKENS + findingCount * TOKENS_PER_FINDING);
}

async function callModel(userMessage: string, findingCount: number): Promise<FindingsReportResult> {
  const model = process.env.ANTHROPIC_MODEL_NARRATIVE;
  if (!model) {
    throw new FindingsReportError("ANTHROPIC_MODEL_NARRATIVE is not configured");
  }

  const client = getAnthropicClient();

  const response = await client.messages.create({
    model,
    max_tokens: computeMaxTokens(findingCount),
    system: [
      {
        type: "text",
        text: FINDINGS_REPORT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description: "Records the generated findings report.",
        input_schema: FINDINGS_REPORT_TOOL_INPUT_SCHEMA,
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === TOOL_NAME,
  );

  if (!toolUse) {
    throw new FindingsReportError("Model did not return a tool call with report results");
  }

  const parsed = FindingsReportResultSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new FindingsReportError(`Malformed report output: ${parsed.error.message}`);
  }

  return parsed.data;
}

/** Every index 1..N must appear in finding_translations exactly once, and
 * every finding_index referenced anywhere must fall within that range --
 * an out-of-range index is treated the same as an invented finding ID. */
function validateIndexCoverage(result: FindingsReportResult, findingCount: number): void {
  const validIndexes = new Set(Array.from({ length: findingCount }, (_, i) => i + 1));

  const translatedIndexes = result.finding_translations.map((t) => t.finding_index);
  const translatedSet = new Set(translatedIndexes);

  if (translatedIndexes.length !== translatedSet.size) {
    throw new FindingsReportError("Model produced duplicate finding_translations for the same index");
  }

  for (const index of translatedIndexes) {
    if (!validIndexes.has(index)) {
      throw new FindingsReportError(`Model referenced an invalid finding index: ${index}`);
    }
  }

  if (translatedSet.size !== validIndexes.size) {
    throw new FindingsReportError("Model did not translate every confirmed finding");
  }

  for (const priority of result.top_priorities) {
    if (!validIndexes.has(priority.finding_index)) {
      throw new FindingsReportError(`Model referenced an invalid finding index in top_priorities: ${priority.finding_index}`);
    }
  }
}

export async function generateFindingsReport(
  findings: ConfirmedFindingInput[],
): Promise<FindingsReportOutcome> {
  if (findings.length === 0) {
    throw new FindingsReportError("No confirmed findings to report on");
  }

  const indexed = findings.map((finding, i) => ({ ...finding, index: i + 1 }));
  const userMessage = buildFindingsReportUserMessage(indexed);

  let result: FindingsReportResult;
  try {
    result = await callModel(userMessage, findings.length);
    validateIndexCoverage(result, findings.length);
  } catch (firstError) {
    // Single retry on a guardrail/validation failure -- re-sends the same
    // prompt rather than looping. If it fails again, fail closed.
    try {
      result = await callModel(userMessage, findings.length);
      validateIndexCoverage(result, findings.length);
    } catch {
      throw firstError;
    }
  }

  const byIndex = new Map(indexed.map((f) => [f.index, f.id]));

  return {
    executiveSummary: result.executive_summary,
    topPriorities: result.top_priorities.map((p) => ({
      findingId: byIndex.get(p.finding_index)!,
      rationale: p.rationale,
    })),
    findingTranslations: result.finding_translations.map((t) => ({
      findingId: byIndex.get(t.finding_index)!,
      whatWeFound: t.what_we_found,
      whyItMatters: t.why_it_matters,
      whatWeWillDo: t.what_we_will_do,
      whatWeNeedFromYou: t.what_we_need_from_you,
    })),
  };
}
