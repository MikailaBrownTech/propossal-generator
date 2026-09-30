import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  generateProposal,
  saveProposalEdits,
  markReviewed,
  approveProposal,
  revertToDraft,
} from "./actions";

interface ProposalNarrative {
  what_we_heard: string;
  why_this_plan_fits: string;
  ninety_day_plan: string;
  open_questions: string[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  approved: "Approved for Client",
};

// Approved is the one place --lime appears in this app (see globals.css).
const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: "badge outline",
  reviewed: "badge warning",
  approved: "badge approved",
};

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: clientId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("id, firm_name").eq("id", clientId).single();
  if (!client) {
    notFound();
  }

  const [{ data: proposal }, { data: plans }, { data: currentProfile }] = await Promise.all([
    supabase.from("proposals").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("plans").select("id, name, price_display, fit_description, inclusions, notes").eq("is_active", true).order("sort_order"),
    supabase.from("client_profiles").select("id").eq("client_id", clientId).eq("is_current", true).maybeSingle(),
  ]);

  const generateAction = generateProposal.bind(null, clientId);
  const selectedPlan = proposal ? (plans ?? []).find((p) => p.id === proposal.plan_id) : null;

  if (!proposal) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link href={`/clients/${clientId}`} className="small">
            &larr; Back to {client.firm_name}
          </Link>
          {error && <p className="banner error mt-4">{error}</p>}
          <h1 className="page-title mt-4">Proposal</h1>

          {!currentProfile ? (
            <p className="small muted mt-2">
              No confirmed client profile yet -- confirm one on the review screen first.
            </p>
          ) : (
            <form action={generateAction} className="card stack mt-4">
              <div className="field">
                <label htmlFor="planId" className="field-label">
                  Which plan fits this client?
                </label>
                <select id="planId" name="planId" required defaultValue="">
                  <option value="" disabled>
                    Select a plan
                  </option>
                  {plans?.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({plan.price_display})
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn primary">
                Generate proposal
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  const narrative = proposal.narrative as ProposalNarrative;
  const isLocked = proposal.status === "approved";

  const saveAction = saveProposalEdits.bind(null, proposal.id, clientId);
  const markReviewedAction = markReviewed.bind(null, proposal.id, clientId);
  const approveAction = approveProposal.bind(null, proposal.id, clientId);
  const revertAction = revertToDraft.bind(null, proposal.id, clientId);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href={`/clients/${clientId}`} className="small">
          &larr; Back to {client.firm_name}
        </Link>

        {error && <p className="banner error mt-4">{error}</p>}

        {/* Hero: the one glass card on this page -- the selected plan, rendered straight from
            the plans table (never the model). */}
        {selectedPlan && (
          <section className="card-glass mt-4">
            <div className="row between">
              <div>
                <p className="small muted">{selectedPlan.name}</p>
                <p className="stat-num">{selectedPlan.price_display}</p>
              </div>
              <span className={STATUS_BADGE_CLASS[proposal.status]}>{STATUS_LABELS[proposal.status]}</span>
            </div>
            {selectedPlan.fit_description && (
              <p className="small muted mt-2">{selectedPlan.fit_description}</p>
            )}
            <ul className="mt-3" style={{ listStyle: "disc", paddingLeft: 20 }}>
              {(selectedPlan.inclusions ?? []).map((item: string, i: number) => (
                <li key={i} className="small">
                  {item}
                </li>
              ))}
            </ul>
            {selectedPlan.notes && <p className="xsmall muted mt-3">{selectedPlan.notes}</p>}
          </section>
        )}

        <div className="row mt-4">
          <a href={`/clients/${clientId}/proposal/export`} className="btn secondary">
            Export PDF{proposal.status !== "approved" ? " (draft watermark)" : ""}
          </a>
          {isLocked && (
            <form action={revertAction}>
              <button type="submit" className="btn secondary">
                Revert to draft
              </button>
            </form>
          )}
        </div>

        <form action={generateAction} className="card row mt-4" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="planId" className="field-label">
              Regenerate with plan
            </label>
            <select id="planId" name="planId" defaultValue={proposal.plan_id}>
              {plans?.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.price_display})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn secondary">
            Regenerate (discards edits)
          </button>
        </form>

        {isLocked ? (
          <div className="card stack mt-6">
            <div>
              <h2 className="section-title">What we heard</h2>
              <p className="small mt-1" style={{ whiteSpace: "pre-wrap" }}>
                {narrative.what_we_heard}
              </p>
            </div>
            <div>
              <h2 className="section-title">Why this plan fits</h2>
              <p className="small mt-1" style={{ whiteSpace: "pre-wrap" }}>
                {narrative.why_this_plan_fits}
              </p>
            </div>
            <div>
              <h2 className="section-title">First 90 days</h2>
              <p className="small mt-1" style={{ whiteSpace: "pre-wrap" }}>
                {narrative.ninety_day_plan}
              </p>
            </div>
            {narrative.open_questions?.length > 0 && (
              <div>
                <h2 className="section-title">Open questions</h2>
                <ul className="mt-1" style={{ listStyle: "disc", paddingLeft: 20 }}>
                  {narrative.open_questions.map((q, i) => (
                    <li key={i} className="small">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <form action={saveAction} className="card stack mt-6">
            <div className="field">
              <label className="field-label">What we heard</label>
              <textarea name="what_we_heard" rows={3} defaultValue={narrative.what_we_heard} />
            </div>
            <div className="field">
              <label className="field-label">Why this plan fits</label>
              <textarea
                name="why_this_plan_fits"
                rows={3}
                defaultValue={narrative.why_this_plan_fits}
              />
            </div>
            <div className="field">
              <label className="field-label">First 90 days</label>
              <textarea name="ninety_day_plan" rows={4} defaultValue={narrative.ninety_day_plan} />
            </div>
            <div className="field">
              <label className="field-label">Open questions (one per line)</label>
              <textarea
                name="open_questions"
                rows={3}
                defaultValue={(narrative.open_questions ?? []).join("\n")}
              />
            </div>
            <p className="xsmall muted">
              No dollar amounts in this text -- pricing only ever comes from the plan card above.
            </p>
            <button type="submit" className="btn primary">
              Save changes
            </button>
          </form>
        )}

        {!isLocked && (
          <div className="row mt-6">
            {proposal.status === "draft" && (
              <form action={markReviewedAction}>
                <button type="submit" className="btn secondary">
                  Mark as reviewed
                </button>
              </form>
            )}
            <form action={approveAction}>
              <button type="submit" className="btn primary">
                Approve
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
