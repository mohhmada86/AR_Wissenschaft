export const REQUEST_TYPES = Object.freeze({
  translation: "ترجمة كتاب أو مادة تعليمية",
  download: "نسخة قراءة أو تحميل",
  source: "ملفات المصدر أو التحرير للتعاون",
  feedback: "ملاحظة على كتاب",
  general: "استفسار عام"
});

export function emailIsValid(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function requestError(record) {
  const fail = (field, message) => ({ field, message });
  if (!["translation", "download", "source", "general"].includes(record.request_type)) return fail("request-type", "اختر نوع الطلب.");
  if (record.name && (record.name.length < 2 || record.name.length > 60)) return fail("request-name", "اكتب اسمًا من حرفين إلى 60 حرفًا أو اتركه فارغًا.");
  if (!emailIsValid(record.email)) return fail("request-email", "اكتب بريدًا صالحًا لنتمكن من الرد عليك.");
  if (["download", "source"].includes(record.request_type) && !record.book_id) return fail("request-book", "اختر الكتاب المطلوب.");
  if (record.request_type === "translation") {
    if (!record.material_title || record.material_title.length > 500) return fail("material-title", "اكتب عنوانًا للمادة لا يزيد على 500 حرف.");
    if (!record.original_language || record.original_language.length > 80) return fail("original-language", "اكتب اللغة الأصلية للمحتوى، حتى 80 حرفًا.");
    if (!record.subject_area || record.subject_area.length > 160) return fail("subject-area", "اكتب المجال الدراسي، حتى 160 حرفًا.");
    if (record.author && record.author.length > 200) return fail("material-author", "يجب ألا يزيد اسم المؤلف على 200 حرف.");
    if (record.source_url) {
      try {
        const url = new URL(record.source_url);
        if (record.source_url.length > 2000 || !["https:", "http:"].includes(url.protocol) || url.username || url.password || /\s/.test(record.source_url)) throw new Error();
      } catch { return fail("source-url", "اكتب رابطًا صحيحًا يبدأ بـ https:// أو http://، أو اتركه فارغًا."); }
    }
  }
  if (record.message.length < 5 || record.message.length > 3000) return fail("request-message", "اشرح طلبك في 5 إلى 3000 حرف.");
  if (record.notes && record.notes.length > 1000) return fail("request-notes", "الملاحظات الإضافية لا تزيد على 1000 حرف.");
  return null;
}
