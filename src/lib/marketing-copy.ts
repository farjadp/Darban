import type { Locale } from "@/lib/i18n";
import type { PlanConfig } from "@/lib/plans";

const en = {
  nav: { home: "Home", features: "How it works", pricing: "Pricing", guide: "Setup guide", login: "Sign in", demo: "Explore the demo", label: "Main navigation", skip: "Skip to content" },
  hero: {
    eyebrow: "A gatekeeper for Telegram communities",
    title: "Your rules.",
    accent: "Your call.",
    body: "Give every vote a clear path. Darban checks your rules, flags unusual timing, and leaves the decisions about people to you.",
    primary: "See Darban in action",
    secondary: "Find your plan",
    note: "Timing, not beliefs. Review, not automatic removal.",
  },
  sample: {
    label: "A vote, from tap to review",
    notice: "Synthetic example · read-only · not live activity",
    channel: "Community reading room",
    post: "What should we discuss at our next reading session?",
    agree: "Agree", useful: "Useful", question: "Have a question",
    gate: "Your voting rules", member: "Membership checked", verified: "Private /start checked", waiting: "Wait period passed",
    evidence: "A pattern worth reviewing",
    threshold: "5 first-time voters · 90 seconds · one post",
    conclusion: "A timing signal, not a verdict.",
    review: "Admin review", decision: "No member removed", history: "Any admin action is recorded with a reason.",
  },
  mechanism: {
    eyebrow: "A clear boundary. A human decision.",
    title: "Keep the conversation open. Put rules at the door.",
    body: "Native Telegram reactions happen before a bot can intervene. Darban uses controlled vote buttons instead, so your rules are checked before a vote counts.",
    link: "Follow the full workflow",
    steps: [
      { title: "Set the rules", body: "Choose a waiting period and whether voters must start the bot privately." },
      { title: "Count eligible votes", body: "Membership, ban status, private verification and the observed join time determine whether a tap counts." },
      { title: "Review the evidence", body: "A cluster of first-time votes creates an alert. You review the timing and choose what, if anything, to do." },
    ],
  },
  safety: {
    eyebrow: "The boundary we do not cross",
    title: "Moderate behavior. Not beliefs.",
    body: "Darban never removes a member automatically. Alerts use timing and voting history, not political, religious or personal beliefs. A ban requires an explicit human admin action for that chat.",
    aside: "An alert is a reason to look closer. It is not proof of coordination.",
  },
  features: {
    eyebrow: "Inside the mechanism",
    title: "Every rule has a reason. Every action has an owner.",
    body: "From the first tap to the review log, see exactly where Darban acts—and where you decide.",
    rows: [
      { title: "Check before counting", body: "Controlled vote buttons check current membership, ban status and your enabled gates. A refused tap gets a reason rather than silently disappearing.", label: "The vote path", detail: "Member → gates → counted vote" },
      { title: "Give new arrivals time", body: "Set a wait from 0 to 168 hours. It only applies when the bot observed the join. Existing members with no observed join date bypass the wait; rejoining resets it.", label: "Waiting period", detail: "Observed joins only" },
      { title: "A private start, not identity proof", body: "Optionally require a private /start interaction before voting. It confirms an interaction with the bot, not a person’s identity or the age of an account.", label: "Verification", detail: "/start ≠ identity proof" },
      { title: "Read a signal in context", body: "Five distinct first-time voters on one post within 90 seconds create one saved alert snapshot. Review timing and vote history before deciding. Private alert delivery is best-effort; the panel is authoritative.", label: "Review threshold", detail: "5 first-time voters / 90 seconds" },
      { title: "Keep responsibility visible", body: "Publishing, bans, unbans, settings and sync operations record the actor, reason and outcome. An uncertain outcome stays marked unknown for manual reconciliation—not a guessed success.", label: "Operation history", detail: "Actor · reason · outcome" },
      { title: "Gate comments only when you choose", body: "An optional rule deletes waiting-period comments in a registered, linked discussion group. This is a message-level action enabled by an admin, not automatic member removal.", label: "Optional comment gate", detail: "Explicitly enabled by an admin" },
    ],
  },
  limits: {
    eyebrow: "Know the limits",
    title: "Built with Telegram. Honest about its boundaries.",
    body: "The Bot API does not provide account creation dates or a full subscriber list. Darban does not scrape profiles, infer identities or use MTProto. Join dates exist only for membership changes the bot actually observed.",
    native: "Native Telegram reactions must be disabled manually. Publish through Darban to attach controlled vote buttons; existing native reactions cannot be gated retroactively.",
  },
  pricing: {
    eyebrow: "Simple pricing. Clear terms.", title: "A plan for your next chapter.",
    body: "Choose Free or Pro. Review the price and renewal terms before making a plan request.",
    monthly: "Monthly", annual: "Annual", interval: "Billing interval", free: "Free", pro: "Pro", choose: "Choose plan", unavailable: "Currently unavailable",
    perMonth: "per month", perYear: "per year", firstYear: "for the first year", then: "Then", renewal: "per year at renewal", noCharge: "No subscription charge",
    pending: "Plan-specific limits and features are being finalized.",
    payment: "Online payments are not yet configured. Choosing a plan opens your subscription page; it does not charge you or activate paid access.",
    reference: "Pricing could not be refreshed. These are reference prices, not live pricing. Confirm availability in your subscription page.",
    defaults: "Showing the published default pricing. Your subscription page confirms availability.",
    currency: "All prices in US dollars (USD).", configured: "Configured plan details", terms: "No hidden first-year math.",
    termsBody: "An introductory annual price covers the first year only. The regular annual renewal price is shown alongside it. Monthly billing has no annual introductory discount.",
  },
  guide: {
    eyebrow: "The setup guide", title: "Make the rules clear from the start.",
    body: "A practical sequence for connecting your community and publishing your first controlled vote.",
    before: "Before you connect", beforeBody: "You need an authorized Darban account and live Telegram admin rights for the chat. A configured bot and HTTPS webhook must already be available on the service.",
    steps: [
      { title: "Sign in and connect your chat", body: "Use Telegram to sign in. Add the configured bot as a chat administrator with the permissions needed to post, restrict members and delete messages. Register the chat in the panel; access is checked against your live Telegram admin status." },
      { title: "Replace native reactions", body: "Open your channel settings in Telegram and disable native reactions manually. Darban controls its own inline vote buttons, not Telegram’s built-in reactions." },
      { title: "Choose your voting rules", body: "Set the waiting period between 0 and 168 hours and decide whether a private /start is required. Tell members the rules. The wait only applies to joins the bot has actually observed." },
      { title: "Prepare your discussion group", body: "If you use a connected discussion group, register it separately before linking its gate to the channel. Enable waiting-period comment deletion only if you want that message-level rule." },
      { title: "Publish through Darban", body: "Publish a text post from the panel to attach the controlled voting keyboard. Admins should also start the bot in private so it can attempt to deliver alert notifications." },
      { title: "Review before acting", body: "Open alerts in the panel and examine the timing evidence. Banning a member is your explicit action and requires a reason. Do not blindly retry an unknown operation; reconcile its result first. Unbanning does not restore membership or deleted messages." },
    ],
    ready: "Prefer to look around first?", readyBody: "The demo uses synthetic data. No Telegram connection or sign-in is needed.",
  },
  closing: { eyebrow: "The door is yours", title: "Let your community speak. Keep the final say.", body: "Explore the workflow before connecting a real chat.", action: "Open the read-only demo" },
  footer: { description: "A thoughtful gatekeeper for Telegram channels and groups.", principle: "Rules at the door. People in charge.", independent: "Darban is an independent product, not affiliated with Telegram.", navigation: "Explore Darban" },
};

