import { NextResponse } from "next/server";
import { requireUser, handleRouteError } from "@/lib/api-helpers";
import { isAllowed } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who is signed in and whether they may generate. */
export async function GET() {
  try {
    const { user, error } = await requireUser();
    if (error || !user) return error;
    return NextResponse.json({ email: user.email ?? null, allowed: isAllowed(user.email) });
  } catch (e) {
    return handleRouteError(e);
  }
}
