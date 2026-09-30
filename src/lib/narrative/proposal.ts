import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic/client";
import { PROPOSAL_SYSTEM_PROMPT, buildProposalUserMessage } from "./proposal-prompt";
import {
  PROPOSAL_TOOL_INPUT_SCHEMA,
  ProposalNarrativeResultSchema,
  narrativeContainsDollarSign,
  type ProposalNarrativeResult,
} from "./proposal-schema";

const TOOL_NAME = "record_proposal_narrative";

export class ProposalNarrativeError extends Error {}

export interface ProposalPlanInput {
  name: string;
  fit_description: string | null;
  inclusions: string[];
}

async function callModel(userMessage: string): Promise<ProposalNarrativeResult> {
  const model = process.env.ANTHROPIC_MODEL_NARRATIVE;
  if (!model) {
    throw new ProposalNarrativeError("ANTHROPIC_MODEL_NARRATIVE is not configured");
  }

  const client = getAnthropicClient();

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: PROPOSAL_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description: "Records the generated proposal narrative.",
        input_schema: PROPOSAL_TOOL_INPUT_SCHEMA,
        // Grammar-constrained sampling guarantees the response matches the
        // schema's types exactly. Without this, open_questions came back as
        // a plain string instead of an array in real testing -- forced
        // tool_choice biases the model toward the schema but doesn't
        // guarantee it; strict mode does.
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
    throw new ProposalNarrativeError("Model did not return a tool call with proposal results");
  }

  const parsed = ProposalNarrativeResultSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new ProposalNarrativeError(`Malformed proposal output: ${parsed.error.message}`);
  }

  if (narrativeContainsDollarSign(parsed.data)) {
    // Fail closed rather than silently trusting a narrative that ignored
    // the no-pricing instruction.
    throw new ProposalNarrativeError("Generated narrative contained a '$' -- rejected");
  }

  return parsed.data;
}

export async function generateProposalNarrative(params: {
  profileData: Record<string, string | null>;
  plan: ProposalPlanInput;
}): Promise<ProposalNarrativeResult> {
  const userMessage = buildProposalUserMessage(params);

  try {
    return await callModel(userMessage);
  } catch (firstError) {
    // Single retry on a guardrail/validation failure -- re-sends the same
    // prompt rather than looping. If it fails again, fail closed.
    try {
      return await callModel(userMessage);
    } catch {
      throw firstError;
    }
  }
}
