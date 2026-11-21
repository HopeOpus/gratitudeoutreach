import type { Metadata } from "next";
import { JoinFlow } from "@/components/join/join-flow";

export const metadata: Metadata = { title: "Join a station" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ ended?: string }> }) {
  const { ended } = await searchParams;
  return <JoinFlow ended={ended} />;
}