type CopyShape<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends Array<infer U> ? CopyShape<U>[] : CopyShape<T[K]> };
export type MarketingCopy = CopyShape<typeof en>;

const fa: MarketingCopy = {
  nav: { home: "خانه", features: "سازوکار دربان", pricing: "تعرفه‌ها", guide: "راهنمای راه‌اندازی", login: "ورود", demo: "دیدن نسخهٔ نمایشی", label: "ناوبری اصلی", skip: "رفتن به محتوای اصلی" },
  hero: { eyebrow: "دربانی برای جمع‌های تلگرامی", title: "قانون از شما.", accent: "تصمیم با شما.", body: "برای هر رأی، مسیری روشن بسازید. دربان قوانین شما را بررسی می‌کند، زمان‌بندی غیرعادی را نشان می‌دهد و تصمیم دربارهٔ آدم‌ها را به شما می‌سپارد.", primary: "دربان را در عمل ببینید", secondary: "انتخاب طرح مناسب", note: "زمان‌بندی، نه عقاید. بررسی، نه حذف خودکار." },
  sample: {
    label: "مسیر یک رأی؛ از لمس تا بررسی", notice: "نمونهٔ ساختگی · فقط خواندنی · نه فعالیت زنده", channel: "جمع کتاب‌خوانی", post: "در جلسهٔ بعدی کتاب‌خوانی دربارهٔ چه چیزی گفتگو کنیم؟",
    agree: "موافقم", useful: "مفید بود", question: "سؤال دارم", gate: "قوانین رأی‌گیری شما", member: "عضویت بررسی شد", verified: "شروع خصوصی بات بررسی شد", waiting: "دورهٔ انتظار تمام شده",
    evidence: "الگویی برای بررسی", threshold: "۵ رأی‌اولی · ۹۰ ثانیه · یک پست", conclusion: "یک نشانهٔ زمانی، نه حکم.", review: "بررسی مدیر", decision: "هیچ عضوی حذف نشده", history: "هر اقدام مدیر همراه با دلیل ثبت می‌شود.",
  },
  mechanism: {
    eyebrow: "مرزی روشن. تصمیمی انسانی.", title: "گفتگو باز بماند. قانون دمِ در باشد.", body: "واکنش‌های بومی تلگرام قبل از دخالت بات ثبت می‌شوند. دربان به‌جای آن‌ها از دکمه‌های رأی کنترل‌شده استفاده می‌کند تا قوانین شما پیش از شمردن رأی بررسی شوند.", link: "دیدن مسیر کامل یک رأی",
    steps: [
      { title: "قوانین را مشخص کنید", body: "دورهٔ انتظار و نیاز به شروع خصوصی بات را برای رأی‌دهندگان تعیین کنید." },
      { title: "رأی واجد شرایط شمرده شود", body: "عضویت، وضعیت مسدودی، تأیید خصوصی و زمان ورودِ مشاهده‌شده مشخص می‌کنند که یک رأی پذیرفته شود یا نه." },
      { title: "شواهد را بررسی کنید", body: "تجمع رأی‌اولی‌ها هشدار می‌سازد. زمان‌بندی را می‌بینید و تصمیم می‌گیرید آیا اقدامی لازم است یا نه." },
    ],
  },
  safety: { eyebrow: "مرزی که از آن عبور نمی‌کنیم", title: "مدیریت رفتار؛ نه قضاوت عقاید.", body: "دربان هیچ عضوی را خودکار حذف نمی‌کند. هشدارها بر پایهٔ زمان‌بندی و سابقهٔ رأی‌اند، نه باورهای سیاسی، مذهبی یا شخصی. مسدودسازی فقط با اقدام صریح یک مدیر انسانی در همان چت انجام می‌شود.", aside: "هشدار، دلیلی برای دقیق‌تر دیدن است؛ نه اثبات هماهنگی." },
  features: {
    eyebrow: "نگاهی به سازوکار", title: "هر قانون، دلیلی دارد. هر اقدام، مسئولی.", body: "از اولین لمس تا سوابق بررسی، ببینید دربان کجا عمل می‌کند و تصمیم کجا با شماست.",
    rows: [
      { title: "بررسی، پیش از شمارش", body: "دکمه‌های رأی کنترل‌شده، عضویت فعلی، مسدودی و شروط فعال شما را بررسی می‌کنند. اگر رأی پذیرفته نشود، دلیل به کاربر گفته می‌شود؛ بی‌صدا ناپدید نمی‌شود.", label: "مسیر رأی", detail: "عضویت ← شروط رأی ← ثبت رأی" },
      { title: "به تازه‌واردها زمان بدهید", body: "انتظار را بین ۰ تا ۱۶۸ ساعت تنظیم کنید. این شرط فقط وقتی اعمال می‌شود که بات ورود را دیده باشد. اعضای بدون تاریخ ورود مشاهده‌شده معطل نمی‌شوند؛ ورود دوباره زمان را از نو آغاز می‌کند.", label: "دورهٔ انتظار", detail: "فقط ورودهای مشاهده‌شده" },
      { title: "شروع خصوصی، نه احراز هویت", body: "می‌توانید پیش از رأی دادن، تعامل خصوصی با دستور /start را الزامی کنید. این فقط تعامل با بات را تأیید می‌کند؛ نه هویت شخص یا سن حساب او را.", label: "تأیید تعامل", detail: "شروع بات ≠ اثبات هویت" },
      { title: "نشانه را در بسترش بخوانید", body: "پنج رأی‌دهندهٔ متمایز که اولین رأی خود در چت را ظرف ۹۰ ثانیه به یک پست بدهند، یک تصویر ثابت از هشدار می‌سازند. قبل از تصمیم، زمان و سابقه را ببینید. ارسال خصوصی هشدار تضمین‌شده نیست؛ مرجع اصلی پنل است.", label: "آستانهٔ بررسی", detail: "۵ رأی‌اولی / ۹۰ ثانیه" },
      { title: "مسئولیت، روشن بماند", body: "انتشار، مسدودسازی، رفع مسدودیت، تنظیمات و همگام‌سازی با عامل، دلیل و نتیجه ثبت می‌شوند. نتیجهٔ نامطمئن برای پیگیری دستی، نامشخص می‌ماند؛ موفقیت حدس زده نمی‌شود.", label: "سوابق عملیات", detail: "عامل · دلیل · نتیجه" },
      { title: "کنترل نظرها، فقط با انتخاب شما", body: "یک قانون اختیاری، نظرهای داخل دورهٔ انتظار را در گروه گفتگوی ثبت‌شده و متصل حذف می‌کند. این اقدام روی پیام است و مدیر آن را فعال می‌کند؛ حذف خودکار عضو نیست.", label: "کنترل اختیاری نظرها", detail: "فقط با فعال‌سازی صریح مدیر" },
    ],
  },
  limits: { eyebrow: "محدودیت‌ها را بشناسید", title: "همراه تلگرام؛ صادق دربارهٔ مرزهایش.", body: "رابط بات تلگرام، تاریخ ساخت حساب یا فهرست کامل مشترکان را نمی‌دهد. دربان پروفایل‌ها را جمع‌آوری نمی‌کند، هویت را حدس نمی‌زند و از MTProto استفاده نمی‌کند. تاریخ ورود فقط برای تغییرات عضویتی ثبت می‌شود که بات واقعاً دیده باشد.", native: "واکنش‌های بومی تلگرام را باید دستی غیرفعال کنید. برای دکمه‌های رأی کنترل‌شده، از دربان منتشر کنید؛ واکنش‌های بومی قبلی را نمی‌توان به‌صورت گذشته‌نگر کنترل کرد." },
  pricing: {
    eyebrow: "تعرفهٔ ساده. شرایط روشن.", title: "طرحی برای فصل بعدی جمع شما.", body: "رایگان یا حرفه‌ای را انتخاب کنید. پیش از درخواست طرح، مبلغ و شرایط تمدید را ببینید.", monthly: "ماهانه", annual: "سالانه", interval: "دورهٔ پرداخت", free: "رایگان", pro: "حرفه‌ای", choose: "انتخاب طرح", unavailable: "فعلاً در دسترس نیست",
    perMonth: "در ماه", perYear: "در سال", firstYear: "برای سال اول", then: "سپس", renewal: "در سال هنگام تمدید", noCharge: "بدون هزینهٔ اشتراک",
    pending: "محدودیت‌ها و امکانات اختصاصی هر طرح در حال نهایی‌شدن است.", payment: "پرداخت آنلاین هنوز پیکربندی نشده است. انتخاب طرح، صفحهٔ اشتراک شما را باز می‌کند؛ مبلغی دریافت نمی‌شود و دسترسی پولی فعال نمی‌شود.", reference: "به‌روزرسانی تعرفه‌ها ممکن نشد. این مبالغ مرجع هستند، نه تعرفهٔ زنده. دسترس‌پذیری را در صفحهٔ اشتراک بررسی کنید.", defaults: "تعرفه‌های پیش‌فرض منتشرشده نمایش داده می‌شوند. دسترس‌پذیری در صفحهٔ اشتراک تأیید می‌شود.", currency: "همهٔ مبالغ به دلار آمریکا (USD) هستند.", configured: "جزئیات تنظیم‌شدهٔ طرح", terms: "سال اول، بدون حساب‌وکتاب پنهان.", termsBody: "مبلغ معرفیِ سالانه فقط برای سال اول است. تعرفهٔ عادی تمدید سالانه کنار آن نمایش داده می‌شود. پرداخت ماهانه شامل تخفیف معرفیِ سالانه نیست.",
  },
  guide: {
    eyebrow: "راهنمای راه‌اندازی", title: "از همان ابتدا، قانون را روشن کنید.", body: "مسیر عملی اتصال جمع شما و انتشار اولین رأی‌گیری کنترل‌شده.", before: "پیش از اتصال", beforeBody: "به حساب مجاز دربان و دسترسی فعلی مدیریت چت در تلگرام نیاز دارید. بات پیکربندی‌شده و وب‌هوک HTTPS باید از قبل روی سرویس آماده باشند.",
    steps: [
      { title: "وارد شوید و چت را متصل کنید", body: "با تلگرام وارد شوید. بات تنظیم‌شده را با مجوزهای لازم برای انتشار، محدودکردن اعضا و حذف پیام مدیر کنید. چت را در پنل ثبت کنید؛ دسترسی شما با وضعیت فعلی مدیریت در تلگرام بررسی می‌شود." },
      { title: "واکنش‌های بومی را جایگزین کنید", body: "در تنظیمات کانال در تلگرام، واکنش‌های بومی را دستی غیرفعال کنید. دربان دکمه‌های رأی خودش را کنترل می‌کند، نه واکنش‌های داخلی تلگرام را." },
      { title: "قوانین رأی‌گیری را انتخاب کنید", body: "دورهٔ انتظار را بین ۰ تا ۱۶۸ ساعت تنظیم کنید و دربارهٔ الزام شروع خصوصی بات تصمیم بگیرید. قانون را به اعضا بگویید. انتظار فقط برای ورودهایی اعمال می‌شود که بات واقعاً دیده باشد." },
      { title: "گروه گفتگو را آماده کنید", body: "اگر گروه گفتگوی متصل دارید، پیش از پیوند دادن قانون آن به کانال، گروه را جداگانه ثبت کنید. حذف نظرهای دورهٔ انتظار را فقط در صورت نیاز به این قانونِ پیام‌محور فعال کنید." },
      { title: "از دربان منتشر کنید", body: "یک پست متنی از پنل منتشر کنید تا دکمه‌های رأی کنترل‌شده به آن متصل شوند. مدیران نیز بات را در گفتگوی خصوصی شروع کنند تا ارسال اعلان هشدار به آن‌ها ممکن باشد." },
      { title: "قبل از اقدام، بررسی کنید", body: "هشدارها را در پنل باز کنید و شواهد زمانی را ببینید. مسدودسازی اقدام صریح شماست و دلیل می‌خواهد. عملیات با نتیجهٔ نامشخص را بی‌بررسی تکرار نکنید؛ ابتدا نتیجه را تطبیق دهید. رفع مسدودیت، عضویت یا پیام‌های حذف‌شده را برنمی‌گرداند." },
    ],
    ready: "اول می‌خواهید نگاهی بیندازید؟", readyBody: "نسخهٔ نمایشی با داده‌های ساختگی کار می‌کند. اتصال تلگرام یا ورود لازم نیست.",
  },
  closing: { eyebrow: "اختیار این در با شماست", title: "جمع شما حرف بزند. حرف آخر با شما باشد.", body: "پیش از اتصال یک چت واقعی، مسیر کار را ببینید.", action: "بازکردن نمای فقط‌خواندنی" },
  footer: { description: "دربانی سنجیده برای کانال‌ها و گروه‌های تلگرام.", principle: "قانون دمِ در. اختیار دست آدم‌ها.", independent: "دربان محصولی مستقل است و وابسته به تلگرام نیست.", navigation: "آشنایی با دربان" },
};

export const marketingCopy: Record<Locale, MarketingCopy> = { fa, en };

export function pricePresentation(
  plan: Pick<PlanConfig, "monthlyCents" | "annualCents" | "introAnnualCents">,
  interval: "monthly" | "annual",
) {
  const renewalCents = interval === "monthly" ? plan.monthlyCents : plan.annualCents;
  const initialCents = interval === "annual" ? (plan.introAnnualCents ?? renewalCents) : renewalCents;
  return { initialCents, renewalCents, introductory: initialCents < renewalCents, interval };
}
