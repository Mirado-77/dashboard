import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerification } from "@/components/auth/resend-verification";
import { getSession } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Email confirmation" };

// Target of the confirmation link once the API has processed the token.
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { error } = await searchParams;
  if (!error && (await getSession())) redirect("/dashboard");

  return (
    <AuthCard title="Email confirmation">
      {error ? (
        <>
          <p role="alert">This confirmation link is invalid or has expired.</p>
          <ResendVerification />
        </>
      ) : (
        <p>
          Your email is confirmed.{" "}
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
