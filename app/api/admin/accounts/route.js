import { NextResponse } from "next/server";

// ==================================================
// CONSTANTS
// ==================================================

const USERNAME_PATTERN =
  /^[a-z0-9._-]{3,40}$/;

const VALID_ROLES =
  new Set([
    "ADMIN",
    "CASHIER",
  ]);

// ==================================================
// ERROR CLASS
// ==================================================

class ApiError extends Error {
  constructor(
    message,
    status = 400
  ) {
    super(message);
    this.status = status;
  }
}

// ==================================================
// CONFIG
// ==================================================

function getConfig() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const serviceKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

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
// RESPONSE HELPERS
// ==================================================

function response(
  data,
  status = 200
) {
  return NextResponse.json(
    data,
    {
      status,
    }
  );
}

async function safeJson(
  res
) {
  const text =
    await res.text();

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

// ==================================================
// SECRET SERVER HEADERS
// ==================================================

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

// ==================================================
// NORMALIZE
// ==================================================

function normalizeUsername(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function normalizeName(
  value
) {
  return String(
    value || ""
  ).trim();
}

function normalizeRole(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}

// ==================================================
// VERIFY CALLER
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

  // ----------------------------------------------
  // Verify the user's Supabase access token
  // ----------------------------------------------

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

  // ----------------------------------------------
  // Load caller's profile using server secret
  // ----------------------------------------------

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
  !Array.isArray(profiles) ||
  profiles.length === 0
) {
  console.error(
    "ADMIN PROFILE VERIFY FAILED:",
    {
      status: profileResponse.status,
      profiles,
      auth_user_id: authUser.id,
    }
  );

  throw new ApiError(
    `Admin profile could not be verified. Status: ${profileResponse.status}`,
    403
  );
}

  const adminProfile =
    profiles[0];

  if (
    !adminProfile.is_active ||
    normalizeRole(
      adminProfile.role
    ) !== "ADMIN"
  ) {
    throw new ApiError(
      "Only Admin can manage user accounts.",
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
// GET PROFILE
// ==================================================

async function getProfileById(
  config,
  profileId
) {
  const res =
    await fetch(
      `${config.supabaseUrl}/rest/v1/profiles` +
        `?id=eq.${encodeURIComponent(
          profileId
        )}` +
        `&select=id,auth_user_id,username,full_name,role,shop_id,is_active,created_at,updated_at` +
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
        "Unable to load account."
      ),
      500
    );
  }

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    throw new ApiError(
      "Account was not found.",
      404
    );
  }

  return data[0];
}

// ==================================================
// CHECK USERNAME
// ==================================================

