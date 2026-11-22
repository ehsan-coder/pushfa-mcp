<div dir="rtl" lang="fa">

# MCP پوشفا

MCP رسمی پوشفا برای خواندن راهنمای نصب وب، اندروید و iOS و کار با وب‌سرویس‌های یک سرویس پوشفا. روی سیستم شما با <code dir="ltr">stdio</code> اجرا می‌شود و برای دریافت راهنما و عملیات سرویس به <code dir="ltr">pushfa.com</code> متصل می‌شود.

[بسته در npm](https://www.npmjs.com/package/pushfa-mcp) · [صفحهٔ نصب و دانلود](https://pushfa.com/mcp) · [مستندات فنی MCP](https://pushfa.com/index/doc/mcp)

## نصب

به Node.js نسخهٔ ۲۲ یا بالاتر و کلاینتی با پشتیبانی از MCP محلی نیاز دارید. برای اجرا از npm، این تنظیم را در کلاینت‌های دارای قالب <code dir="ltr">mcpServers</code> وارد کنید.

<div dir="ltr">

```json
{
  "mcpServers": {
    "pushfa": {
      "command": "npx",
      "args": ["-y", "pushfa-mcp"]
    }
  }
}
```

</div>

برای اجرا از GitHub، مقدار فیلد <code dir="ltr">args</code> را با آرایهٔ زیر جایگزین کنید.

<div dir="ltr">

```json
[
  "--yes",
  "--package=git+https://github.com/ehsan-coder/pushfa-mcp.git",
  "pushfa-mcp"
]
```

</div>

برای نصب دستی، [فایل یکپارچه](https://pushfa.com/downloads/pushfa-mcp.mjs) را بگیرید و در تنظیمات کلاینت، فرمان <code dir="ltr">node</code> و مسیر کامل فایل را وارد کنید. اگر مخزن را کلون یا ZIP آن را استخراج کرده‌اید، <code dir="ltr">node src/index.mjs</code> نیز از ریشهٔ پروژه اجرا می‌شود. اجرای کد به نصب وابستگی نیاز ندارد.

## کلیدها و دسترسی‌ها

برای خواندن راهنماها هیچ کلیدی لازم نیست. برای کار با سرویس، متغیرها را در بخش <code dir="ltr">env</code> تنظیمات محلی اتصال وارد کنید و اتصال را دوباره راه‌اندازی کنید.

| متغیر | کاربرد |
| --- | --- |
| <code dir="ltr">PUSHFA_API_PUBLIC_KEY</code> | کلید عمومی سرویس |
| <code dir="ltr">PUSHFA_API_PRIVATE_KEY</code> | کلید خصوصی همان سرویس |
| <code dir="ltr">PUSHFA_MCP_ENABLE_SEND</code> | مقدار رشته‌ای <code dir="ltr">true</code> برای فعال‌کردن ارسال |
| <code dir="ltr">PUSHFA_MCP_ENABLE_MANAGEMENT</code> | مقدار رشته‌ای <code dir="ltr">true</code> برای عملیات مدیریتی |

با هر دو کلید، ابزارهای استعلامِ وضعیت اعلان و اشتراک، Alias، براکت‌ها و اطلاعات تاپیک فعال می‌شوند. ابزارهای ارسال به شناسهٔ مخاطب، توکن FCM، Alias، Custom Alias و تاپیک، بسته به نوع اعلان و وب‌سرویس درخواستی، دسترسی ارسال را می‌خواهند. ابزارهای مدیریتی شامل تغییر Alias و براکت، عضویت تاپیک، کاربر آزمایشی و ثبت پروفایل و رویداد RetenX هستند.

دستیار ابتدا یک پیش‌نمایش با <code dir="ltr">pushfa_prepare_*</code> می‌گیرد. پس از تأیید شما، <code dir="ltr">pushfa_send_notification</code> ارسال را ثبت می‌کند و <code dir="ltr">pushfa_confirm_management</code> پیش‌نمایش مدیریتی را اجرا می‌کند. شناسهٔ پیش‌نمایش پنج دقیقه در همان پردازش معتبر است و فقط یک بار می‌توان برای اجرای عملیات از آن استفاده کرد. کلید خصوصی را در تنظیمات محلی نگه دارید. امکانات سرویس و هزینه‌ها طبق پلن و تعرفهٔ پوشفا محاسبه می‌شوند.

## نمونه درخواست

- «راهنمای Web Push پوشفا را بخوان و مراحل لازم برای نصب در این پروژه را انجام بده.»
- «وضعیت اعلان با شناسهٔ [شناسه] را بررسی کن و زمان تحویل یا کد خطا را بگو.»
- «برای کاربر با Alias [شناسه] اعلان آماده کن و پیش از ارسال پیش‌نمایش را نشان بده.»

## ساختار کد

| مسیر | مسئولیت |
| --- | --- |
| <code dir="ltr">src/index.mjs</code> | ورودی برنامه و پروتکل MCP روی stdin و stdout |
| <code dir="ltr">src/tools.mjs</code> و <code dir="ltr">src/schemas.mjs</code> | تعریف ابزارها و اعتبارسنجی ورودی |
| <code dir="ltr">src/client.mjs</code> و <code dir="ltr">src/config.mjs</code> | اتصال به API پوشفا و تنظیم دسترسی ابزارها |
| <code dir="ltr">src/guides.mjs</code> و <code dir="ltr">src/drafts.mjs</code> | خواندن راهنماها و مدیریت پیش‌نمایش‌های یک‌بارمصرف |
| <code dir="ltr">pushfa-mcp.mjs</code> | خروجی یکپارچه برای دانلود و اجرای مستقیم |

بعد از تغییر کد در <code dir="ltr">src/</code>، با <code dir="ltr">npm ci</code> و سپس <code dir="ltr">npm run build</code> فایل یکپارچه را دوباره تولید کنید.

## مجوز

کد این مخزن با [مجوز MIT](LICENSE) منتشر می‌شود.

</div>
