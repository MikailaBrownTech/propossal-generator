import { z } from "zod";

export const ProposalNarrativeResultSchema = z.object({
  what_we_heard: z.string().min(1),
  why_this_plan_fits: z.string().min(1),
  ninety_day_plan: z.string().min(1),
  open_questions: z.array(z.string().min(1)),
});

export type ProposalNarrativeResult = z.infer<typeof ProposalNarrativeResultSchema>;

export const PROPOSAL_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    what_we_heard: { type: "string" },
    why_this_plan_fits: { type: "string" },
    ninety_day_plan: { type: "string" },
    open_questions: { type: "array", items: { type: "string" } },
  },
  required: ["what_we_heard", "why_this_plan_fits", "ninety_day_plan", "open_questions"],
  additionalProperties: false,
};

/** True if any narrative field contains a '$' -- the model must never
 * state or imply a price; pricing comes from the plans table only, and the
 * app renders it separately from this narrative. */
export function narrativeContainsDollarSign(result: ProposalNarrativeResult): boolean {
  const haystack = [
    result.what_we_heard,
    result.why_this_plan_fits,
    result.ninety_day_plan,
    ...result.open_questions,
  ].join("\n");

  return haystack.includes("$");
}
