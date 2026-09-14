export const ISSUE_TYPES = Object.freeze([
  "خطأ في الترجمة",
  "مصطلح علمي",
  "خطأ علمي",
  "معادلة أو رمز",
  "شكل أو صورة",
  "تعليق على الشكل",
  "خطأ إملائي",
  "خطأ نحوي أو لغوي",
  "تنسيق الصفحة",
  "نص غير واضح",
  "جزء مفقود",
  "مرجع أو اقتباس",
  "اقتراح لتحسين الأسلوب",
  "ملاحظة عامة",
  "أخرى"
]);

export function generalCommentError(name, comment) {
  if (name.length < 2) return { field: "name", message: "اكتب اسمًا من حرفين على الأقل." };
  if (name.length > 60) return { field: "name", message: "يجب ألا يزيد الاسم على 60 حرفًا." };
  if (comment.length < 3) return { field: "comment", message: "اكتب تعليقًا من 3 أحرف على الأقل." };
  if (comment.length > 1000) return { field: "comment", message: "يجب ألا يزيد التعليق على 1000 حرف." };
  return null;
}

export function bookFeedbackError(values) {
  if (values.reviewer_name.length < 2) return { field: "reviewer_name", message: "اكتب اسمًا من حرفين على الأقل." };
  if (values.reviewer_name.length > 60) return { field: "reviewer_name", message: "يجب ألا يزيد الاسم على 60 حرفًا." };
  if (values.page_number.length < 1) return { field: "page_number", message: "اكتب رقم الصفحة التي ظهرت فيها المشكلة." };
  if (values.page_number.length > 20) return { field: "page_number", message: "يجب ألا يزيد رقم الصفحة على 20 حرفًا." };
  if (!ISSUE_TYPES.includes(values.issue_type)) return { field: "issue_type", message: "اختر نوع الملاحظة." };
  if (values.comment.length < 5) return { field: "comment", message: "اشرح الملاحظة في 5 أحرف على الأقل." };
  if (values.comment.length > 3000) return { field: "comment", message: "يجب ألا يزيد شرح الملاحظة على 3000 حرف." };
  if (values.suggested_correction.length > 3000) return { field: "suggested_correction", message: "يجب ألا يزيد الاقتراح على 3000 حرف." };
  if (values.reviewer_email && (
    values.reviewer_email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.reviewer_email)
  )) return { field: "reviewer_email", message: "اكتب بريدًا إلكترونيًا صالحًا أو اتركه فارغًا." };
  if (values.wants_contact && !values.reviewer_email) {
    return { field: "reviewer_email", message: "أدخل بريدك الإلكتروني لأنك طلبت التواصل للمراجعة المتقدمة." };
  }
  return null;
}
