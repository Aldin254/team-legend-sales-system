import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16384;

function reply(code, message, status = 200) {
  return NextResponse.json(
    {
      ResponseCode: code,
      ResponseDescription: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function secureEqual(actual, expected) {
  const a = createHash("sha256")
    .update(actual)
    .digest();

  const b = createHash("sha256")
    .update(expected)
    .digest();

  return timingSafeEqual(a, b);
}

function checkBankAuthorization(request) {
  const username = process.env.CBK_H2H_USERNAME;
  const password = process.env.CBK_H2H_PASSWORD;

  if (!username || !password) {
    return "NOT_CONFIGURED";
  }

  const header =
    request.headers.get("authorization") || "";

  if (!/^Basic [A-Za-z0-9+/=]+$/i.test(header)) {
    return "DENIED";
  }

  try {
    const encoded = header.replace(/^Basic /i, "");
    const supplied = Buffer.from(
      encoded,
      "base64"
    ).toString("utf8");

    return secureEqual(
      supplied,
      `${username}:${password}`
    )
      ? "ALLOWED"
      : "DENIED";
  } catch {
    return "DENIED";
  }
}

async function readLimitedJson(request) {
  const reader = request.body?.getReader();

  if (!reader) {
    throw new Error("EMPTY_BODY");
  }

  const chunks = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    size += value.byteLength;

    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("BODY_TOO_LARGE");
    }

    chunks.push(Buffer.from(value));
  }

  const text = Buffer.concat(chunks).toString("utf8");

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (!text || text.length > maxLength) {
    return null;
  }

  return text;
}

function validateNotification(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return null;
  }

  const referenceNumber = cleanText(
    body.ReferenceNumber,
    150
  );

  const paymentReference = cleanText(
    body.PaymentReference,
    150
  );

  const paymentNarration = cleanText(
    body.PaymentNarration,
    1000
  );

  const timeStamp = cleanText(
    body.TimeStamp,
    100
  );

  const amountInput = body.PaymentAmount;

  if (
    typeof amountInput !== "string" &&
    typeof amountInput !== "number"
  ) {
    return null;
  }

  const amount = String(amountInput).trim();

  // Positive KES value, maximum two decimal places.
  if (
    !/^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?$/.test(
      amount
    ) ||
    Number(amount) <= 0
  ) {
    return null;
  }

  if (
    !referenceNumber ||
    !paymentReference ||
    !paymentNarration ||
    !timeStamp
  ) {
    return null;
  }

  return {
    referenceNumber,
    paymentAmount: amount,
    paymentReference,
    paymentNarration,
    timeStamp,
  };
}

export async function POST(request) {
  // Do not accept any request without valid
  // bank authentication credentials.
  const authorization = checkBankAuthorization(request);

  if (authorization === "NOT_CONFIGURED") {
    return reply(
      "FAILED",
      "Bank authentication not configured",
      503
    );
  }

  if (authorization !== "ALLOWED") {
    return reply(
      "FAILED",
      "Unauthorized",
      401
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return reply(
      "FAILED",
      "Banking service unavailable",
      503
    );
  }

  const contentType =
    request.headers.get("content-type") || "";

  if (
    !/^application\/json(?:\s*;|$)/i.test(
      contentType
    )
  ) {
    return reply(
      "FAILED",
      "JSON content required",
      415
    );
  }

  let body;

  try {
    body = await readLimitedJson(request);
  } catch {
    return reply(
      "FAILED",
      "Invalid notification body",
      400
    );
  }

  const notification = validateNotification(body);

  if (!notification) {
    return reply(
      "FAILED",
      "Invalid payment notification",
      400
    );
  }

  try {
    const endpoint =
      `${supabaseUrl.replace(/\/$/, "")}` +
      "/rest/v1/rpc/tl_bank_h2h_ingest";

    // Service-role key is used exclusively
    // by this server-side endpoint.
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_reference_number:
          notification.referenceNumber,

        p_payment_amount:
          notification.paymentAmount,

        p_payment_reference:
          notification.paymentReference,

        p_payment_narration:
          notification.paymentNarration,

        p_bank_timestamp:
          notification.timeStamp,

        p_payload: body,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        "Bank notification storage failed:",
        response.status
      );

      return reply(
        "FAILED",
        "Notification processing unavailable",
        503
      );
    }

    const result = await response.json();

    if (
      result.state === "RECEIVED" ||
      result.state === "DUPLICATE"
    ) {
      // Acknowledged and stored.
      // Does NOT credit any cashier yet.
      return reply(
        "SUCCESS",
        "Payment notification received"
      );
    }

    if (result.state === "CONFLICT") {
      return reply(
        "FAILED",
        "Payment reference requires review",
        409
      );
    }

    return reply(
      "FAILED",
      "Unexpected processing result",
      500
    );
  } catch {
    return reply(
      "FAILED",
      "Bank notification service unavailable",
      503
    );
  }
}
