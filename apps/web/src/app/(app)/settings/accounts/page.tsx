import type { Metadata } from "next";
import { LinkedAccounts } from "@/components/settings/linked-accounts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authErrorMessage } from "@/lib/auth/error-messages";
import { getProviders, listAccounts } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Connected accounts" };

export default async function AccountsPage({ searchParams }: PageProps<"/settings/accounts">) {
  const { error } = await searchParams;
  const message = authErrorMessage(error);
  const [providers, accounts] = await Promise.all([getProviders(), listAccounts()]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Connected accounts</h1>
        <p className="text-sm text-foreground/70">
          Link your third-party accounts to sign in with them and to use their widgets.
        </p>
      </div>
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <LinkedAccounts providers={providers} accounts={accounts} />
    </main>
  );
}
