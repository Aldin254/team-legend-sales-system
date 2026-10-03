import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    // ==================================================
    // REQUEST
    // ==================================================

    const body = await request.json();

    const username = String(
      body?.username || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      body?.password || ""
    );

    if (!username || !password) {
      return NextResponse.json(
        {
          message:
            "Username and password are required.",
        },
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // USERNAME VALIDATION
    // ==================================================

    const usernamePattern =
      /^[a-z0-9._-]+$/;

    if (!usernamePattern.test(username)) {
      return NextResponse.json(
        {
          message:
            "Invalid username.",
        },
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // ENVIRONMENT
    // ==================================================

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      return NextResponse.json(
        {
          message:
            "Server configuration is incomplete.",
        },
        {
          status: 500,
        }
      );
    }

    // ==================================================
    // LOGIN EMAIL
    // ==================================================

    const loginEmail =
      `${username}@teamlegend.local`;

    // ==================================================
    // SUPABASE PASSWORD LOGIN
    // ==================================================

    const authResponse =
      await fetch(
        `${supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: "POST",

          headers: {
            apikey:
              supabaseAnonKey,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email:
              loginEmail,

            password,
          }),

          cache: "no-store",
        }
      );

    let authData = null;

    try {
      authData =
        await authResponse.json();
    } catch {
      authData = null;
    }

    if (
      !authResponse.ok ||
      !authData?.access_token ||
      !authData?.user?.id
    ) {
      return NextResponse.json(
        {
          message:
            "Invalid username or password.",
        },
        {
          status: 401,
        }
      );
    }

    const accessToken =
      authData.access_token;

    const refreshToken =
      authData.refresh_token ||
      null;

    const authUserId =
      authData.user.id;

    const expiresInRaw =
      Number(
        authData?.expires_in
      );

    const expiresIn =
      Number.isFinite(
        expiresInRaw
      ) &&
      expiresInRaw > 0
        ? expiresInRaw
        : null;

    const directExpiresAt =
      Number(
        authData?.expires_at
      );

    const expiresAt =
      Number.isFinite(
        directExpiresAt
      ) &&
      directExpiresAt > 0
        ? Math.floor(
            directExpiresAt
          )
        : expiresIn
        ? Math.floor(
            Date.now() / 1000
          ) + expiresIn
        : null;

    // ==================================================
    // LOAD PROFILE
    // ==================================================

    const profileResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/profiles` +
          `?auth_user_id=eq.${encodeURIComponent(
            authUserId
          )}` +
          `&select=` +
          `id,auth_user_id,username,full_name,role,shop_id,is_active` +
          `&limit=1`,
        {
          method: "GET",

          headers: {
            apikey:
              supabaseAnonKey,

            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",
          },

          cache: "no-store",
        }
      );

    let profileResult = null;

    try {
      profileResult =
        await profileResponse.json();
    } catch {
      profileResult = null;
    }

    if (!profileResponse.ok) {
      console.error(
        "LOGIN PROFILE ERROR:",
        profileResult
      );

      return NextResponse.json(
        {
          message:
            "Unable to load account profile.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !Array.isArray(
        profileResult
      ) ||
      profileResult.length === 0
    ) {
      return NextResponse.json(
        {
          message:
            "Account profile was not found.",
        },
        {
          status: 403,
        }
      );
    }

    const profile =
      profileResult[0];

    // ==================================================
    // ACCOUNT ACTIVE
    // ==================================================

    if (!profile.is_active) {
      return NextResponse.json(
        {
          message:
            "This account has been disabled. Contact Admin.",
        },
        {
          status: 403,
        }
      );
    }

    // ==================================================
    // USERNAME MATCH
    // ==================================================

    const profileUsername =
      String(
        profile.username || ""
      )
        .trim()
        .toLowerCase();

    if (
      !profileUsername ||
      profileUsername !== username
    ) {
      return NextResponse.json(
        {
          message:
            "Username does not match this account.",
        },
        {
          status: 403,
        }
      );
    }

    // ==================================================
    // ROLE
    // ==================================================

    const role =
      String(
        profile.role || ""
      )
        .trim()
        .toUpperCase();

    if (
      role !== "ADMIN" &&
      role !== "CASHIER" &&
      role !== "ACCOUNTANT"
    ) {
      return NextResponse.json(
        {
          message:
            "This account does not have a valid system role.",
        },
        {
          status: 403,
        }
      );
    }

    // ==================================================
    // CASHIER MUST HAVE SHOP
    //
    // ACCOUNTANT DOES NOT REQUIRE A SHOP.
    // ==================================================

    if (
      role === "CASHIER" &&
      !profile.shop_id
    ) {
      return NextResponse.json(
        {
          message:
            "Cashier account has no assigned shop.",
        },
        {
          status: 403,
        }
      );
    }

    // ==================================================
    // LOAD SHOP
    // ==================================================

    let shop = null;

    if (profile.shop_id) {
      const shopResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shops` +
            `?id=eq.${encodeURIComponent(
              profile.shop_id
            )}` +
            `&select=id,shop_name,shop_type,is_active,timezone` +
            `&limit=1`,
          {
            method: "GET",

            headers: {
              apikey:
                supabaseAnonKey,

              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            cache: "no-store",
          }
        );

      let shopResult = null;

      try {
        shopResult =
          await shopResponse.json();
      } catch {
        shopResult = null;
      }

      if (!shopResponse.ok) {
        console.error(
          "LOGIN SHOP ERROR:",
          shopResult
        );

        return NextResponse.json(
          {
            message:
              "Unable to load assigned shop.",
          },
          {
            status: 500,
          }
        );
      }

      if (
        !Array.isArray(
          shopResult
        ) ||
        shopResult.length === 0
      ) {
        return NextResponse.json(
          {
            message:
              "Assigned shop was not found.",
          },
          {
            status: 403,
          }
        );
      }

      shop =
        shopResult[0];

      if (!shop.is_active) {
        return NextResponse.json(
          {
            message:
              "Assigned shop is currently inactive.",
          },
          {
            status: 403,
          }
        );
      }
    }

    // ==================================================
    // USER DATA
    //
    // refresh_token + expires_at are saved so the
    // dashboard can renew the JWT automatically.
    // ==================================================

    const userData = {
      id:
        authUserId,

      auth_user_id:
        authUserId,

      profile_id:
        profile.id,

      username:
        profile.username,

      name:
        profile.full_name,

      full_name:
        profile.full_name,

      role,

      shop_id:
        profile.shop_id,

      shop:
        shop?.shop_name ||
        null,

      shop_name:
        shop?.shop_name ||
        null,

      shop_type:
        shop?.shop_type ||
        null,

      timezone:
        shop?.timezone ||
        "Africa/Nairobi",

      access_token:
        accessToken,

      refresh_token:
        refreshToken,

      expires_in:
        expiresIn,

      expires_at:
        expiresAt,

      token_type:
        authData?.token_type ||
        "bearer",
    };

    // ==================================================
    // SUCCESS
    // ==================================================

    return NextResponse.json(
      {
        success:
          true,

        user:
          userData,

        ...userData,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "LOGIN ROUTE ERROR:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Unable to log in. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}
