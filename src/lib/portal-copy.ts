import type { Locale } from "./i18n";

// Strings for the customer portal's account pages and the platform admin
// area, in the same [fa, en] tuple shape as dashboard-copy.ts. The channel
// dashboard keeps its own file; this one covers subscriptions and accounts.
const copy = {
  subscription: ["اشتراک من", "Subscription"],
  subscriptionDescription: ["طرح فعلی، درخواست‌های ثبت‌شده و شرایط پرداخت. هیچ مبلغی در این صفحه دریافت نمی‌شود.", "Your current plan, submitted requests and payment terms. Nothing is charged on this page."],
  currentPlan: ["طرح فعلی", "Current plan"],
  planFree: ["رایگان", "Free"],
  planPro: ["حرفه‌ای", "Pro"],
  statusFree: ["رایگان", "Free"],
  statusActive: ["فعال", "Active"],
  statusPending: ["در انتظار", "Pending"],
  statusCancelled: ["لغوشده", "Cancelled"],
  statusApproved: ["تأییدشده", "Approved"],
  statusRejected: ["ردشده", "Rejected"],
  monthly: ["ماهانه", "Monthly"],
  annual: ["سالانه", "Annual"],
  choosePlan: ["انتخاب طرح", "Choose a plan"],
  choosePlanHelp: ["طرح و دورهٔ پرداخت را انتخاب کنید. درخواست شما ثبت می‌شود و پس از فعال‌شدن پرداخت آنلاین، برای تکمیل با شما تماس گرفته می‌شود.", "Pick a plan and billing interval. Your request is recorded; once online payment is available, you will be contacted to complete it."],
  firstPayment: ["پرداخت اول", "First payment"],
  renewal: ["تمدید", "Renewal"],
  introductory: ["مبلغ معرفی فقط برای سال اول است.", "The introductory price applies to the first year only."],
  requestPlan: ["ثبت درخواست", "Submit request"],
  requestConfirm: ["این درخواست ثبت شود؟ مبلغی دریافت نمی‌شود.", "Record this request? You will not be charged."],
  requestRecorded: ["درخواست ثبت شد. تا فعال‌شدن پرداخت، طرح شما تغییری نمی‌کند.", "Your request was recorded. Your plan stays unchanged until payment is available."],
  requestUnavailable: ["این طرح فعلاً قابل درخواست نیست.", "This plan cannot be requested right now."],
  alreadyOnPlan: ["این طرح فعلی شماست.", "This is your current plan."],
  requests: ["درخواست‌های من", "My requests"],
  noRequests: ["هنوز درخواستی ثبت نکرده‌اید.", "You have not submitted any requests yet."],
  cancelRequest: ["لغو درخواست", "Cancel request"],
  cancelConfirm: ["این درخواست لغو شود؟", "Cancel this request?"],
  requestCancelled: ["درخواست لغو شد.", "The request was cancelled."],
  requestedOn: ["ثبت‌شده در", "Submitted on"],
  paymentNotice: ["پرداخت آنلاین هنوز پیکربندی نشده است. درخواست‌ها ثبت می‌شوند تا نوبت به پرداخت برسد؛ دسترسی پولی خودکار فعال نمی‌شود.", "Online payment is not configured yet. Requests are recorded until payment is available; paid access is never activated automatically."],
  account: ["حساب کاربری", "Account"],
  accountDescription: ["مشخصات حساب و زبان پیش‌فرض شما. ورود با تلگرام انجام می‌شود و رمز عبوری در دربان نگهداری نمی‌شود.", "Your account details and default language. Sign-in goes through Telegram; Darban stores no password."],
  displayName: ["نام نمایشی", "Display name"],
  displayNameHelp: ["از پروفایل تلگرام شما خوانده می‌شود و با هر ورود به‌روز می‌شود.", "Read from your Telegram profile and refreshed on every sign-in."],
  telegramId: ["شناسهٔ تلگرام", "Telegram ID"],
  memberSince: ["عضو از", "Member since"],
  preferredLocale: ["زبان پیش‌فرض", "Default language"],
  preferredLocaleHelp: ["زبانی که پیام‌های سرویس و ایمیل‌های آینده با آن فرستاده می‌شوند. نمای فعلی از آدرس صفحه پیروی می‌کند.", "The language used for service messages and future emails. The current view follows the page address."],
  saveLocale: ["ذخیرهٔ زبان", "Save language"],
  localeSaved: ["زبان پیش‌فرض ذخیره شد.", "Default language saved."],
  persian: ["فارسی", "Persian"],
  english: ["انگلیسی", "English"],
  platformOverview: ["نمای کلی سامانه", "Platform overview"],
  platformDescription: ["حساب‌ها، طرح‌ها و درخواست‌های اشتراک در کل سامانه. هر تغییری که اینجا انجام می‌دهید در گزارش مدیریت ثبت می‌شود.", "Accounts, plans and subscription requests across the platform. Every change made here is written to the audit log."],
  users: ["کاربران", "Customers"],
  usersDescription: ["حداکثر ۱۰۰ حساب اخیر. تعلیق، دسترسی به پرتال و همهٔ چت‌های متصل آن حساب را می‌بندد.", "Up to 100 recent accounts. Suspending closes the portal and every connected chat for that account."],
  plans: ["طرح‌ها و قیمت‌ها", "Plans & pricing"],
  plansDescription: ["مبالغ به سنت دلار آمریکا ذخیره می‌شوند. تغییر قیمت روی درخواست‌های قبلی اثر ندارد؛ هر درخواست مبلغ زمان ثبت خودش را نگه می‌دارد.", "Amounts are stored in US cents. Price changes do not affect earlier requests; each keeps the quote from when it was submitted."],
  planRequests: ["درخواست‌های اشتراک", "Plan requests"],
  planRequestsDescription: ["حداکثر ۱۰۰ درخواست اخیر از همهٔ حساب‌ها. تا اتصال درگاه پرداخت، تغییر وضعیت دستی است.", "Up to 100 recent requests across all accounts. Until a payment gateway is connected, status changes are manual."],
  auditLog: ["گزارش مدیریت", "Audit log"],
  auditDescription: ["هر تغییر طرح و هر تعلیق، با شناسهٔ مدیری که آن را انجام داده.", "Every plan change and suspension, with the ID of the administrator who made it."],
  noAccounts: ["هنوز حسابی ثبت نشده است.", "No accounts yet."],
  noPlatformRequests: ["هنوز درخواستی ثبت نشده است.", "No requests yet."],
  noEvents: ["هنوز رویدادی ثبت نشده است.", "No events yet."],
  name: ["نام", "Name"],
  status: ["وضعیت", "Status"],
  plan: ["طرح", "Plan"],
  interval: ["دوره", "Interval"],
  amount: ["مبلغ", "Amount"],
  createdAt: ["تاریخ", "Date"],
  actor: ["مدیر", "Administrator"],
  action: ["اقدام", "Action"],
  target: ["هدف", "Target"],
  detail: ["جزئیات", "Detail"],
  active: ["فعال", "Active"],
  suspended: ["تعلیق‌شده", "Suspended"],
  suspend: ["تعلیق حساب", "Suspend account"],
  reinstate: ["رفع تعلیق", "Reinstate"],
  suspendConfirm: ["این حساب تعلیق شود؟ دسترسی به پرتال و همهٔ چت‌های متصل بسته می‌شود.", "Suspend this account? Access to the portal and every connected chat will close."],
  reinstateConfirm: ["تعلیق این حساب برداشته شود؟", "Reinstate this account?"],
  statusSaved: ["وضعیت حساب ذخیره شد.", "Account status saved."],
  platformAdminBadge: ["مدیر سامانه", "Platform admin"],
  monthlyPrice: ["قیمت ماهانه", "Monthly price"],
  annualPrice: ["قیمت سالانه", "Annual price"],
  introPrice: ["قیمت سال اول", "First-year price"],
  introPriceHelp: ["خالی بگذارید تا سال اول همان قیمت سالانه باشد.", "Leave empty to charge the regular annual price in the first year."],
  usdCents: ["به سنت دلار؛ ۵۰۰ یعنی ۵ دلار.", "In US cents; 500 means $5."],
  featuresFa: ["امکانات (فارسی)", "Features (Persian)"],
  featuresEn: ["امکانات (انگلیسی)", "Features (English)"],
  featuresHelp: ["هر خط یک مورد. حداکثر ۳۰ مورد.", "One item per line. Up to 30 items."],
  available: ["قابل انتخاب برای مشتریان", "Available to customers"],
  savePlan: ["ذخیرهٔ طرح", "Save plan"],
  planSaved: ["طرح ذخیره شد.", "Plan saved."],
  invalidPlan: ["مقادیر طرح معتبر نیست. قیمت‌ها را بررسی کنید.", "The plan values are not valid. Check the prices."],
  updatePlanAction: ["ویرایش طرح", "Plan updated"],
  accountStatusAction: ["تغییر وضعیت حساب", "Account status changed"],
  requestError: ["درخواست انجام نشد. اتصال و دسترسی را بررسی کنید و دوباره تلاش کنید.", "The request could not be completed. Check your connection and access, then try again."],
  sessionExpired: ["نشست شما تمام شده است. دوباره وارد شوید.", "Your session has ended. Sign in again."],
  sampleNotice: ["حساب‌ها، مبالغ و زمان‌ها ساختگی‌اند.", "Accounts, amounts and timestamps are synthetic."],
  timezone: ["زمان‌ها به وقت تهران", "Times shown in Tehran time"],
} as const;

