import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <h1 className="page-title">Reset your password</h1>
        <p className="small muted mt-1">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>

        {message && <p className="banner info mt-4">{message}</p>}
        {error && <p className="banner error mt-4">{error}</p>}

        <form action={requestPasswordReset} className="stack mt-6">
          <div className="field">
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <button type="submit" className="btn primary block">
            Send reset link
          </button>
        </form>

        <p className="small muted mt-6 text-center">
          <Link href="/login">&larr; Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
