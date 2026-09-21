"use client";

import { useCallback, useEffect, useState } from "react";
import { FormError } from "@/components/auth/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth/client";
import type { AuthResult, User, UserList } from "@/lib/auth/types";
import { BanDialog, DeleteDialog } from "./ban-dialog";

const PAGE_SIZE = 20;

function statusBadge(user: User) {
  if (user.banned) {
    return <Badge variant="destructive">Banned{user.banReason ? `: ${user.banReason}` : ""}</Badge>;
  }
  if (!user.emailVerified) return <Badge variant="secondary">Email not verified</Badge>;
  return <Badge variant="outline">Active</Badge>;
}

export function UsersTable({ currentUserId }: { currentUserId: string }) {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [list, setList] = useState<UserList | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await authClient.admin.listUsers({ search, limit: PAGE_SIZE, offset });
    if (error) setError(error.message);
    else setList(data);
  }, [search, offset]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function run(userId: string, action: () => Promise<AuthResult<unknown>>) {
    setPending(userId);
    setError(null);
    const { error } = await action();
    if (error) setError(error.message);
    await load();
    setPending(null);
  }

  const { admin } = authClient;

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setOffset(0);
        }}
        placeholder="Search by name or email"
        aria-label="Search users"
        className="max-w-sm"
      />
      <FormError message={error} />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list === null &&
              Array.from({ length: 3 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {list?.users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-muted-foreground">{user.email}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>{statusBadge(user)}</TableCell>
                <TableCell className="text-right">
                  {user.id === currentUserId ? (
                    <span className="text-muted-foreground">You</span>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={pending !== null}>
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            run(user.id, () =>
                              admin.setRole({
                                userId: user.id,
                                role: user.role === "admin" ? "user" : "admin",
                              }),
                            )
                          }
                        >
                          {user.role === "admin" ? "Make user" : "Make admin"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            user.banned
                              ? run(user.id, () => admin.unbanUser({ userId: user.id }))
                              : setBanTarget(user)
                          }
                        >
                          {user.banned ? "Unban" : "Ban"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            run(user.id, () => admin.revokeUserSessions({ userId: user.id }))
                          }
                        >
                          Revoke sessions
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(user)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {list?.users.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No user found.</p>
        )}
      </div>

      {list && list.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, list.total)} of {list.total}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= list.total}
          >
            Next
          </Button>
        </div>
      )}

      <BanDialog
        user={banTarget}
        onOpenChange={(open) => !open && setBanTarget(null)}
        onConfirm={(banReason) => {
          const target = banTarget;
          setBanTarget(null);
          if (target) void run(target.id, () => admin.banUser({ userId: target.id, banReason }));
        }}
      />
      <DeleteDialog
        user={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) void run(target.id, () => admin.removeUser({ userId: target.id }));
        }}
      />
    </div>
  );
}
