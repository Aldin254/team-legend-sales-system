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

    // Convert the username entered on the login page
    // into the email addresses used by Supabase Authentication.
    const cleanUsername = username.trim().toLowerCase();

    const usernameMap = {
      admin: "admin@teamlegend.local",
      mirriams: "mirriams@teamlegend.local",
      shopkings: "shopkings@teamlegend.local",
    };

    const email = usernameMap[cleanUsername];

    if (!email) {
      return NextResponse.json(
        { message: "Invalid username or password." },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 1. LOGIN THROUGH SUPABASE AUTH
    // --------------------------------------------------

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
      return NextResponse.json(
        { message: "Invalid username or password." },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. GET THIS USER'S PROFILE
    // --------------------------------------------------

    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?auth_user_id=eq.${authData.user.id}&select=id,full_name,role,shop_id,is_active`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authData.access_token}`,
        },
        cache: "no-store",
      }
    );

    const profiles = await profileResponse.json();

    if (
      !profileResponse.ok ||
      !Array.isArray(profiles) ||
      profiles.length === 0
    ) {
      return NextResponse.json(
        { message: "User profile was not found." },
        { status: 403 }
      );
    }

    const profile = profiles[0];

    // --------------------------------------------------
    // 3. BLOCK DISABLED USERS
    // --------------------------------------------------

    if (profile.is_active !== true) {
      return NextResponse.json(
        { message: "This account has been disabled." },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 4. RETURN ONLY SAFE USER INFORMATION
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      username: cleanUsername,
      name: profile.full_name,
      role: profile.role,
      shop: profile.shop_id,
    });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      { message: "Unable to sign in. Please try again." },
      { status: 500 }
    );
  }
}
