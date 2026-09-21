import type { InputHTMLAttributes } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
}

export function Field({ label, name, ...props }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert" aria-live="polite">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: string }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Please wait…" : children}
    </Button>
  );
}
