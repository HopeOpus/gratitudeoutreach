import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-13 w-full rounded-md border border-neutral-100 bg-white px-4 text-body-lg text-ink placeholder:text-neutral-500",
          "focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-2 disabled:bg-neutral-50 disabled:text-neutral-500",
          invalid && "border-danger focus:ring-danger",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "min-h-28 w-full rounded-md border border-neutral-100 bg-white px-4 py-3 text-body-lg text-ink placeholder:text-neutral-500",
          "focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-2",
          invalid && "border-danger",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-12 w-full rounded-md border border-neutral-100 bg-white px-3 text-body text-ink focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-2",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Field({
  label, htmlFor, error, hint, required, children, className,
}: { label: string; htmlFor?: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-label font-medium text-forest">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-caption text-danger">{error}</p>
      ) : hint ? (
        <p className="text-caption text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}