async function ensureUsernameAvailable(
  config,
  username,
  exceptProfileId = null
) {
  const res =
    await fetch(
      `${config.supabaseUrl}/rest/v1/profiles` +
        `?username=eq.${encodeURIComponent(
          username
        )}` +
        `&select=id,username`,
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

  const rows =
    await safeJson(res);

  if (!res.ok) {
    throw new ApiError(
      "Unable to verify username.",
      500
    );
  }

  const conflict =
    Array.isArray(rows)
      ? rows.find(
          (row) =>
            !exceptProfileId ||
            String(row.id) !==
              String(
                exceptProfileId
              )
        )
      : null;

  if (conflict) {
    throw new ApiError(
      "That username is already in use.",
      409
    );
  }
}

// ==================================================
// CHECK SHOP
// ==================================================

async function ensureShop(
  config,
  shopId
) {
  if (!shopId) {
    throw new ApiError(
      "Cashier must be assigned to a shop.",
      400
    );
  }

  const res =
    await fetch(
      `${config.supabaseUrl}/rest/v1/shops` +
        `?id=eq.${encodeURIComponent(
          shopId
        )}` +
        `&select=id,shop_name,shop_type,is_active` +
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

  const rows =
    await safeJson(res);

  if (
    !res.ok ||
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    throw new ApiError(
      "Selected shop was not found.",
      400
    );
  }

  if (!rows[0].is_active) {
    throw new ApiError(
      "Selected shop is inactive.",
      400
    );
  }

  return rows[0];
}

// ==================================================
// ACTIVE ADMIN COUNT
// ==================================================

async function getActiveAdminCount(
  config
) {
  const res =
    await fetch(
      `${config.supabaseUrl}/rest/v1/profiles` +
        `?role=eq.ADMIN` +
        `&is_active=eq.true` +
        `&auth_user_id=not.is.null` +
        `&select=id`,
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

  const rows =
    await safeJson(res);

  if (!res.ok) {
    throw new ApiError(
      "Unable to verify Admin accounts.",
      500
    );
  }

  return Array.isArray(rows)
    ? rows.length
    : 0;
}

// ==================================================
// AUDIT LOG — BEST EFFORT
// ==================================================

async function writeAudit(
  config,
  adminProfile,
  {
    action,
    recordId,
    shopId = null,
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

        body: JSON.stringify({
          user_id:
            adminProfile.id,

          shop_id:
            shopId,

          action,

          table_name:
            "profiles",

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
      "ACCOUNT AUDIT ERROR:",
      error
    );
  }
}

// ==================================================
// AUTH ADMIN CREATE
// ==================================================

async function createAuthUser(
  config,
  {
    username,
    password,
    fullName,
    role,
  }
) {
  const res =
    await fetch(
      `${config.supabaseUrl}/auth/v1/admin/users`,
      {
        method: "POST",

        headers:
          serviceHeaders(
            config
          ),

        body: JSON.stringify({
          email:
            `${username}@teamlegend.local`,

          password,

          email_confirm:
            true,

          user_metadata: {
            username,
            full_name:
              fullName,
          },

          app_metadata: {
            team_legend_role:
              role,
          },
        }),
      }
    );

  const data =
    await safeJson(res);

  if (!res.ok) {
    throw new ApiError(
      errorMessage(
        data,
        "Unable to create login account."
      ),
      400
    );
  }

  const id =
    data?.id ||
    data?.user?.id;

  if (!id) {
    throw new ApiError(
      "Supabase created the account but returned no user ID.",
      500
    );
  }

  return {
    id,
    raw: data,
  };
}

// ==================================================
// AUTH ADMIN UPDATE
// ==================================================

async function updateAuthUser(
  config,
  authUserId,
  updates
) {
  const res =
    await fetch(
      `${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(
        authUserId
      )}`,
      {
        method: "PUT",

        headers:
          serviceHeaders(
            config
          ),

        body:
          JSON.stringify(
            updates
          ),
      }
    );

  const data =
    await safeJson(res);

  if (!res.ok) {
    throw new ApiError(
      errorMessage(
        data,
        "Unable to update login account."
      ),
      400
    );
  }

  return data;
}

// ==================================================
// AUTH ADMIN DELETE
// ==================================================

async function deleteAuthUser(
  config,
  authUserId
) {
  const res =
    await fetch(
      `${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(
        authUserId
      )}`,
      {
        method: "DELETE",

        headers:
          serviceHeaders(
            config
          ),
      }
    );

  const data =
    await safeJson(res);

  if (!res.ok) {
    throw new ApiError(
      errorMessage(
        data,
        "Unable to remove login account."
      ),
      400
    );
  }

  return data;
}

// ==================================================
// GET
// LIST ACTIVE LOGIN ACCOUNTS + SHOPS
// ==================================================

export async function GET(
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

    const [
      accountsResponse,
      shopsResponse,
    ] =
      await Promise.all([
        fetch(
          `${config.supabaseUrl}/rest/v1/profiles` +
            `?auth_user_id=not.is.null` +
            `&select=id,auth_user_id,username,full_name,role,shop_id,is_active,created_at,updated_at` +
            `&order=created_at.asc`,
          {
            headers:
              serviceHeaders(
                config
              ),

            cache:
              "no-store",
          }
        ),

        fetch(
          `${config.supabaseUrl}/rest/v1/shops` +
            `?select=id,shop_name,shop_type,is_active` +
            `&order=shop_name.asc`,
          {
            headers:
              serviceHeaders(
                config
              ),

            cache:
              "no-store",
          }
        ),
      ]);

    const accounts =
      await safeJson(
        accountsResponse
      );

    const shops =
      await safeJson(
        shopsResponse
      );

    if (!accountsResponse.ok) {
      throw new ApiError(
        errorMessage(
          accounts,
          "Unable to load accounts."
        ),
        500
      );
    }

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

      current_admin_profile_id:
        adminProfile.id,

      accounts:
        Array.isArray(
          accounts
        )
          ? accounts
          : [],

      shops:
        Array.isArray(shops)
          ? shops
          : [],
    });
  } catch (error) {
    console.error(
      "ADMIN ACCOUNTS GET ERROR:",
      error
    );

    return response(
      {
        success: false,

        message:
          error?.message ||
          "Unable to load accounts.",
      },
      error?.status || 500
    );
  }
}

// ==================================================
// POST
// CREATE ACCOUNT
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

    const username =
      normalizeUsername(
        body?.username
      );

    const fullName =
      normalizeName(
        body?.full_name
      );

    const role =
      normalizeRole(
        body?.role
      );

    const password =
      String(
        body?.password || ""
      );

    let shopId =
      body?.shop_id || null;

    // ----------------------------------------------
    // Validation
    // ----------------------------------------------

    if (
      !USERNAME_PATTERN.test(
        username
      )
    ) {
      throw new ApiError(
        "Username must be 3-40 characters using letters, numbers, dot, underscore or hyphen.",
        400
      );
    }

    if (!fullName) {
      throw new ApiError(
        "Full name is required.",
        400
      );
    }

    if (
      !VALID_ROLES.has(role)
    ) {
      throw new ApiError(
        "Role must be ADMIN or CASHIER.",
        400
      );
    }

    if (
      password.length < 8
    ) {
      throw new ApiError(
        "Password must contain at least 8 characters.",
        400
      );
    }

    if (role === "ADMIN") {
      shopId = null;
    } else {
      await ensureShop(
        config,
        shopId
      );
    }

    await ensureUsernameAvailable(
      config,
      username
    );

    // ----------------------------------------------
    // Create Supabase Auth user
    // ----------------------------------------------

    const authUser =
      await createAuthUser(
        config,
        {
          username,
          password,
          fullName,
          role,
        }
      );

    // ----------------------------------------------
    // Create profile
    // ----------------------------------------------

    const profileResponse =
      await fetch(
        `${config.supabaseUrl}/rest/v1/profiles`,
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

          body: JSON.stringify({
            auth_user_id:
              authUser.id,

            username,

            full_name:
              fullName,

            role,

            shop_id:
              shopId,

            is_active:
              true,
          }),
        }
      );

    const createdProfiles =
      await safeJson(
        profileResponse
      );

    if (
      !profileResponse.ok ||
      !Array.isArray(
        createdProfiles
      ) ||
      createdProfiles.length ===
        0
    ) {
      // Roll back Auth user if profile creation fails.
      try {
        await deleteAuthUser(
          config,
          authUser.id
        );
      } catch {
        // Nothing else to do.
      }

      throw new ApiError(
        errorMessage(
          createdProfiles,
          "Unable to create account profile."
        ),
        500
      );
    }

    const createdProfile =
      createdProfiles[0];

    await writeAudit(
      config,
      adminProfile,
      {
        action:
          "ADMIN_ACCOUNT_CREATED",

        recordId:
          createdProfile.id,

        shopId:
          createdProfile.shop_id,

        newData: {
          id:
            createdProfile.id,

          username,
          full_name:
            fullName,

          role,
          shop_id:
            shopId,

          is_active:
            true,
        },
      }
    );

    return response(
      {
        success: true,

        message:
          "Account created successfully.",

        account:
          createdProfile,
      },
      201
    );
  } catch (error) {
    console.error(
      "ADMIN ACCOUNTS CREATE ERROR:",
      error
    );

    return response(
      {
        success: false,

        message:
          error?.message ||
          "Unable to create account.",
      },
      error?.status || 500
    );
  }
}

