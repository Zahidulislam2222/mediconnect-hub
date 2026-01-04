import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
  icon: ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  variant?: "default" | "primary" | "accent";
}

export function ActionButton({
  icon,
  label,
  description,
  onClick,
  variant = "default",
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "action-button text-left w-full",
        variant === "primary" && "bg-primary/5 border-primary/20 hover:bg-primary/10",
        variant === "accent" && "bg-accent/5 border-accent/20 hover:bg-accent/10"
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl",
          variant === "default" && "bg-secondary text-foreground",
          variant === "primary" && "bg-primary/10 text-primary",
          variant === "accent" && "bg-accent/10 text-accent"
        )}
      >
        {icon}
      </div>
      <span className="font-semibold text-foreground">{label}</span>
      {description && (
        <span className="text-xs text-muted-foreground text-center">{description}</span>
      )}
    </button>
  );
}
