import { NextResponse } from "next/server";

// ==================================================
// CONSTANTS
// ==================================================

const VALID_SHOP_TYPES = new Set([
  "12_HOUR",
  "24_HOUR",
]);

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// ==================================================
// CONFIG
// ==================================================

function getConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceKey
  ) {
    throw new ApiError(
      "Server configuration is incomplete.",
      500
    );
  }

  return {
    supabaseUrl,
    anonKey,
    serviceKey,
  };
}

// ==================================================
// HELPERS
// ==================================================

function response(data, status = 200) {
  return NextResponse.json(data, {
    status,
  });
}

async function safeJson(res) {
  const text = await res.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: text,
    };
  }
}

function errorMessage(
  data,
  fallback
) {
  return (
    data?.message ||
    data?.msg ||
    data?.error_description ||
    data?.error ||
    data?.details ||
    fallback
  );
}

function serviceHeaders(
  config,
  extra = {}
) {
  return {
    apikey:
      config.serviceKey,

    "Content-Type":
      "application/json",

    ...extra,
  };
}

function normalizeShopName(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeShopType(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}

// ==================================================
// ADMIN VERIFICATION
// ==================================================

async function requireAdmin(
  request
) {
  const config =
    getConfig();

  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    throw new ApiError(
      "Authentication required.",
      401
    );
  }

  // Verify current login token.
  const userResponse =
    await fetch(
      `${config.supabaseUrl}/auth/v1/user`,
      {
        method: "GET",

        headers: {
          apikey:
            config.anonKey,

          Authorization:
            authorization,
        },

        cache:
          "no-store",
      }
    );

  const authUser =
    await safeJson(
      userResponse
    );

  if (
    !userResponse.ok ||
    !authUser?.id
  ) {
    throw new ApiError(
      "Your login session is invalid or expired.",
      401
    );
  }

  // Verify that this logged-in user is an active Admin.
  const profileResponse =
    await fetch(
      `${config.supabaseUrl}/rest/v1/profiles` +
        `?auth_user_id=eq.${encodeURIComponent(
          authUser.id
        )}` +
        `&select=id,auth_user_id,username,full_name,role,shop_id,is_active` +
        `&limit=1`,
      {
        method: "GET",

        headers:
          serviceHeaders(
            config
          ),

        cache:
          "no-store",
      }
    );

  const profiles =
    await safeJson(
      profileResponse
    );

  if (
    !profileResponse.ok ||
    !Array.isArray(
      profiles
    ) ||
    profiles.length === 0
  ) {
    throw new ApiError(
      "Admin profile could not be verified.",
      403
    );
  }

  const adminProfile =
    profiles[0];

  if (
    !adminProfile.is_active ||
    String(
      adminProfile.role ||
        ""
    ).toUpperCase() !==
      "ADMIN"
  ) {
    throw new ApiError(
      "Only Admin can manage shops.",
      403
    );
  }

  return {
    config,
    authUser,
    adminProfile,
  };
}

// ==================================================
// GET SHOP
// ==================================================

async function getShopById(
  config,
  shopId
) {
  const res =
    await fetch(
      `${config.supabaseUrl}/rest/v1/shops` +
        `?id=eq.${encodeURIComponent(
          shopId
        )}` +
        `&select=id,shop_name,shop_type,is_active,timezone,created_at,updated_at` +
        `&limit=1`,
      {
        method: "GET",

        headers:
          serviceHeaders(
            config
          ),

        cache:
          "no-store",
      }
    );

  const data =
    await safeJson(res);

  if (!res.ok) {
    throw new ApiError(
      errorMessage(
        data,
        "Unable to load shop."
      ),
      500
    );
  }

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    throw new ApiError(
      "Shop was not found.",
      404
    );
  }

  return data[0];
}

// ==================================================
// UNIQUE SHOP NAME
// ==================================================

