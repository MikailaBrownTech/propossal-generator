import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_FIELDS, PROFILE_FIELD_LABELS } from "@/lib/extraction/fields";
import { confirmProfile } from "./actions";

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const;

const SOURCE_TYPE_LABELS: Record<string, string> = {
  meeting_notes: "Meeting Notes",
  vulnerability_report: "Vulnerability Report",
  risk_assessment: "Risk Assessment",
};

interface ProvenanceRow {
  id: string;
  field_name: string;
  value: string | null;
  source_excerpt: string | null;
  created_at: string;
  source_documents: { source_type: string } | null;
}

export default async function ReviewPage({
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

  const { data: draft } = await supabase
    .from("client_profiles")
    .select("id, version")
    .eq("client_id", clientId)
    .is("confirmed_at", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: provenanceRows }, { data: findings }] = await Promise.all([
    draft
      ? supabase
          .from("profile_field_provenance")
          .select("id, field_name, value, source_excerpt, created_at, source_documents(source_type)")
          .eq("client_profile_id", draft.id)
          .order("created_at", { ascending: true })
          .returns<ProvenanceRow[]>()
      : Promise.resolve({ data: [] as ProvenanceRow[] }),
    supabase
      .from("findings")
      .select("id, control_area, technical_description, affected_scope, severity, evidence_excerpt, source_documents(source_type)")
      .eq("client_id", clientId)
      .eq("status", "unresolved")
      .order("created_at", { ascending: true }),
  ]);

  const provenanceByField = new Map<string, ProvenanceRow[]>();
  for (const row of provenanceRows ?? []) {
    const list = provenanceByField.get(row.field_name) ?? [];
    list.push(row);
    provenanceByField.set(row.field_name, list);
  }

  const hasNothingToReview = !draft && (!findings || findings.length === 0);

  if (hasNothingToReview) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link href={`/clients/${clientId}`} className="small">
            &larr; Back to {client.firm_name}
          </Link>
          <p className="small muted mt-6">
            Nothing to review yet. Run extraction from a source document on the client page first.
          </p>
        </div>
      </main>
    );
  }

  const confirmAction = confirmProfile.bind(null, clientId, draft?.id ?? null);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href={`/clients/${clientId}`} className="small">
          &larr; Back to {client.firm_name}
        </Link>

        <h1 className="page-title mt-4">Review extracted data &mdash; {client.firm_name}</h1>
        <p className="small muted mt-1">
          Nothing downstream runs until you confirm this. Edit anything that&apos;s wrong or
          missing before confirming.
        </p>

        {error && <p className="banner error mt-4">{error}</p>}

        <form action={confirmAction} className="stack mt-6">
          {draft && (
            <section className="card">
              <h2 className="section-title">Client profile (draft v{draft.version})</h2>
              <div className="stack mt-4">
                {PROFILE_FIELDS.map((fieldName) => {
                  const history = provenanceByField.get(fieldName) ?? [];
                  const latest = history[history.length - 1];
                  const earlier = history.slice(0, -1);

                  return (
                    <div key={fieldName} className="field">
                      <label htmlFor={`field_${fieldName}`} className="field-label">
                        {PROFILE_FIELD_LABELS[fieldName]}
                      </label>
                      <input
                        id={`field_${fieldName}`}
                        name={`field_${fieldName}`}
                        type="text"
                        defaultValue={latest?.value ?? ""}
                        placeholder="Not mentioned in any source document -- fill in if known"
                      />
                      {latest?.source_excerpt && (
                        <p className="evidence">
                          From {SOURCE_TYPE_LABELS[latest.source_documents?.source_type ?? ""] ?? "source"}:
                          <span className="quote">{latest.source_excerpt}</span>
                        </p>
                      )}
                      {earlier.length > 0 && (
                        <details className="mt-1">
                          <summary className="text-link xsmall" style={{ listStyle: "none" }}>
                            {earlier.length} earlier mention{earlier.length === 1 ? "" : "s"}
                          </summary>
                          <ul className="stack-sm mt-1" style={{ listStyle: "none", padding: 0 }}>
                            {earlier.map((entry) => (
                              <li key={entry.id} className="xsmall muted">
                                {entry.value} &mdash; <span className="quote">{entry.source_excerpt}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {findings && findings.length > 0 && (
            <section className="card">
              <h2 className="section-title">Findings ({findings.length})</h2>
              <div className="stack mt-4">
                {findings.map((finding) => (
                  <div key={finding.id} className="card" style={{ background: "var(--surface-sunken)" }}>
                    <input type="hidden" name="finding_id" value={finding.id} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="field">
                        <label className="field-label xsmall">Control area</label>
                        <input
                          name={`finding_${finding.id}_control_area`}
                          type="text"
                          defaultValue={finding.control_area}
                        />
                      </div>
                      <div className="field">
                        <label className="field-label xsmall">Severity</label>
                        <select name={`finding_${finding.id}_severity`} defaultValue={finding.severity}>
                          {SEVERITY_OPTIONS.map((sev) => (
                            <option key={sev} value={sev}>
                              {sev.charAt(0).toUpperCase() + sev.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field sm:col-span-2">
                        <label className="field-label xsmall">Technical description</label>
                        <textarea
                          name={`finding_${finding.id}_technical_description`}
                          rows={2}
                          defaultValue={finding.technical_description}
                        />
                      </div>
                      <div className="field sm:col-span-2">
                        <label className="field-label xsmall">Affected scope</label>
                        <input
                          name={`finding_${finding.id}_affected_scope`}
                          type="text"
                          defaultValue={finding.affected_scope ?? ""}
                        />
                      </div>
                    </div>
                    <p className="evidence mt-3">
                      Evidence: <span className="quote">{finding.evidence_excerpt}</span>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button type="submit" className="btn primary">
            Confirm and save
          </button>
        </form>
      </div>
    </main>
  );
}