// ==================================================
// PATCH
// RENAME / ROLE / SHOP / ACTIVE / PASSWORD
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

    const profileId =
      String(
        body?.profile_id ||
        ""
      ).trim();

    if (!profileId) {
      throw new ApiError(
        "Profile ID is required.",
        400
      );
    }

    const oldProfile =
      await getProfileById(
        config,
        profileId
      );

    if (
      !oldProfile
        .auth_user_id
    ) {
      throw new ApiError(
        "This account has already been deleted.",
        400
      );
    }

    const username =
      body?.username !==
      undefined
        ? normalizeUsername(
            body.username
          )
        : normalizeUsername(
            oldProfile.username
          );

    const fullName =
      body?.full_name !==
      undefined
        ? normalizeName(
            body.full_name
          )
        : oldProfile.full_name;

    const role =
      body?.role !==
      undefined
        ? normalizeRole(
            body.role
          )
        : normalizeRole(
            oldProfile.role
          );

    const isActive =
      body?.is_active !==
      undefined
        ? Boolean(
            body.is_active
          )
        : Boolean(
            oldProfile.is_active
          );

    const password =
      String(
        body?.password || ""
      );

    let shopId =
      body?.shop_id !==
      undefined
        ? body.shop_id ||
          null
        : oldProfile.shop_id;

    // ----------------------------------------------
    // Validation
    // ----------------------------------------------

    if (
      !USERNAME_PATTERN.test(
        username
      )
    ) {
      throw new ApiError(
        "Invalid username.",
        400
      );
    }

    if (!fullName) {
      throw new ApiError(
        "Full name is required.",
        400
      );
    }

    if (
      !VALID_ROLES.has(role)
    ) {
      throw new ApiError(
        "Role must be ADMIN or CASHIER.",
        400
      );
    }

    if (
      password &&
      password.length < 8
    ) {
      throw new ApiError(
        "New password must contain at least 8 characters.",
        400
      );
    }

    // ----------------------------------------------
    // Protect currently logged-in Admin
    // ----------------------------------------------

    const editingSelf =
      String(
        oldProfile.id
      ) ===
      String(
        adminProfile.id
      );

    if (editingSelf) {
      if (role !== "ADMIN") {
        throw new ApiError(
          "You cannot remove your own Admin role.",
          400
        );
      }

      if (!isActive) {
        throw new ApiError(
          "You cannot deactivate your own account.",
          400
        );
      }
    }

    // ----------------------------------------------
    // Protect final active Admin
    // ----------------------------------------------

    if (
      normalizeRole(
        oldProfile.role
      ) === "ADMIN" &&
      oldProfile.is_active &&
      (
        role !== "ADMIN" ||
        !isActive
      )
    ) {
      const adminCount =
        await getActiveAdminCount(
          config
        );

      if (adminCount <= 1) {
        throw new ApiError(
          "The final active Admin account cannot be removed or deactivated.",
          400
        );
      }
    }

    if (role === "ADMIN") {
      shopId = null;
    } else {
      await ensureShop(
        config,
        shopId
      );
    }

    await ensureUsernameAvailable(
      config,
      username,
      oldProfile.id
    );

    // ----------------------------------------------
    // First update profile
    // ----------------------------------------------

    const updatePayload = {
      username,

      full_name:
        fullName,

      role,

      shop_id:
        shopId,

      is_active:
        isActive,

      updated_at:
        new Date()
          .toISOString(),
    };

    const profileResponse =
      await fetch(
        `${config.supabaseUrl}/rest/v1/profiles` +
          `?id=eq.${encodeURIComponent(
            oldProfile.id
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
            JSON.stringify(
              updatePayload
            ),
        }
      );

    const updatedProfiles =
      await safeJson(
        profileResponse
      );

    if (
      !profileResponse.ok ||
      !Array.isArray(
        updatedProfiles
      ) ||
      updatedProfiles.length ===
        0
    ) {
      throw new ApiError(
        errorMessage(
          updatedProfiles,
          "Unable to update account profile."
        ),
        500
      );
    }

    // ----------------------------------------------
    // Update Supabase Auth login
    // ----------------------------------------------

    const authUpdates = {
      email:
        `${username}@teamlegend.local`,

      email_confirm:
        true,

      user_metadata: {
        username,
        full_name:
          fullName,
      },

      app_metadata: {
        team_legend_role:
          role,
      },
    };

    if (password) {
      authUpdates.password =
        password;
    }

    try {
      await updateAuthUser(
        config,
        oldProfile.auth_user_id,
        authUpdates
      );
    } catch (authError) {
      // Roll profile back if Auth update fails.
      try {
        await fetch(
          `${config.supabaseUrl}/rest/v1/profiles` +
            `?id=eq.${encodeURIComponent(
              oldProfile.id
            )}`,
          {
            method: "PATCH",

            headers:
              serviceHeaders(
                config
              ),

            body:
              JSON.stringify({
                username:
                  oldProfile.username,

                full_name:
                  oldProfile.full_name,

                role:
                  oldProfile.role,

                shop_id:
                  oldProfile.shop_id,

                is_active:
                  oldProfile.is_active,

                updated_at:
                  oldProfile.updated_at ||
                  new Date()
                    .toISOString(),
              }),
          }
        );
      } catch {
        // Best effort rollback.
      }

      throw authError;
    }

    const updatedProfile =
      updatedProfiles[0];

    await writeAudit(
      config,
      adminProfile,
      {
        action:
          "ADMIN_ACCOUNT_UPDATED",

        recordId:
          oldProfile.id,

        shopId:
          updatedProfile.shop_id,

        oldData: {
          username:
            oldProfile.username,

          full_name:
            oldProfile.full_name,

          role:
            oldProfile.role,

          shop_id:
            oldProfile.shop_id,

          is_active:
            oldProfile.is_active,
        },

        newData: {
          username,

          full_name:
            fullName,

          role,

          shop_id:
            shopId,

          is_active:
            isActive,

          password_changed:
            Boolean(password),
        },
      }
    );

    return response({
      success: true,

      message:
        "Account updated successfully.",

      account:
        updatedProfile,
    });
  } catch (error) {
    console.error(
      "ADMIN ACCOUNTS UPDATE ERROR:",
      error
    );

    return response(
      {
        success: false,

        message:
          error?.message ||
          "Unable to update account.",
      },
      error?.status || 500
    );
  }
}

// ==================================================
// DELETE
// REMOVE LOGIN BUT PRESERVE HISTORICAL PROFILE
// ==================================================

export async function DELETE(
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

    const profileId =
      String(
        body?.profile_id ||
        ""
      ).trim();

    if (!profileId) {
      throw new ApiError(
        "Profile ID is required.",
        400
      );
    }

    const oldProfile =
      await getProfileById(
        config,
        profileId
      );

    if (
      String(
        oldProfile.id
      ) ===
      String(
        adminProfile.id
      )
    ) {
      throw new ApiError(
        "You cannot delete your own Admin account.",
        400
      );
    }

    if (
      !oldProfile
        .auth_user_id
    ) {
      throw new ApiError(
        "This account has already been deleted.",
        400
      );
    }

    // ----------------------------------------------
    // Protect final active Admin
    // ----------------------------------------------

    if (
      normalizeRole(
        oldProfile.role
      ) === "ADMIN" &&
      oldProfile.is_active
    ) {
      const adminCount =
        await getActiveAdminCount(
          config
        );

      if (adminCount <= 1) {
        throw new ApiError(
          "The final active Admin account cannot be deleted.",
          400
        );
      }
    }

    const archivedUsername =
      `deleted_${Date.now()}_${String(
        oldProfile.id
      ).slice(0, 8)}`;

    // ----------------------------------------------
    // Disconnect profile from Auth first.
    // Historical profile ID stays intact.
    // ----------------------------------------------

    const archiveResponse =
      await fetch(
        `${config.supabaseUrl}/rest/v1/profiles` +
          `?id=eq.${encodeURIComponent(
            oldProfile.id
          )}`,
        {
          method: "PATCH",

          headers:
            serviceHeaders(
              config
            ),

          body:
            JSON.stringify({
              auth_user_id:
                null,

              username:
                archivedUsername,

              is_active:
                false,

              updated_at:
                new Date()
                  .toISOString(),
            }),
        }
      );

    const archiveResult =
      await safeJson(
        archiveResponse
      );

    if (!archiveResponse.ok) {
      throw new ApiError(
        errorMessage(
          archiveResult,
          "Unable to archive account profile."
        ),
        500
      );
    }

    // ----------------------------------------------
    // Delete Supabase Auth login
    // ----------------------------------------------

    try {
      await deleteAuthUser(
        config,
        oldProfile.auth_user_id
      );
    } catch (deleteError) {
      // Restore profile if Auth deletion fails.
      try {
        await fetch(
          `${config.supabaseUrl}/rest/v1/profiles` +
            `?id=eq.${encodeURIComponent(
              oldProfile.id
            )}`,
          {
            method: "PATCH",

            headers:
              serviceHeaders(
                config
              ),

            body:
              JSON.stringify({
                auth_user_id:
                  oldProfile.auth_user_id,

                username:
                  oldProfile.username,

                is_active:
                  oldProfile.is_active,

                updated_at:
                  oldProfile.updated_at ||
                  new Date()
                    .toISOString(),
              }),
          }
        );
      } catch {
        // Best effort rollback.
      }

      throw deleteError;
    }

    await writeAudit(
      config,
      adminProfile,
      {
        action:
          "ADMIN_ACCOUNT_DELETED",

        recordId:
          oldProfile.id,

        shopId:
          oldProfile.shop_id,

        oldData: {
          username:
            oldProfile.username,

          full_name:
            oldProfile.full_name,

          role:
            oldProfile.role,

          shop_id:
            oldProfile.shop_id,

          is_active:
            oldProfile.is_active,
        },

        newData: {
          login_deleted:
            true,

          profile_preserved:
            true,
        },
      }
    );

    return response({
      success: true,

      message:
        "Login account deleted. Historical records were preserved.",
    });
  } catch (error) {
    console.error(
      "ADMIN ACCOUNTS DELETE ERROR:",
      error
    );

    return response(
      {
        success: false,

        message:
          error?.message ||
          "Unable to delete account.",
      },
      error?.status || 500
    );
  }
}
