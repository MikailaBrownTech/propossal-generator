import Link from "next/link";
import { signup } from "@/app/auth/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <h1 className="page-title">Create your account</h1>
        <p className="small muted mt-1">
          The first account created becomes the workspace owner; every account after that starts
          as staff.
        </p>

        {error && <p className="banner error mt-4">{error}</p>}

        <form action={signup} className="stack mt-6">
          <div className="field">
            <label htmlFor="fullName" className="field-label">
              Full name
            </label>
            <input id="fullName" name="fullName" type="text" required autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn primary block">
            Create account
          </button>
        </form>

        <p className="small muted mt-6 text-center">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