async function ensureShopNameAvailable(
  config,
  shopName,
  exceptShopId = null
) {
  const res =
    await fetch(
      `${config.supabaseUrl}/rest/v1/shops` +
        `?select=id,shop_name`,
      {
        method: "GET",

        headers:
          serviceHeaders(
            config
          ),

        cache:
          "no-store",
      }
    );

  const shops =
    await safeJson(res);

  if (!res.ok) {
    throw new ApiError(
      "Unable to verify shop name.",
      500
    );
  }

  const wanted =
    shopName.toLowerCase();

  const duplicate =
    Array.isArray(shops)
      ? shops.find(
          (shop) =>
            String(
              shop.id
            ) !==
              String(
                exceptShopId ||
                  ""
              ) &&
            String(
              shop.shop_name ||
                ""
            )
              .trim()
              .toLowerCase() ===
              wanted
        )
      : null;

  if (duplicate) {
    throw new ApiError(
      "A shop with that name already exists.",
      409
    );
  }
}

// ==================================================
// AUDIT
// ==================================================

async function writeAudit(
  config,
  adminProfile,
  {
    action,
    recordId,
    oldData = null,
    newData = null,
  }
) {
  try {
    await fetch(
      `${config.supabaseUrl}/rest/v1/audit_log`,
      {
        method: "POST",

        headers:
          serviceHeaders(
            config,
            {
              Prefer:
                "return=minimal",
            }
          ),

        body:
          JSON.stringify({
            user_id:
              adminProfile.id,

            shop_id:
              recordId,

            action,

            table_name:
              "shops",

            record_id:
              recordId,

            old_data:
              oldData,

            new_data:
              newData,
          }),
      }
    );
  } catch (error) {
    console.error(
      "SHOP AUDIT ERROR:",
      error
    );
  }
}

// ==================================================
// GET
// ==================================================

export async function GET(
  request
) {
  try {
    const {
      config,
    } =
      await requireAdmin(
        request
      );

    const shopsResponse =
      await fetch(
        `${config.supabaseUrl}/rest/v1/shops` +
          `?select=id,shop_name,shop_type,is_active,timezone,created_at,updated_at` +
          `&order=shop_name.asc`,
        {
          method: "GET",

          headers:
            serviceHeaders(
              config
            ),

          cache:
            "no-store",
        }
      );

    const shops =
      await safeJson(
        shopsResponse
      );

    if (!shopsResponse.ok) {
      throw new ApiError(
        errorMessage(
          shops,
          "Unable to load shops."
        ),
        500
      );
    }

    return response({
      success: true,

      shops:
        Array.isArray(shops)
          ? shops
          : [],
    });
  } catch (error) {
    console.error(
      "ADMIN SHOPS GET ERROR:",
      error
    );

    return response(
      {
        success: false,

        message:
          error?.message ||
          "Unable to load shops.",
      },
      error?.status || 500
    );
  }
}

// ==================================================
// POST
// CREATE SHOP
// ==================================================

export async function POST(
  request
) {
  try {
    const {
      config,
      adminProfile,
    } =
      await requireAdmin(
        request
      );

    const body =
      await request.json();

    const shopName =
      normalizeShopName(
        body?.shop_name
      );

    const shopType =
      normalizeShopType(
        body?.shop_type
      );

    if (!shopName) {
      throw new ApiError(
        "Shop name is required.",
        400
      );
    }

    if (
      shopName.length >
      100
    ) {
      throw new ApiError(
        "Shop name is too long.",
        400
      );
    }

    if (
      !VALID_SHOP_TYPES.has(
        shopType
      )
    ) {
      throw new ApiError(
        "Shop type must be 12_HOUR or 24_HOUR.",
        400
      );
    }

    await ensureShopNameAvailable(
      config,
      shopName
    );

    const createResponse =
      await fetch(
        `${config.supabaseUrl}/rest/v1/shops`,
        {
          method: "POST",

          headers:
            serviceHeaders(
              config,
              {
                Prefer:
                  "return=representation",
              }
            ),

          body:
            JSON.stringify({
              shop_name:
                shopName,

              shop_type:
                shopType,

              is_active:
                true,

              timezone:
                "Africa/Nairobi",
            }),
        }
      );

    const created =
      await safeJson(
        createResponse
      );

    if (
      !createResponse.ok ||
      !Array.isArray(
        created
      ) ||
      created.length === 0
    ) {
      throw new ApiError(
        errorMessage(
          created,
          "Unable to create shop."
        ),
        500
      );
    }

    const shop =
      created[0];

    await writeAudit(
      config,
      adminProfile,
      {
        action:
          "ADMIN_SHOP_CREATED",

        recordId:
          shop.id,

        newData: {
          id:
            shop.id,

          shop_name:
            shop.shop_name,

          shop_type:
            shop.shop_type,

          is_active:
            shop.is_active,

          timezone:
            shop.timezone,
        },
      }
    );

    return response(
      {
        success: true,

        message:
          "Shop created successfully.",

        shop,
      },
      201
    );
  } catch (error) {
    console.error(
      "ADMIN SHOP CREATE ERROR:",
      error
    );

    return response(
      {
        success: false,

        message:
          error?.message ||
          "Unable to create shop.",
      },
      error?.status || 500
    );
  }
}

