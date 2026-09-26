import { NextResponse } from "next/server";
import { requireUser, handleRouteError } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who is signed in. */
export async function GET() {
  try {
    const { user, error } = await requireUser();
    if (error || !user) return error;
    return NextResponse.json({ email: user.email ?? null });
  } catch (e) {
    return handleRouteError(e);
  }
}
