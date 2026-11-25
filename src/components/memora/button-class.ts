// Plain module (no "use client"): server components style links as buttons too.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink hover:bg-accent-strong shadow-[0_8px_24px_-12px_rgba(62,224,191,0.7)] disabled:bg-surface-4 disabled:text-faint disabled:shadow-none",
  secondary:
    "border border-line-strong bg-surface-3/60 text-text-2 hover:border-accent/60 hover:text-text disabled:opacity-50",
  ghost: "text-text-2 hover:bg-surface-3 hover:text-text disabled:opacity-50",
  danger:
    "border border-danger/30 bg-danger-soft text-[#ffb4aa] hover:border-danger/70 hover:text-white disabled:opacity-50",
  soft: "bg-accent-soft text-accent hover:bg-accent/20 disabled:opacity-50",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-10 gap-1.5 rounded-lg px-3 text-sm",
  md: "h-11 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-5 text-[15px]",
  icon: "size-10 rounded-xl",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className = "",
) {
  return `inline-flex shrink-0 items-center justify-center font-semibold transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`;
}
