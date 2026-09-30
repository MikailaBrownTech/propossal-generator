import Link from "next/link";
import { createClientRecord } from "@/app/clients/actions";
import { US_STATES } from "@/lib/us-states";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-xl px-6 py-12">
        <Link href="/" className="small">
          &larr; Back to clients
        </Link>

        <h1 className="page-title mt-4">New client</h1>

        {error && <p className="banner error mt-4">{error}</p>}

        <form action={createClientRecord} className="card stack mt-6">
          <div className="field">
            <label htmlFor="firmName" className="field-label">
              Firm name
            </label>
            <input id="firmName" name="firmName" type="text" required />
          </div>

          <div className="field">
            <label htmlFor="firmType" className="field-label">
              Firm type
            </label>
            <input
              id="firmType"
              name="firmType"
              type="text"
              list="firm-type-suggestions"
              placeholder="e.g. CPA firm, Bookkeeping, Tax prep"
            />
            <datalist id="firm-type-suggestions">
              <option value="CPA firm" />
              <option value="Bookkeeping" />
              <option value="Tax preparation" />
              <option value="Financial advisory" />
            </datalist>
          </div>

          <div className="field">
            <label htmlFor="state" className="field-label">
              State
            </label>
            <select id="state" name="state" defaultValue="">
              <option value="">Select a state</option>
              {US_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="notes" className="field-label">
              Notes
            </label>
            <textarea id="notes" name="notes" rows={3} />
          </div>

          <button type="submit" className="btn primary block">
            Create client
          </button>
        </form>
      </div>
    </main>
  );
}
