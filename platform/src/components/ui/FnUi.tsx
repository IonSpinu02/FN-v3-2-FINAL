import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Panel({
  children,
  className = "",
  muted,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`fn-bento ${muted ? "fn-panel-muted" : "fn-panel"} ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className="fn-label">{children}</h3>
      {action}
    </div>
  );
}

export function Btn({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const v =
    variant === "primary"
      ? "fn-btn fn-btn-primary"
      : variant === "ghost"
        ? "fn-btn fn-btn-ghost"
        : "fn-btn fn-btn-secondary";
  return <button type="button" className={`${v} ${className}`} {...props} />;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="fn-segment" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          data-active={value === o.value}
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="fn-kpi">
      <p className="fn-label">{label}</p>
      <p className="fn-kpi-value">{value}</p>
    </div>
  );
}

export function StatusDot({ active }: { active?: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        active
          ? "bg-fn-accent animate-pulse shadow-[0_0_8px_var(--fn-glow)]"
          : "bg-fn-border"
      }`}
      aria-hidden
    />
  );
}
