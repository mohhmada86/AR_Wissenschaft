const encoder = new TextEncoder();

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

async function secretsMatch(received, expected) {
  if (!received) return false;
  const [receivedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const left = new Uint8Array(receivedHash);
  const right = new Uint8Array(expectedHash);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function text(value, maximum = 3000) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function oneLine(value, maximum) {
  return text(value, maximum).replace(/[\r\n]+/g, " ").trim();
}

function escapeHTML(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function line(label, value) {
  return "<p><strong>" + escapeHTML(label) + ":</strong> " +
    escapeHTML(value || "—") + "</p>";
}

function generalEmail(record) {
  const name = oneLine(record.name, 60);
  const comment = text(record.comment, 1000);
  return {
    subject: "تعليق عام جديد من " + (name || "زائر"),
    html: [
      "<div dir=\"rtl\" lang=\"ar\">",
      "<h1>تعليق عام جديد</h1>",
      line("الاسم", name),
      line("التعليق", comment),
      "<p>التعليق غير معتمد افتراضيًا. راجعه في جدول general_comments قبل نشره.</p>",
      "</div>"
    ].join(""),
    plain: [
      "تعليق عام جديد",
      "الاسم: " + name,
      "التعليق: " + comment,
      "راجع جدول general_comments لاعتماده."
    ].join("\n\n")
  };
}

function feedbackEmail(record) {
  const title = oneLine(record.book_title, 500);
  const page = oneLine(record.page_number, 20);
  const reviewer = text(record.reviewer_name, 60);
  const reviewerEmail = text(record.reviewer_email, 254);
  const issueType = text(record.issue_type, 80);
  const comment = text(record.comment, 3000);
  const correction = text(record.suggested_correction, 3000);
  const wantsContact = record.wants_contact === true ? "نعم" : "لا";
  return {
    subject: "ملاحظة كتاب جديدة — " + (title || "كتاب") + " — صفحة " + (page || "غير محددة"),
    html: [
      "<div dir=\"rtl\" lang=\"ar\">",
      "<h1>ملاحظة جديدة على كتاب</h1>",
      line("الكتاب", title),
      line("معرّف الكتاب", text(record.book_id, 160)),
      line("الصفحة", page),
      line("نوع الملاحظة", issueType),
      line("اسم المراجع", reviewer),
      line("شرح الملاحظة", comment),
      line("التصحيح المقترح", correction),
      line("يرغب في التواصل", wantsContact),
      line("البريد الخاص", reviewerEmail),
      "<p>هذه البيانات خاصة بالإدارة ولا ينبغي نشر البريد الإلكتروني.</p>",
      "</div>"
    ].join(""),
    plain: [
      "ملاحظة جديدة على كتاب",
      "الكتاب: " + title,
      "معرّف الكتاب: " + text(record.book_id, 160),
      "الصفحة: " + page,
      "النوع: " + issueType,
      "المراجع: " + reviewer,
      "الملاحظة: " + comment,
      "التصحيح المقترح: " + correction,
      "يرغب في التواصل: " + wantsContact,
      "البريد الخاص: " + reviewerEmail
    ].join("\n\n")
  };
}

Deno.serve(async request => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const webhookSecret = Deno.env.get("WEBHOOK_SECRET") || "";
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const adminEmail = Deno.env.get("ADMIN_EMAIL") || "";
  const fromEmail = Deno.env.get("FROM_EMAIL") || "";
  if (!webhookSecret || !resendKey || !adminEmail || !fromEmail) {
    return jsonResponse({ error: "missing_server_configuration" }, 503);
  }

  if (!await secretsMatch(request.headers.get("x-webhook-secret"), webhookSecret)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > 20000) return jsonResponse({ error: "payload_too_large" }, 413);
    payload = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const allowedTable = payload.table === "general_comments" || payload.table === "book_feedback";
  const validRecord = payload.record && typeof payload.record === "object" && !Array.isArray(payload.record);
  if (payload.type !== "INSERT" || payload.schema !== "public" || !allowedTable || !validRecord) {
    return jsonResponse({ error: "unsupported_event" }, 400);
  }

  const email = payload.table === "general_comments"
    ? generalEmail(payload.record)
    : feedbackEmail(payload.record);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + resendKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [adminEmail],
      subject: email.subject,
      html: email.html,
      text: email.plain
    })
  });

  if (!response.ok) {
    console.error("Email provider rejected the request with status", response.status);
    return jsonResponse({ error: "email_delivery_failed" }, 502);
  }

  return jsonResponse({ ok: true });
});
