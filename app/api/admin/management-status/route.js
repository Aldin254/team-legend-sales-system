import { NextResponse } from "next/server";

// ==================================================
// CONSTANTS
// ==================================================

const VALID_STATUSES = new Set([
  "PENDING",
  "PAID",
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

    Authorization:
      `Bearer ${config.serviceKey}`,

    "Content-Type":
      "application/json",

    ...extra,
  };
}

function normalizeText(value) {
  return String(
    value || ""
  )
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeStatus(value) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}

function normalizeAmount(value) {
  const amount =
    Number(value || 0);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw new ApiError(
      "Amount must be zero or greater.",
      400
    );
  }

  return amount;
}

function normalizeDate(value) {
  const text =
    String(
      value || ""
    ).trim();

  if (!text) {
    return null;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {
    throw new ApiError(
      "Due date must be a valid date.",
      400
    );
  }

  return text;
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
      adminProfile.role || ""
    ).toUpperCase() !==
      "ADMIN"
  ) {
    throw new ApiError(
      "Only Admin can manage Management Status.",
      403
    );
  }

  return {
    config,
    adminProfile,
  };
}

// ==================================================
// AUDIT
// ==================================================

async function writeAudit(
  config,
  adminProfile,
  {
    shopId,
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
              shopId,

            action,

            table_name:
              "management_status",

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
      "MANAGEMENT STATUS AUDIT ERROR:",
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

    const url =
      new URL(
        request.url
      );

    const shopId =
      String(
        url.searchParams.get(
          "shop_id"
        ) || ""
      ).trim();

    if (!shopId) {
      throw new ApiError(
        "Shop ID is required.",
        400
      );
    }

    const res =
      await fetch(
        `${config.supabaseUrl}/rest/v1/management_status` +
          `?shop_id=eq.${encodeURIComponent(
            shopId
          )}` +
          `&select=id,shop_id,description,cashier_name,amount,due_date,status,is_active,created_at,updated_at` +
          `&order=created_at.asc`,
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
        errorMessage(
          rows,
          "Unable to load Management Status."
        ),
        500
      );
    }

    return response({
      success: true,

      rows:
        Array.isArray(rows)
          ? rows
          : [],
    });
  } catch (error) {
    console.error(
      "MANAGEMENT STATUS GET ERROR:",
      error
    );

    return response(
      {
        success: false,

        message:
          error?.message ||
          "Unable to load Management Status.",
      },
      error?.status || 500
    );
  }
}

// ==================================================
// POST
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

    const shopId =
      String(
        body?.shop_id || ""
      ).trim();

    const description =
      normalizeText(
        body?.description
      );

    const cashierName =
      normalizeText(
        body?.cashier_name
      );

    const amount =
      normalizeAmount(
        body?.amount
      );

    const dueDate =
      normalizeDate(
        body?.due_date
      );

    const status =
      normalizeStatus(
        body?.status ||
          "PENDING"
      );

    if (!shopId) {
      throw new ApiError(
        "Shop is required.",
        400
      );
    }

    if (!description) {
      throw new ApiError(
        "Description is required.",
        400
      );
    }

    if (
      !VALID_STATUSES.has(
        status
      )
    ) {
      throw new ApiError(
        "Status must be PENDING or PAID.",
        400
      );
    }

    const createResponse =
      await fetch(
        `${config.supabaseUrl}/rest/v1/management_status`,
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
              shop_id:
                shopId,

              description,

              cashier_name:
                cashierName ||
                null,

              amount,

              due_date:
                dueDate,

              status,

              is_active:
                true,
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
          "Unable to create Management Status record."
        ),
        500
      );
    }

    const row =
      created[0];

    await writeAudit(
      config,
      adminProfile,
      {
        shopId:
          row.shop_id,

        action:
          "MANAGEMENT_STATUS_CREATED",

        recordId:
          row.id,

        newData:
          row,
      }
    );

    return response(
      {
        success: true,

        message:
          "Management Status record created.",

        row,
      },
      201
    );
  } catch (error) {
    console.error(
      "MANAGEMENT STATUS CREATE ERROR:",
      error
    );

    return response(
      {
        success: false,

        message:
          error?.message ||
          "Unable to create Management Status record.",
      },
      error?.status || 500
    );
  }
}

