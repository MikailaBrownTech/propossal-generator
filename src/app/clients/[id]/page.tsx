import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { US_STATES } from "@/lib/us-states";
import { addContact, addSourceDocument, runExtraction } from "./actions";
import { updateClientRecord } from "@/app/clients/actions";
import type { RedactionEntry } from "@/lib/redaction/redact";
import { PROFILE_FIELDS, PROFILE_FIELD_LABELS } from "@/lib/extraction/fields";
import { SubmitButton } from "@/components/SubmitButton";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  meeting_notes: "Meeting Notes",
  vulnerability_report: "Vulnerability Report",
  risk_assessment: "Risk Assessment",
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; highlight?: string }>;
}) {
  const { id } = await params;
  const { error, highlight } = await searchParams;

  const supabase = await createClient();

  const [
    { data: client },
    { data: contacts },
    { data: sourceDocuments },
    { data: currentProfile },
    { data: findingsSummary },
    { data: hasDraft },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase
      .from("client_contacts")
      .select("*")
      .eq("client_id", id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("source_documents")
      .select("id, source_type, redacted_text, redaction_log, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_profiles")
      .select("version, confirmed_at, data")
      .eq("client_id", id)
      .eq("is_current", true)
      .maybeSingle(),
    supabase.from("findings").select("status").eq("client_id", id),
    supabase
      .from("client_profiles")
      .select("id")
      .eq("client_id", id)
      .is("confirmed_at", null)
      .maybeSingle(),
  ]);

  if (!client) {
    notFound();
  }

  const confirmedFindingsCount = findingsSummary?.filter((f) => f.status === "confirmed").length ?? 0;
  const unresolvedFindingsCount = findingsSummary?.filter((f) => f.status === "unresolved").length ?? 0;
  const profileData = (currentProfile?.data ?? {}) as Record<string, string | null>;

  const updateClient = updateClientRecord.bind(null, id);
  const addContactForClient = addContact.bind(null, id);
  const addSourceDocumentForClient = addSourceDocument.bind(null, id);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="small">
          &larr; Back to clients
        </Link>

        {error && <p className="banner error mt-4">{error}</p>}

        <div className="row mt-4">
          <Link href={`/clients/${id}/findings-report`} className="btn secondary">
            Findings report
          </Link>
          <Link href={`/clients/${id}/proposal`} className="btn secondary">
            Proposal
          </Link>
        </div>

        {/* Client info */}
        <section className="card mt-4">
          <h1 className="page-title">{client.firm_name}</h1>
          <form action={updateClient} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="field-label">Firm name</label>
              <input name="firmName" type="text" defaultValue={client.firm_name} required />
            </div>
            <div className="field">
              <label className="field-label">Firm type</label>
              <input name="firmType" type="text" defaultValue={client.firm_type ?? ""} />
            </div>
            <div className="field">
              <label className="field-label">State</label>
              <select name="state" defaultValue={client.state ?? ""}>
                <option value="">Select a state</option>
                {US_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <div className="field sm:col-span-2">
              <label className="field-label">Notes</label>
              <textarea name="notes" rows={2} defaultValue={client.notes ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn secondary">
                Save changes
              </button>
            </div>
          </form>
        </section>

        {/* Confirmed profile */}
        <section className="card mt-6">
          <div className="card-head">
            <h2 className="section-title">
              Confirmed profile{currentProfile ? ` (v${currentProfile.version})` : ""}
            </h2>
            {hasDraft && (
              <Link href={`/clients/${id}/review`} className="btn primary sm">
                Review pending extraction
              </Link>
            )}
          </div>

          {currentProfile ? (
            <>
              <p className="xsmall muted">
                Confirmed {new Date(currentProfile.confirmed_at!).toLocaleString()}
              </p>
              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {PROFILE_FIELDS.map((fieldName) => (
                  <div key={fieldName}>
                    <dt className="xsmall muted">{PROFILE_FIELD_LABELS[fieldName]}</dt>
                    <dd className="small">{profileData[fieldName] ?? "—"}</dd>
                  </div>
                ))}
              </dl>
              <p className="small muted mt-4">
                Findings: {confirmedFindingsCount} confirmed
                {unresolvedFindingsCount > 0 && `, ${unresolvedFindingsCount} awaiting review`}
              </p>
            </>
          ) : (
            <p className="small muted mt-2">
              No confirmed profile yet.{" "}
              {hasDraft
                ? "There's an extraction waiting for review above."
                : "Run extraction on a source document below to get started."}
            </p>
          )}
        </section>

        {/* Contacts */}
        <section className="card mt-6">
          <h2 className="section-title">Contacts</h2>

          {contacts && contacts.length > 0 ? (
            <ul className="stack-sm mt-3" style={{ listStyle: "none", padding: 0 }}>
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <p className="small strong">
                    {contact.name}
                    {contact.is_primary && (
                      <span className="badge info" style={{ marginLeft: 8 }}>
                        Primary
                      </span>
                    )}
                  </p>
                  <p className="small muted">
                    {contact.email}
                    {contact.phone ? ` · ${contact.phone}` : ""}
                    {contact.title ? ` · ${contact.title}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted mt-2">No contacts yet.</p>
          )}

          <form action={addContactForClient} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input name="name" type="text" placeholder="Name" required />
            <input name="email" type="email" placeholder="Email" required />
            <input name="title" type="text" placeholder="Title (optional)" />
            <input name="phone" type="tel" placeholder="Phone (optional)" />
            <label className="check sm:col-span-2">
              <input name="isPrimary" type="checkbox" />
              Make this the primary contact
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn secondary">
                Add contact
              </button>
            </div>
          </form>
        </section>

        {/* Source documents */}
        <section className="card mt-6">
          <h2 className="section-title">Source documents</h2>

          <form action={addSourceDocumentForClient} className="stack-sm mt-4">
            <select name="sourceType" required defaultValue="">
              <option value="" disabled>
                What kind of document is this?
              </option>
              <option value="meeting_notes">Meeting notes</option>
              <option value="vulnerability_report">Vulnerability report</option>
              <option value="risk_assessment">Risk assessment</option>
            </select>
            <textarea
              name="rawText"
              rows={8}
              required
              placeholder="Paste meeting notes, a vulnerability scan report, or a risk assessment here..."
              className="mono"
            />
            <p className="xsmall muted">
              SSNs, EINs, card numbers, bank account numbers, and password-looking strings are
              redacted automatically before this is saved. You&apos;ll see exactly what was
              caught after you submit.
            </p>
            <button type="submit" className="btn primary">
              Save source document
            </button>
          </form>

          <ul className="stack mt-6" style={{ listStyle: "none", padding: 0 }}>
            {sourceDocuments?.map((doc) => {
              const redactionLog = (doc.redaction_log ?? []) as RedactionEntry[];
              const isHighlighted = doc.id === highlight;

              return (
                <li key={doc.id} className="card" style={{ background: "var(--surface-sunken)" }}>
                  <div className="row between">
                    <span className="badge">{SOURCE_TYPE_LABELS[doc.source_type] ?? doc.source_type}</span>
                    <div className="row">
                      <span className="xsmall muted">{new Date(doc.created_at).toLocaleString()}</span>
                      <form action={runExtraction.bind(null, id, doc.id)}>
                        <SubmitButton pendingText="Extracting..." className="btn secondary sm">
                          Run extraction
                        </SubmitButton>
                      </form>
                    </div>
                  </div>

                  {redactionLog.length > 0 && (
                    <div
                      className="banner info mt-3"
                      style={isHighlighted ? { borderColor: "var(--accent)" } : undefined}
                    >
                      <div>
                        <p className="strong small">
                          Redacted {redactionLog.length} item{redactionLog.length === 1 ? "" : "s"} before
                          saving:
                        </p>
                        <ul className="stack-sm mt-1" style={{ listStyle: "none", padding: 0 }}>
                          {redactionLog.map((entry, i) => (
                            <li key={i} className="xsmall">
                              <span className="strong">{entry.type}</span> &mdash; {entry.context}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {doc.redacted_text.length > 400 ? (
                    <>
                      <p className="small mt-3" style={{ whiteSpace: "pre-wrap" }}>
                        {doc.redacted_text.slice(0, 400)}&hellip;
                      </p>
                      <details className="group mt-2">
                        <summary className="text-link small" style={{ listStyle: "none" }}>
                          <span className="group-open:hidden">Show full text</span>
                          <span className="hidden group-open:inline">Hide full text</span>
                        </summary>
                        <p className="small mt-2" style={{ whiteSpace: "pre-wrap" }}>
                          {doc.redacted_text}
                        </p>
                      </details>
                    </>
                  ) : (
                    <p className="small mt-3" style={{ whiteSpace: "pre-wrap" }}>
                      {doc.redacted_text}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
