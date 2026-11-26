import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonStyles = cva(
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-primary text-ink hover:bg-primary/90",
        ghost: "bg-transparent text-fg hover:bg-raised",
        surface: "bg-raised text-fg hover:bg-white/5",
        line: "bg-transparent text-fg ring-1 ring-line hover:bg-raised",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export function Button({
  className,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>) {
  return <button className={cn(buttonStyles({ variant }), className)} {...props} />;
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-3xl bg-surface p-5 shadow-card sm:p-6", className)}>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-muted">{label}</span>
      <input
        className="h-11 w-full rounded-2xl bg-bg px-3 text-sm text-fg ring-1 ring-line outline-none placeholder:text-faint focus:ring-primary"
        {...props}
      />
      {hint ? <span className="mt-2 block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-muted">{label}</span>
      <select
        className="h-11 w-full rounded-2xl bg-bg px-3 text-sm text-fg ring-1 ring-line outline-none focus:ring-primary"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Mark({ className }: { className?: string }) {
  return (
    <img src="/favicon.svg" alt="" className={cn("size-9 rounded-lg", className)} />
  );
}
