import { CommandMenu } from "@/components/layout/command-menu";
import { MainNav } from "@/components/layout/main-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { requireSession } from "@/lib/auth/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireSession();
  const isAdmin = user.role === "admin";

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b bg-background px-4 md:px-6">
        <MobileNav isAdmin={isAdmin} />
        <MainNav isAdmin={isAdmin} className="hidden md:flex" />
        <div className="flex items-center gap-1">
          <CommandMenu isAdmin={isAdmin} />
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </header>
      {children}
    </div>
  );
}
