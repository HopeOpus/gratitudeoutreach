"use client";
import { Toaster as Sonner, toast as sonner } from "sonner";
import { CheckCircle2 } from "lucide-react";

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset={88}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "flex w-[min(92vw,420px)] items-center gap-3 rounded-lg bg-forest px-4 py-3 text-white shadow-pop font-sans",
          title: "text-body font-medium",
          description: "text-caption text-forest-100",
          actionButton: "ml-auto h-11 rounded-md px-3 text-label font-medium text-fresh hover:bg-forest-950 cursor-pointer",
          error: "bg-danger",
        },
      }}
    />
  );
}

export const toast = {
  saved(message: string, onUndo?: () => void) {
    sonner(message, {
      icon: <CheckCircle2 className="size-6 text-fresh" aria-hidden />,
      duration: 10000,
      action: onUndo ? { label: "Undo", onClick: onUndo } : undefined,
    });
  },
  info(message: string) {
    sonner(message, { duration: 4000 });
  },
  error(message: string) {
    sonner.error(message, { duration: 6000 });
  },
};
