import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireSession();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <nav aria-label="Main" className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings/accounts">Accounts</Link>
          </Button>
          {user.role === "admin" && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">Admin</Link>
            </Button>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-sm">{user.name}</span>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
