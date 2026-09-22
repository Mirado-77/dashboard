import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "New password" };

// Target of the reset link sent by email.
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token, error } = await searchParams;
  const valid = typeof token === "string" && token !== "" && !error;

  return (
    <AuthCard title="New password">
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p role="alert">
          This reset link is invalid or has expired.{" "}
          <Link href="/forgot-password" className="underline">
            Ask for a new one
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
