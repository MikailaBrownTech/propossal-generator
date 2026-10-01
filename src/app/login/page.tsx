import Link from "next/link";
import { login } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <h1 className="page-title">ClearPath Workspace</h1>
        <p className="small muted mt-1">Sign in to continue.</p>

        {message && <p className="banner info mt-4">{message}</p>}
        {error && <p className="banner error mt-4">{error}</p>}

        <form action={login} className="stack mt-6">
          <div className="field">
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <div className="row between">
              <label htmlFor="password" className="field-label">
                Password
              </label>
              <Link href="/forgot-password" className="xsmall">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn primary block">
            Sign in
          </button>
        </form>

        <p className="small muted mt-6 text-center">
          New ClearPath staff member? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
