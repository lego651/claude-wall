import { createClient } from "@/libs/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import config from "@/config";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? config.auth.callbackUrl;

  if (code) {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    
    // Automatically create profile if it doesn't exist
    if (session?.user && !sessionError) {
      try {
        // Use service role client to bypass RLS for initial profile creation
        // This is safe because we're only creating a profile for the authenticated user
        const serviceClient = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: { persistSession: false }
          }
        );

        // Check if profile exists
        const { data: existingProfile } = await serviceClient
          .from("profiles")
          .select("id")
          .eq("id", session.user.id)
          .maybeSingle();

        // If profile doesn't exist, create it
        if (!existingProfile) {
          const { data: newProfile, error: insertError } = await serviceClient
            .from("profiles")
            .upsert({
              id: session.user.id,
              email: session.user.email,
            }, {
              onConflict: "id",
            })
            .select()
            .single();

          if (insertError) {
            console.error("Error creating profile in callback:", {
              error: insertError,
              message: insertError.message,
              code: insertError.code,
              details: insertError.details,
              hint: insertError.hint,
              userId: session.user.id,
            });
          } else {
            console.log("✅ Profile created successfully for user:", session.user.id);
          }
        } else {
          console.log("Profile already exists for user:", session.user.id);
        }
      } catch (error) {
        console.error("Unexpected error in profile creation:", error);
      }
    } else {
      console.error("Session error or no user:", { sessionError, hasUser: !!session?.user });
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL(next, request.url));
}
