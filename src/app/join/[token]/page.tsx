import type { Metadata } from "next";
import { JoinFlow } from "@/components/join/join-flow";

export const metadata: Metadata = { title: "Join a station" };

export default async function JoinTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <JoinFlow token={token} />;
}
