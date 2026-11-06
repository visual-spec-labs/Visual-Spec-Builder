import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "secondary" | "primary" | "ghost";
type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  secondary: "border border-line text-content hover:bg-hover",
  primary: "bg-primary text-text-on-accent hover:opacity-90",
  ghost: "text-content-muted hover:bg-hover hover:text-content",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

/** Shared app button for consistent sizing, focus, and disabled states. */
export function Button({
  variant = "secondary",
  size = "sm",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      {...props}
      type={type}
      className={`rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-content disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
    />
  );
}
