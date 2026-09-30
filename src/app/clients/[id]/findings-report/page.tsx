import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  generateReport,
  saveReportEdits,
  markReviewed,
  approveReport,
  revertToDraft,
} from "./actions";

interface FindingTranslation {
  finding_id: string;
  what_we_found: string;
  why_it_matters: string;
  what_we_will_do: string;
  what_we_need_from_you: string;
}

interface TopPriority {
  finding_id: string;
  rationale: string;
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

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

export default async function FindingsReportPage({
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

  const [{ data: report }, { data: findings }] = await Promise.all([
    supabase.from("findings_reports").select("*").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("findings")
      .select("id, control_area, severity, technical_description, affected_scope, evidence_excerpt")
      .eq("client_id", clientId)
      .eq("status", "confirmed")
      .order("created_at", { ascending: true }),
  ]);

  const generateAction = generateReport.bind(null, clientId);

  if (!report) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link href={`/clients/${clientId}`} className="small">
            &larr; Back to {client.firm_name}
          </Link>
          {error && <p className="banner error mt-4">{error}</p>}
          <h1 className="page-title mt-4">Findings report</h1>
          <p className="small muted mt-2">
            {findings && findings.length > 0
              ? `${findings.length} confirmed finding(s) ready to report on.`
              : "No confirmed findings yet -- confirm findings on the review screen first."}
          </p>
          {findings && findings.length > 0 && (
            <form action={generateAction} className="mt-4">
              <button type="submit" className="btn primary">
                Generate findings report
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  const findingsById = new Map((findings ?? []).map((f) => [f.id, f]));
  const topPriorities = (report.top_priorities ?? []) as TopPriority[];
  const translations = (report.finding_translations ?? []) as FindingTranslation[];
  const isLocked = report.status === "approved";

  const severityCounts = SEVERITY_ORDER.map((sev) => ({
    severity: sev,
    count: (findings ?? []).filter((f) => f.severity === sev).length,
  })).filter((s) => s.count > 0);

  const saveAction = saveReportEdits.bind(null, report.id, clientId);
  const markReviewedAction = markReviewed.bind(null, report.id, clientId);
  const approveAction = approveReport.bind(null, report.id, clientId);
  const revertAction = revertToDraft.bind(null, report.id, clientId);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href={`/clients/${clientId}`} className="small">
          &larr; Back to {client.firm_name}
        </Link>

        {error && <p className="banner error mt-4">{error}</p>}

        {/* Hero: the one glass card on this page. */}
        <section className="card-glass mt-4">
          <div className="row between">
            <div>
              <p className="stat-num">{findings?.length ?? 0}</p>
              <p className="small muted">
                confirmed finding{(findings?.length ?? 0) === 1 ? "" : "s"} &mdash; {client.firm_name}
              </p>
            </div>
            <span className={STATUS_BADGE_CLASS[report.status]}>{STATUS_LABELS[report.status]}</span>
          </div>
          {severityCounts.length > 0 && (
            <div className="row mt-3">
              {severityCounts.map(({ severity, count }) => (
                <span key={severity} className={`badge severity-${severity}`}>
                  {count} {severity}
                </span>
              ))}
            </div>
          )}
        </section>

        <div className="row mt-4">
          <a href={`/clients/${clientId}/findings-report/export`} className="btn secondary">
            Export PDF{report.status !== "approved" ? " (draft watermark)" : ""}
          </a>
          <form action={generateAction}>
            <button type="submit" className="btn secondary">
              Regenerate (discards edits)
            </button>
          </form>
          {isLocked && (
            <form action={revertAction}>
              <button type="submit" className="btn secondary">
                Revert to draft
              </button>
            </form>
          )}
        </div>

        {isLocked ? (
          <div className="stack mt-6">
            <section className="card">
              <h2 className="section-title">Executive summary</h2>
              <p className="small mt-2" style={{ whiteSpace: "pre-wrap" }}>
                {report.executive_summary}
              </p>
            </section>
            <section className="card">
              <h2 className="section-title">Top priorities</h2>
              <ul className="stack-sm mt-2" style={{ listStyle: "none", padding: 0 }}>
                {topPriorities.map((p) => (
                  <li key={p.finding_id} className="small">
                    <span className="strong">{findingsById.get(p.finding_id)?.control_area}</span>
                    {" — "}
                    {p.rationale}
                  </li>
                ))}
              </ul>
            </section>
            <section className="card">
              <h2 className="section-title">Findings</h2>
              <div className="stack mt-4">
                {translations.map((t) => {
                  const finding = findingsById.get(t.finding_id);
                  return (
                    <div key={t.finding_id} className="card" style={{ background: "var(--surface-sunken)" }}>
                      <div className="row">
                        <p className="small strong">{finding?.control_area}</p>
                        {finding?.severity && (
                          <span className={`badge severity-${finding.severity}`}>{finding.severity}</span>
                        )}
                      </div>
                      <p className="small mt-2">
                        <span className="strong">What we found: </span>
                        {t.what_we_found}
                      </p>
                      <p className="small mt-1">
                        <span className="strong">Why it matters: </span>
                        {t.why_it_matters}
                      </p>
                      <p className="small mt-1">
                        <span className="strong">What we&apos;ll do: </span>
                        {t.what_we_will_do}
                      </p>
                      <p className="small mt-1">
                        <span className="strong">What we need from you: </span>
                        {t.what_we_need_from_you}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          <form action={saveAction} className="stack mt-6">
            <section className="card">
              <h2 className="section-title">Executive summary</h2>
              <textarea
                name="executive_summary"
                rows={4}
                defaultValue={report.executive_summary}
                className="mt-2"
              />
            </section>

            <section className="card">
              <h2 className="section-title">Top priorities</h2>
              <div className="stack mt-4">
                {topPriorities.map((p) => {
                  const finding = findingsById.get(p.finding_id);
                  return (
                    <div key={p.finding_id} className="card" style={{ background: "var(--surface-sunken)" }}>
                      <label className="check">
                        <input
                          type="checkbox"
                          name="priority_finding_id"
                          value={p.finding_id}
                          defaultChecked
                        />
                        <span className="small strong">{finding?.control_area}</span>
                      </label>
                      <textarea
                        name={`priority_${p.finding_id}_rationale`}
                        rows={2}
                        defaultValue={p.rationale}
                        className="mt-2"
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <h2 className="section-title">Findings ({translations.length})</h2>
              <div className="stack mt-4">
                {translations.map((t) => {
                  const finding = findingsById.get(t.finding_id);
                  return (
                    <div key={t.finding_id} className="card" style={{ background: "var(--surface-sunken)" }}>
                      <input type="hidden" name="translation_finding_id" value={t.finding_id} />
                      <div className="row">
                        <p className="small strong">{finding?.control_area}</p>
                        {finding?.severity && (
                          <span className={`badge severity-${finding.severity}`}>{finding.severity}</span>
                        )}
                      </div>
                      <p className="evidence mt-1">
                        Evidence: <span className="quote">{finding?.evidence_excerpt}</span>
                      </p>

                      <div className="field mt-3">
                        <label className="field-label xsmall">What we found</label>
                        <textarea
                          name={`translation_${t.finding_id}_what_we_found`}
                          rows={2}
                          defaultValue={t.what_we_found}
                        />
                      </div>

                      <div className="field mt-3">
                        <label className="field-label xsmall">Why it matters</label>
                        <textarea
                          name={`translation_${t.finding_id}_why_it_matters`}
                          rows={2}
                          defaultValue={t.why_it_matters}
                        />
                      </div>

                      <div className="field mt-3">
                        <label className="field-label xsmall">What we&apos;ll do</label>
                        <textarea
                          name={`translation_${t.finding_id}_what_we_will_do`}
                          rows={2}
                          defaultValue={t.what_we_will_do}
                        />
                      </div>

                      <div className="field mt-3">
                        <label className="field-label xsmall">What we need from you</label>
                        <textarea
                          name={`translation_${t.finding_id}_what_we_need_from_you`}
                          rows={2}
                          defaultValue={t.what_we_need_from_you}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="row">
              <button type="submit" className="btn primary">
                Save changes
              </button>
            </div>
          </form>
        )}

        {!isLocked && (
          <div className="row mt-6">
            {report.status === "draft" && (
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
