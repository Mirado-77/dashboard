import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getSession } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Forgotten password" };

export default async function ForgotPasswordPage() {
  if (await getSession()) redirect("/settings/profile");

  return (
    <AuthCard title="Forgotten password">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
