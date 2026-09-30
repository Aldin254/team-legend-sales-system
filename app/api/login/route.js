import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: "Username and password are required." },
        { status: 400 }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Supabase environment variables are missing.");

      return NextResponse.json(
        { message: "Server configuration error." },
        { status: 500 }
      );
    }

    // Convert username entered on login page
    // into the email used by Supabase Authentication.
    const cleanUsername = username.trim().toLowerCase();

    const usernameMap = {
      admin: "admin@teamlegend.local",
      mirriams: "mirriams@teamlegend.local",
      shopkings: "shopkings@teamlegend.local",
    };

    // Also allow the actual email address to be entered.
    const email = cleanUsername.includes("@")
      ? cleanUsername
      : usernameMap[cleanUsername];

    if (!email) {
      return NextResponse.json(
        { message: "Invalid username or password." },
        { status: 401 }
      );
    }

    // Authenticate with Supabase.
    const authResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      }
    );

    const authData = await authResponse.json();

    if (!authResponse.ok || !authData.user) {
      console.error("Supabase login failed:", authData);

      return NextResponse.json(
        { message: "Invalid username or password." },
        { status: 401 }
      );
    }

    // Get this user's profile.
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?auth_user_id=eq.${authData.user.id}&select=id,auth_user_id,full_name,role,shop_id,is_active`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authData.access_token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const profiles = await profileResponse.json();

    if (!profileResponse.ok) {
      console.error("Profile lookup failed:", profiles);

      return NextResponse.json(
        { message: "Unable to load user profile." },
        { status: 500 }
      );
    }

    if (!Array.isArray(profiles) || profiles.length === 0) {
      return NextResponse.json(
        { message: "No staff profile is connected to this account." },
        { status: 403 }
      );
    }

    const profile = profiles[0];

    if (!profile.is_active) {
      return NextResponse.json(
        { message: "This staff account is inactive." },
        { status: 403 }
      );
    }

    const role = String(profile.role || "").toUpperCase();

    if (role !== "ADMIN" && role !== "CASHIER") {
      return NextResponse.json(
        { message: "This account does not have permission to sign in." },
        { status: 403 }
      );
    }

    // Cashiers must belong to a shop.
    if (role === "CASHIER" && !profile.shop_id) {
      return NextResponse.json(
        { message: "This cashier has not been assigned to a shop." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: authData.user.id,
          name: profile.full_name,
          role,
          shop: profile.shop_id,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Login API error:", error);

    return NextResponse.json(
      { message: "Something went wrong while signing in." },
      { status: 500 }
    );
  }
}
