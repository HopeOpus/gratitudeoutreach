import { Suspense } from "react";
import type { Metadata } from "next";
import VolunteerApp from "@/components/station/app";

// One client shell for every /s/* path: views switch with history.pushState,
// so after the shell is cached the volunteer app never needs the network to navigate.
export const metadata: Metadata = { title: "Station" };
export function generateStaticParams() {
  return [{ path: [] }];
}

export default function StationPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-forest" />}>
      <VolunteerApp />
    </Suspense>
  );
}
