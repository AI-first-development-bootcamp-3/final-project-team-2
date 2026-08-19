/**
 * Rule identifiers and their Hebrew messages.
 *
 * Lives here rather than in index.ts so `api-error.ts` can build a translated
 * error payload from it: index.ts imports every capability folder, so importing
 * it back would be circular. Re-exported from index.ts, so consumers are
 * unaffected.
 */
export type ValCode =
  | 'VAL-01'
  | 'VAL-02'
  | 'VAL-03'
  | 'VAL-04'
  | 'VAL-10'
  | 'VAL-11'
  | 'VAL-12'
  | 'VAL-13'
  | 'VAL-20'
  | 'VAL-21'
  | 'VAL-22'
  | 'VAL-23'
  | 'VAL-24'
  | 'VAL-25'
  | 'VAL-26'
  | 'VAL-27'
  | 'VAL-28'
  | 'VAL-30'
  | 'VAL-31'
  | 'VAL-32'
  | 'VAL-33'
  | 'VAL-33A'
  | 'VAL-34'
  | 'VAL-35'
  | 'VAL-36'
  | 'VAL-38'
  | 'VAL-DATE-RANGE'
  | 'VAL-EMPTY-UPDATE'
  | 'VAL-RUNNING-ENTRY';

export const VAL_MESSAGES: Record<ValCode, string> = {
  'VAL-01': 'כתובת האימייל היא שדה חובה',
  'VAL-02': 'כתובת האימייל שהוזנה אינה תקינה',
  'VAL-03': 'הסיסמה היא שדה חובה',
  'VAL-04': 'הסיסמה חייבת להכיל 8 תווים לפחות',
  'VAL-10': 'שם מלא הוא שדה חובה',
  'VAL-11': 'כתובת האימייל כבר בשימוש (VAL-11)',
  'VAL-12': 'יש לבחור תפקיד תקין',
  'VAL-13': 'הסיסמה הראשונית היא שדה חובה',
  'VAL-20': 'שם הלקוח הוא שדה חובה',
  'VAL-21': 'שם הלקוח כבר קיים במערכת',
  'VAL-22': 'שם הפרויקט הוא שדה חובה',
  'VAL-23': 'יש לבחור לקוח תקין ופעיל',
  'VAL-24': 'שם המשימה הוא שדה חובה',
  'VAL-25': 'יש לבחור פרויקט תקין ופעיל',
  'VAL-26': 'יש לבחור משתמש ומשימה תקינים',
  'VAL-27': 'השיוך כבר קיים במערכת',
  'VAL-28': 'יש לבחור אופן דיווח תקין',
  // Time entries (§8.5). VAL-37 (one running timer per user) belongs to the
  // Punch Clock epic and is intentionally absent here.
  'VAL-30': 'שעת התחלה היא שדה חובה',
  'VAL-31': 'שעת הסיום חייבת להיות מאוחרת משעת ההתחלה',
  'VAL-32': 'קיים כבר דיווח שעות חופף בטווח זה',
  'VAL-33': 'אינך משויך למשימה שנבחרה',
  // The employee holds the assignment, but the task itself is no longer open
  // for manual reporting — closed, removed, under an inactive project or
  // client, or on a punch-clock project. VAL-33's message would blame the
  // wrong thing.
  'VAL-33A': 'המשימה שנבחרה אינה זמינה לדיווח',
  'VAL-34': 'החודש נעול ולא ניתן לעדכן דיווחי שעות',
  'VAL-35': 'יש לבחור משימה',
  'VAL-36': 'יש לבחור מיקום עבודה',
  'VAL-38': 'התאריך אינו תואם את יום תחילת הדיווח',
  'VAL-DATE-RANGE': 'יש לציין תאריך יחיד או טווח תאריכים תקין',
  'VAL-EMPTY-UPDATE': 'לא נשלחו שדות לעדכון',
  // Punch Clock (KAN-79): PATCH/DELETE of a running entry is refused outright
  // rather than exempted from the merged-entry rules (design D7).
  'VAL-RUNNING-ENTRY': 'לא ניתן לערוך דיווח שעות שטרם הסתיים',
};
