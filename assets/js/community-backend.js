import { COMMENTS_CONFIG } from "../../data/comments-config.js";

const TABLES = Object.freeze({
  generalComments: "general_comments",
  bookFeedback: "book_feedback"
});

function configuredURL() {
  if (!COMMENTS_CONFIG.supabaseUrl || !COMMENTS_CONFIG.supabaseAnonKey) return null;
  try {
    const url = new URL(COMMENTS_CONFIG.supabaseUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

export function sharedBackendAvailable() {
  return Boolean(configuredURL());
}

export function tableEndpoint(table) {
  if (!Object.values(TABLES).includes(table)) throw new Error("جدول غير معتمد.");
  const base = configuredURL();
  if (!base) throw new Error("التخزين المشترك غير مُعد.");
  return new URL("/rest/v1/" + table, base);
}

export function publicHeaders(extra = {}) {
  return {
    apikey: COMMENTS_CONFIG.supabaseAnonKey,
    Authorization: "Bearer " + COMMENTS_CONFIG.supabaseAnonKey,
    ...extra
  };
}

export async function insertPublicRow(table, record) {
  const response = await fetch(tableEndpoint(table), {
    method: "POST",
    headers: publicHeaders({
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    }),
    body: JSON.stringify(record)
  });
  if (!response.ok) throw new Error("تعذر إرسال البيانات إلى التخزين المشترك.");
}

export async function loadApprovedGeneralComments(limit = 100) {
  const url = tableEndpoint(TABLES.generalComments);
  url.searchParams.set("select", "id,name,comment,created_at");
  url.searchParams.set("approved", "eq.true");
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, {
    headers: publicHeaders({ Accept: "application/json" })
  });
  if (!response.ok) throw new Error("تعذر تحميل التعليقات العامة.");
  const value = await response.json();
  if (!Array.isArray(value)) throw new Error("استجابة التعليقات غير صالحة.");
  return value;
}

export { TABLES };
