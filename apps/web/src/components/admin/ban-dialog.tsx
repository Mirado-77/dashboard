"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@/lib/auth/types";

interface BanDialogProps {
  user: User | null;
  onOpenChange(open: boolean): void;
  onConfirm(reason: string): void;
}

export function BanDialog({ user, onOpenChange, onConfirm }: BanDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) setReason("");
        onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban {user?.name}</DialogTitle>
          <DialogDescription>
            {user?.email} loses access immediately and every session is revoked.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="banReason">Reason (optional)</Label>
          <Input
            id="banReason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={() => onConfirm(reason)}>
            Ban this user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteDialogProps {
  user: User | null;
  onOpenChange(open: boolean): void;
  onConfirm(): void;
}

export function DeleteDialog({ user, onOpenChange, onConfirm }: DeleteDialogProps) {
  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {user?.name}?</DialogTitle>
          <DialogDescription>
            {user?.email}, their sessions and their linked accounts are removed. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
