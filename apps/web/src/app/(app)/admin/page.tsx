import type { Metadata } from "next";
import { UsersTable } from "@/components/admin/users-table";
import { requireAdmin } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminPage() {
  const { user } = await requireAdmin();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Users</h1>
      <UsersTable currentUserId={user.id} />
    </main>
  );
}
