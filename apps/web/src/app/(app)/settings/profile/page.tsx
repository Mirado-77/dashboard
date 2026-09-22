import type { Metadata } from "next";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { listAccounts, requireSession } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Profile" };

const CREDENTIAL_PROVIDER = "credential";

export default async function ProfilePage() {
  const [{ user }, accounts] = await Promise.all([requireSession(), listAccounts()]);
  const hasPassword = accounts.some((account) => account.providerId === CREDENTIAL_PROVIDER);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="text-sm text-foreground/70">Your account details and password.</p>
      </div>
      <ProfileForm user={user} />
      {hasPassword ? (
        <PasswordForm />
      ) : (
        <p className="text-sm text-muted-foreground">
          This account signs in with a linked provider, so it has no password.
        </p>
      )}
    </main>
  );
}
