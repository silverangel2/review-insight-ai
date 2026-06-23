import { NextResponse } from "next/server";
import { getRuntimeAppSettings } from "@/lib/appSettings";
import { rateLimitRequest } from "@/lib/security";
import { signUpWithSupabase } from "@/lib/supabaseAuth";
import { supabaseFetch, supabaseUpsert } from "@/lib/supabaseServer";

type SignupResult = {
  access_token?: string;
  user?: {
    id?: string;
    email_confirmed_at?: string | null;
  };
  mode?: string;
  message?: string;
};

async function authUserStatusForEmail(email: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { exists: false, emailConfirmed: false };
  }

  const targetEmail = email.toLowerCase().trim();

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users?page=${page}&per_page=1000`, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Supabase auth duplicate check failed:", await response.text().catch(() => ""));
      return { exists: false, emailConfirmed: false };
    }

    const data = await response.json().catch(() => null);
    const users = Array.isArray(data?.users) ? data.users : [];

    const existing = users.find((user: { email?: string }) => String(user.email || "").toLowerCase().trim() === targetEmail) as
      | { email_confirmed_at?: string | null; confirmed_at?: string | null }
      | undefined;

    if (existing) {
      return {
        exists: true,
        emailConfirmed: Boolean(existing.email_confirmed_at || existing.confirmed_at)
      };
    }

    if (users.length < 1000) {
      return { exists: false, emailConfirmed: false };
    }
  }

  return { exists: false, emailConfirmed: false };
}


export async function POST(request: Request) {
  const limit = await rateLimitRequest(request, {
    key: "auth_signup",
    limit: 6,
    windowMs: 30 * 60 * 1000,
    eventType: "signup_rate_limited"
  });

  if (!limit.allowed) {
    return limit.response ?? NextResponse.json({ error: "Too many signup attempts." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);

  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const password = String(body.password);

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
  }

  if (!/[A-Z]/.test(password)) {
    return NextResponse.json({ error: "Password must include at least one uppercase letter." }, { status: 400 });
  }

  if (!/[a-z]/.test(password)) {
    return NextResponse.json({ error: "Password must include at least one lowercase letter." }, { status: 400 });
  }

  if (!/[0-9]/.test(password)) {
    return NextResponse.json({ error: "Password must include at least one number." }, { status: 400 });
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return NextResponse.json({ error: "Password must include at least one special character." }, { status: 400 });
  }

  const termsAccepted = Boolean(body.termsAccepted);
  const marketingConsent = Boolean(body.marketingConsent);

  if (!termsAccepted) {
    return NextResponse.json(
      { error: "You must accept the Terms of Service and Privacy Policy to create an account." },
      { status: 400 }
    );
  }

  if (body.role !== "buyer" && body.role !== "seller") {
    return NextResponse.json({ error: "Choose Shopper or Seller account type." }, { status: 400 });
  }

  const appSettings = await getRuntimeAppSettings();

  if (appSettings.maintenance_mode) {
    return NextResponse.json({ error: appSettings.announcement_text || "ReviewIntel is temporarily updating. Please check back shortly." }, { status: 503 });
  }

  if (!appSettings.allow_new_signups) {
    return NextResponse.json({ error: "New signups are temporarily closed." }, { status: 503 });
  }

  const email = String(body.email).toLowerCase().trim();

  try {
    const existingProfilesResponse = await supabaseFetch(
      `/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email,email_verified&limit=1`
    ).catch(() => null);
    const existingProfiles = existingProfilesResponse?.ok
      ? await existingProfilesResponse.json().catch(() => [])
      : [];

    const existsInProfiles = Array.isArray(existingProfiles) && existingProfiles.length > 0;
    const firstProfile = Array.isArray(existingProfiles) ? existingProfiles[0] as { email_verified?: boolean } | undefined : undefined;
    const profileVerified = Boolean(firstProfile?.email_verified);
    const authStatus = await authUserStatusForEmail(email);
    const existsInAuth = authStatus.exists;

    if (existsInProfiles || existsInAuth) {
      if (!profileVerified && existsInAuth && !authStatus.emailConfirmed) {
        return NextResponse.json(
          {
            error: "This email is already waiting for verification. Please check your inbox and approve the ReviewIntel verification link before signing in.",
            code: "email_verification_pending",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: "An account with this email already exists. Please log in instead.",
          code: "account_exists",
        },
        { status: 409 }
      );
    }

    const result = await signUpWithSupabase({
      ...body,
      email,
      termsAccepted,
      marketingConsent,
    }) as SignupResult;

    const role = body.role === "seller" ? "seller" : "buyer";
    const plan = "free_buyer";
    const subscriptionStatus = role === "seller" ? "pending_payment" : "free";
    const now = new Date().toISOString();

    await supabaseUpsert("profiles", {
      email,
      name: body.name ? String(body.name).trim() : "",
      auth_user_id: result.user?.id ?? null,
      role,
      plan,
      subscription_status: subscriptionStatus,
      marketing_consent: marketingConsent,
      terms_accepted: termsAccepted,
      email_verified: Boolean(result.user?.email_confirmed_at || result.access_token),
      created_at: now,
      updated_at: now,
      last_login: now,
    }).catch((profileError) => {
      console.error("Signup profile save failed:", profileError);
    });

    const emailConfirmationRequired = Boolean(result.user && !result.access_token);

    return NextResponse.json({
      ok: true,
      result,
      emailConfirmationRequired,
      message: emailConfirmationRequired
        ? "Account created. Please check your email and approve the ReviewIntel verification link before signing in."
        : role === "seller"
          ? "Seller account created. Choose a seller plan to activate seller tools."
          : "Account created."
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Signup failed." }, { status: 400 });
  }
}
