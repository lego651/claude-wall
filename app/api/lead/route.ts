import { sendEmail } from "@/libs/resend";
import { NextResponse, type NextRequest } from "next/server";
import type { LeadRequest } from "@/types";

// This route is used to store the emails submitted from the homepage form (we don't have a database, so we're using Resend to save the data in their dashboard)
// It doesn't require auth, so you can directly call it from your front-end, via a server component
export async function POST(req: NextRequest) {
  const body: LeadRequest = await req.json();

  if (!body.email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }

  // Sanitize email (trim, lowercase)
  const sanitizedEmail = body.email.trim().toLowerCase();

  try {
    await sendEmail({
      to: sanitizedEmail,
      subject: "Thanks for signing up!",
      text: "We'll be in touch soon!",
      html: "<p>We'll be in touch soon!</p>",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: (e as Error)?.message },
      { status: 500 }
    );
  }
}
