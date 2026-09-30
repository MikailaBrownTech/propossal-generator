import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: clients }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
    supabase
      .from("clients")
      .select("id, firm_name, firm_type, state, created_at")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="min-h-screen">
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="row between mx-auto max-w-5xl px-6 py-4">
          <div>
            <p className="small strong">ClearPath Workspace</p>
            <p className="xsmall muted">
              {profile?.full_name ?? user.email} &middot; {profile?.role ?? "staff"}
            </p>
          </div>
          <form action={signOut}>
            <button type="submit" className="btn secondary sm">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="row between">
          <h1 className="page-title">Clients</h1>
          <Link href="/clients/new" className="btn primary">
            New client
          </Link>
        </div>

        {clients && clients.length > 0 ? (
          <ul className="stack-sm mt-6" style={{ listStyle: "none", padding: 0 }}>
            {clients.map((client) => (
              <li key={client.id}>
                <Link href={`/clients/${client.id}`} className="card row between">
                  <div>
                    <p className="small strong">{client.firm_name}</p>
                    <p className="xsmall muted">
                      {[client.firm_type, client.state].filter(Boolean).join(" · ") ||
                        "No details yet"}
                    </p>
                  </div>
                  <span className="xsmall muted">
                    Added {new Date(client.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty mt-6">
            <p>
              No clients yet.{" "}
              <Link href="/clients/new">Add your first one</Link>.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
