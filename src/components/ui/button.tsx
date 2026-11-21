import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium text-label transition-colors duration-150 select-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-leaf text-white hover:bg-leaf-600 active:bg-leaf-700",
        secondary: "bg-white text-leaf-700 border border-neutral-100 hover:bg-neutral-25 active:bg-neutral-50",
        ghost: "bg-transparent text-forest hover:bg-neutral-50",
        destructive: "bg-danger text-white hover:opacity-90",
        dark: "bg-fresh text-forest hover:bg-fresh-400",
        outlineDark: "bg-transparent text-white border border-forest-500 hover:bg-forest-950",
      },
      size: {
        sm: "h-10 px-3",
        md: "h-12 px-4 text-body",
        lg: "h-14 px-5 text-body-lg",
        icon: "h-12 w-12",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild, loading, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp ref={ref} className={cn(buttonVariants({ variant, size, block }), className)} disabled={disabled || loading} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
});
