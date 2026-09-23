import { NextResponse } from "next/server";
import { computeEventLeaderboard, computeGlobalLeaderboard } from "@/lib/scoring";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");

  const data = eventId ? await computeEventLeaderboard(eventId) : await computeGlobalLeaderboard();

  return NextResponse.json(data);
}