export type PortalCopy = { [Key in keyof typeof copy]: string };

export function portalCopy(locale: Locale): PortalCopy {
  const index = locale === "en" ? 1 : 0;
  return Object.fromEntries(Object.entries(copy).map(([key, pair]) => [key, pair[index]])) as PortalCopy;
}

export function planLabel(locale: Locale, planId: string): string {
  const c = portalCopy(locale);
  return planId === "pro" ? c.planPro : planId === "free" ? c.planFree : planId;
}

export function requestStatusLabel(locale: Locale, status: string): string {
  const c = portalCopy(locale);
  const labels: Record<string, string> = { PENDING: c.statusPending, CANCELLED: c.statusCancelled, APPROVED: c.statusApproved, REJECTED: c.statusRejected, ACTIVE: c.statusActive, FREE: c.statusFree };
  return labels[status] ?? status;
}

export function platformActionLabel(locale: Locale, action: string): string {
  const c = portalCopy(locale);
  return action === "update-plan" ? c.updatePlanAction : action === "account-status" ? c.accountStatusAction : action;
}

/** Error text for a failed portal or platform request, never echoing Persian to an English screen. */
export function portalError(locale: Locale, status: number, error: unknown): string {
  const c = portalCopy(locale);
  if (status === 401) return c.sessionExpired;
  if (typeof error === "string" && error && !(locale === "en" && /[؀-ۿ]/.test(error))) return error;
  return c.requestError;
}
