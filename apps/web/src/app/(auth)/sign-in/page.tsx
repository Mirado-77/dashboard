import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { authErrorMessage } from "@/lib/auth/error-messages";
import { getProviders, getSession } from "@/lib/auth/server";
import { safeRedirect } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next, error } = await searchParams;
  const target = safeRedirect(typeof next === "string" ? next : null);
  if (await getSession()) redirect(target);
  const message = authErrorMessage(error);

  return (
    <AuthCard title="Sign in">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <SocialButtons providers={await getProviders()} next={target} />
      <SignInForm next={target} />
    </AuthCard>
  );
}