// ==================================================
// PATCH
// RENAME / TYPE / ACTIVE STATUS
// ==================================================

export async function PATCH(
  request
) {
  try {
    const {
      config,
      adminProfile,
    } =
      await requireAdmin(
        request
      );

    const body =
      await request.json();

    const shopId =
      String(
        body?.shop_id || ""
      ).trim();

    if (!shopId) {
      throw new ApiError(
        "Shop ID is required.",
        400
      );
    }

    const oldShop =
      await getShopById(
        config,
        shopId
      );

    const shopName =
      body?.shop_name !==
      undefined
        ? normalizeShopName(
            body.shop_name
          )
        : oldShop.shop_name;

    const shopType =
      body?.shop_type !==
      undefined
        ? normalizeShopType(
            body.shop_type
          )
        : oldShop.shop_type;

    const isActive =
      body?.is_active !==
      undefined
        ? Boolean(
            body.is_active
          )
        : Boolean(
            oldShop.is_active
          );

    if (!shopName) {
      throw new ApiError(
        "Shop name is required.",
        400
      );
    }

    if (
      !VALID_SHOP_TYPES.has(
        shopType
      )
    ) {
      throw new ApiError(
        "Shop type must be 12_HOUR or 24_HOUR.",
        400
      );
    }

    await ensureShopNameAvailable(
      config,
      shopName,
      oldShop.id
    );

    const updateResponse =
      await fetch(
        `${config.supabaseUrl}/rest/v1/shops` +
          `?id=eq.${encodeURIComponent(
            oldShop.id
          )}`,
        {
          method: "PATCH",

          headers:
            serviceHeaders(
              config,
              {
                Prefer:
                  "return=representation",
              }
            ),

          body:
            JSON.stringify({
              shop_name:
                shopName,

              shop_type:
                shopType,

              is_active:
                isActive,

              timezone:
                oldShop.timezone ||
                "Africa/Nairobi",

              updated_at:
                new Date()
                  .toISOString(),
            }),
        }
      );

    const updated =
      await safeJson(
        updateResponse
      );

    if (
      !updateResponse.ok ||
      !Array.isArray(
        updated
      ) ||
      updated.length === 0
    ) {
      throw new ApiError(
        errorMessage(
          updated,
          "Unable to update shop."
        ),
        500
      );
    }

    const shop =
      updated[0];

    await writeAudit(
      config,
      adminProfile,
      {
        action:
          "ADMIN_SHOP_UPDATED",

        recordId:
          oldShop.id,

        oldData: {
          shop_name:
            oldShop.shop_name,

          shop_type:
            oldShop.shop_type,

          is_active:
            oldShop.is_active,

          timezone:
            oldShop.timezone,
        },

        newData: {
          shop_name:
            shop.shop_name,

          shop_type:
            shop.shop_type,

          is_active:
            shop.is_active,

          timezone:
            shop.timezone,
        },
      }
    );

    return response({
      success: true,

      message:
        "Shop updated successfully.",

      shop,
    });
  } catch (error) {
    console.error(
      "ADMIN SHOP UPDATE ERROR:",
      error
    );

    return response(
      {
        success: false,

        message:
          error?.message ||
          "Unable to update shop.",
      },
      error?.status || 500
    );
  }
}
