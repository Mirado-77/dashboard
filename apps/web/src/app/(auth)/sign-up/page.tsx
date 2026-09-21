import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { getProviders, getSession } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <AuthCard title="Create an account">
      <SocialButtons providers={await getProviders()} next="/dashboard" />
      <SignUpForm />
    </AuthCard>
  );
}