// ==================================================
// PATCH
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

    const id =
      String(
        body?.id || ""
      ).trim();

    if (!id) {
      throw new ApiError(
        "Record ID is required.",
        400
      );
    }

    const oldResponse =
      await fetch(
        `${config.supabaseUrl}/rest/v1/management_status` +
          `?id=eq.${encodeURIComponent(
            id
          )}` +
          `&select=*` +
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

    const oldRows =
      await safeJson(
        oldResponse
      );

    if (
      !oldResponse.ok ||
      !Array.isArray(
        oldRows
      ) ||
      oldRows.length === 0
    ) {
      throw new ApiError(
        "Management Status record was not found.",
        404
      );
    }

    const oldRow =
      oldRows[0];

    const description =
      body?.description !==
      undefined
        ? normalizeText(
            body.description
          )
        : oldRow.description;

    const cashierName =
      body?.cashier_name !==
      undefined
        ? normalizeText(
            body.cashier_name
          )
        : oldRow.cashier_name;

    const amount =
      body?.amount !==
      undefined
        ? normalizeAmount(
            body.amount
          )
        : Number(
            oldRow.amount || 0
          );

    const dueDate =
      body?.due_date !==
      undefined
        ? normalizeDate(
            body.due_date
          )
        : oldRow.due_date;

    const status =
      body?.status !==
      undefined
        ? normalizeStatus(
            body.status
          )
        : normalizeStatus(
            oldRow.status
          );

    const isActive =
      body?.is_active !==
      undefined
        ? Boolean(
            body.is_active
          )
        : Boolean(
            oldRow.is_active
          );

    if (!description) {
      throw new ApiError(
        "Description is required.",
        400
      );
    }

    if (
      !VALID_STATUSES.has(
        status
      )
    ) {
      throw new ApiError(
        "Status must be PENDING or PAID.",
        400
      );
    }

    const updateResponse =
      await fetch(
        `${config.supabaseUrl}/rest/v1/management_status` +
          `?id=eq.${encodeURIComponent(
            id
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
              description,

              cashier_name:
                cashierName ||
                null,

              amount,

              due_date:
                dueDate,

              status,

              is_active:
                isActive,

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
          "Unable to update Management Status record."
        ),
        500
      );
    }

    const row =
      updated[0];

    await writeAudit(
      config,
      adminProfile,
      {
        shopId:
          row.shop_id,

        action:
          "MANAGEMENT_STATUS_UPDATED",

        recordId:
          row.id,

        oldData:
          oldRow,

        newData:
          row,
      }
    );

    return response({
      success: true,

      message:
        "Management Status record updated.",

      row,
    });
  } catch (error) {
    console.error(
      "MANAGEMENT STATUS UPDATE ERROR:",
      error
    );

    return response(
      {
        success: false,

        message:
          error?.message ||
          "Unable to update Management Status record.",
      },
      error?.status || 500
    );
  }
}

// ==================================================
// DELETE
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

    const id =
      String(
        body?.id || ""
      ).trim();

    if (!id) {
      throw new ApiError(
        "Record ID is required.",
        400
      );
    }

    const oldResponse =
      await fetch(
        `${config.supabaseUrl}/rest/v1/management_status` +
          `?id=eq.${encodeURIComponent(
            id
          )}` +
          `&select=*` +
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

    const oldRows =
      await safeJson(
        oldResponse
      );

    if (
      !oldResponse.ok ||
      !Array.isArray(
        oldRows
      ) ||
      oldRows.length === 0
    ) {
      throw new ApiError(
        "Management Status record was not found.",
        404
      );
    }

    const oldRow =
      oldRows[0];

    const deleteResponse =
      await fetch(
        `${config.supabaseUrl}/rest/v1/management_status` +
          `?id=eq.${encodeURIComponent(
            id
          )}`,
        {
          method: "DELETE",

          headers:
            serviceHeaders(
              config,
              {
                Prefer:
                  "return=minimal",
              }
            ),
        }
      );

    if (
      !deleteResponse.ok
    ) {
      const data =
        await safeJson(
          deleteResponse
        );

      throw new ApiError(
        errorMessage(
          data,
          "Unable to delete Management Status record."
        ),
        500
      );
    }

    await writeAudit(
      config,
      adminProfile,
      {
        shopId:
          oldRow.shop_id,

        action:
          "MANAGEMENT_STATUS_DELETED",

        recordId:
          oldRow.id,

        oldData:
          oldRow,
      }
    );

    return response({
      success: true,

      message:
        "Management Status record deleted.",
    });
  } catch (error) {
    console.error(
      "MANAGEMENT STATUS DELETE ERROR:",
      error
    );

    return response(
      {
        success: false,

        message:
          error?.message ||
          "Unable to delete Management Status record.",
      },
      error?.status || 500
    );
  }
}
