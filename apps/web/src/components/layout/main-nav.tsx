"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings/services", label: "Services" },
  { href: "/settings/accounts", label: "Accounts" },
];

const adminLink = { href: "/admin", label: "Admin" };

interface MainNavProps {
  isAdmin: boolean;
  className?: string;
  onNavigate?: () => void;
}

export function MainNav({ isAdmin, className, onNavigate }: MainNavProps) {
  const pathname = usePathname();
  const items = isAdmin ? [...links, adminLink] : links;

  return (
    <nav aria-label="Main" className={cn("flex gap-1", className)}>
      {items.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Button
            key={href}
            variant="ghost"
            size="sm"
            className={cn("justify-start", active ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
            asChild
          >
            <Link href={href} aria-current={active ? "page" : undefined} onClick={onNavigate}>
              {label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
