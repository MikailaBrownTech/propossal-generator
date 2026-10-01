import { updatePassword } from "@/app/auth/actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <h1 className="page-title">Set a new password</h1>
        <p className="small muted mt-1">Choose a new password for your account.</p>

        {error && <p className="banner error mt-4">{error}</p>}

        <form action={updatePassword} className="stack mt-6">
          <div className="field">
            <label htmlFor="password" className="field-label">
              New password
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
          <div className="field">
            <label htmlFor="confirmPassword" className="field-label">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn primary block">
            Update password
          </button>
        </form>
      </div>
    </main>
  );
}
