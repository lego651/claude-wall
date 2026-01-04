import { createCustomerPortal } from "@/libs/stripe";
import { createClient } from "@/libs/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import type { CreatePortalRequest } from "@/types";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// This function is used to create a Stripe Customer Portal session
// It's used to let users manage their subscriptions (payment methods, cancel, etc.)
export async function POST(req: NextRequest) {
  const body: CreatePortalRequest = await req.json();

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile?.customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 400 }
      );
    }

    const portalUrl = await createCustomerPortal({
      customerId: profile.customer_id,
      returnUrl: body.returnUrl || window?.location?.href || "/dashboard",
    });

    if (!portalUrl) {
      return NextResponse.json(
        { error: "Failed to create customer portal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: portalUrl });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: (e as Error)?.message },
      { status: 500 }
    );
  }
}
