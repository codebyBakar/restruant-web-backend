const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

const currency = (n, symbol = "Rs.") => `${symbol} ${Number(n || 0).toLocaleString()}`;

const orderLabel = (type) => (type === "delivery" ? "Delivery" : "Pickup");

const escapeHTML = (s) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Direct order-tracking link (works without typing email, via access token)
const trackOrderUrl = (order) => {
  const base = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${base}/track?order=${encodeURIComponent(order?.orderNumber || "")}&token=${encodeURIComponent(order?.accessToken || "")}`;
};

// Button reused across confirmation + status emails
const trackButton = (order) =>
  `<a href="${trackOrderUrl(order)}" style="display:inline-block;padding:14px 30px;border-radius:999px;background:#c2410c;color:#fffdf8;font-weight:700;font-size:14.5px;text-decoration:none;">Track Order</a>`;

// Build plain-text order confirmation email body (fallback for clients without HTML)
const buildOrderConfirmationMessage = (order, siteName = "Pratha", symbol = "Rs.") => {
  const items = (order?.items || [])
    .map((i) => `${i.quantity}x ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""}`)
    .join("\n");

  return [
    `Thank you ${order?.customer?.name}!`,
    ``,
    `Your order has been confirmed.`,
    ``,
    `Order: ${order?.orderNumber}`,
    `Type: ${orderLabel(order?.orderType)}`,
    `Items:`,
    items || "—",
    `Subtotal: ${currency(order?.subtotal, symbol)}`,
    order?.deliveryFee ? `Delivery Fee: ${currency(order?.deliveryFee, symbol)}` : null,
    order?.tax ? `Tax: ${currency(order?.tax, symbol)}` : null,
    order?.discount ? `Discount: - ${currency(order?.discount, symbol)}` : null,
    `Total: ${currency(order?.total, symbol)}`,
    `Payment: ${order?.paymentMethod}`,
    ``,
    `We will notify you as soon as it's ready. Thank you for choosing ${siteName}!`,
  ]
    .filter(Boolean)
    .join("\n");
};

// Renders the site logo transparently or falls back to the brand name
const brandOrLogo = (logoUrl, brand) =>
  logoUrl
    ? `<img src="${escapeHTML(logoUrl)}" alt="${escapeHTML(brand)}" width="200" style="display:inline-block;max-width:200px;max-height:72px;width:auto;height:auto;"/>`
    : `<div style="font-family:'Fraunces',Georgia,serif;font-size:30px;color:#fbf3e6;font-weight:600;letter-spacing:0.02em;text-transform:lowercase;">${escapeHTML(brand)}</div>`;

// Build the HTML order confirmation email template
const buildOrderConfirmationHTML = (order, siteName = "Pratha", symbol = "Rs.", logoUrl = "") => {
  const brand = String(siteName || "Pratha").toLowerCase();

  // ---- Order details (label / value rows) ----
  const detailRow = (label, value) =>
    value
      ? `<tr>
        <td width="110" style="padding:6px 14px 6px 0;color:#6b5a4c;font-size:13px;vertical-align:top;white-space:nowrap;">${escapeHTML(label)}</td>
        <td style="padding:6px 0;color:#2f2117;font-size:14.5px;font-weight:600;line-height:1.5;word-break:break-word;">${escapeHTML(value)}</td>
      </tr>`
      : "";

  const detailRows = [
    detailRow("Order", `#${order?.orderNumber}`),
    detailRow("Customer", order?.customer?.name),
    detailRow("Type", orderLabel(order?.orderType)),
    detailRow("Payment", order?.paymentMethod === "online" ? "Online" : "Cash on delivery"),
    detailRow("Phone", order?.customer?.phone),
  ].join("");

  // ---- Delivery address card (only for delivery orders) ----
  const addr = order?.deliveryAddress || {};
  const addressLines = [addr.line1, addr.area, addr.city].filter(Boolean).join(", ");
  const deliveryCard = order?.orderType === "delivery" && addressLines
    ? `<tr>
        <td style="padding:20px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid rgba(47,33,23,0.08);">
            <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c2410c;font-weight:800;; padding:10px 18px;">Delivery Address</div>

            <tr>
              <td style="padding:14px 18px;padding-top:0;">
                <div style="font-size:15px;color:#2f2117;font-weight:600;line-height:1.6;">${escapeHTML(addressLines)}</div>
                ${addr.instructions ? `<div style="margin-top:6px;font-size:13.5px;color:#6b5a4c;line-height:1.5;"><strong style="color:#2f2117;">Note:</strong> ${escapeHTML(addr.instructions)}</div>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  // ---- Items (long names wrap, price pinned right) ----
  const items = (order?.items || []).map((i, idx) => {
    const isLast = idx === (order?.items?.length || 0) - 1;
    const border = isLast ? "" : "border-bottom:1px solid rgba(47,33,23,0.08);";
    const label = i.variantLabel ? `<div style="font-size:12.5px;color:#6b5a4c;margin-top:2px;">${escapeHTML(i.variantLabel)}</div>` : "";
    const notes = i.specialInstructions ? `<div style="font-size:12px;color:#6b5a4c;margin-top:3px;font-style:italic;">Note: ${escapeHTML(i.specialInstructions)}</div>` : "";
    return `<tr>
      <td style="padding:11px 10px 11px 0;${border}vertical-align:top;">
        <div style="font-size:14.5px;color:#2f2117;font-weight:600;line-height:1.45;word-break:break-word;">${i.quantity}× ${escapeHTML(i.name)}</div>
        ${label}${notes}
      </td>
      <td style="padding:11px 0 11px 10px;${border}vertical-align:top;text-align:right;white-space:nowrap;color:#2f2117;font-size:14.5px;font-weight:600;">${currency(i.lineTotal, symbol)}</td>
    </tr>`;
  }).join("");

  // ---- Totals ----
  const rows = [];
  rows.push(`<tr><td style="padding:9px 0;color:#6b5a4c;font-size:13.5px;">Subtotal</td><td style="padding:9px 0;text-align:right;color:#2f2117;font-size:13.5px;">${currency(order?.subtotal, symbol)}</td></tr>`);
  if (order?.deliveryFee) rows.push(`<tr><td style="padding:9px 0;color:#6b5a4c;font-size:13.5px;">Delivery Fee</td><td style="padding:9px 0;text-align:right;color:#2f2117;font-size:13.5px;">${currency(order?.deliveryFee, symbol)}</td></tr>`);
  if (order?.tax) rows.push(`<tr><td style="padding:9px 0;color:#6b5a4c;font-size:13.5px;">Tax</td><td style="padding:9px 0;text-align:right;color:#2f2117;font-size:13.5px;">${currency(order?.tax, symbol)}</td></tr>`);
  if (order?.discount) rows.push(`<tr><td style="padding:9px 0;color:#6b5a4c;font-size:13.5px;">Discount</td><td style="padding:9px 0;text-align:right;color:#4b7b5b;font-size:13.5px;">− ${currency(order?.discount, symbol)}</td></tr>`);
  rows.push(`<tr><td style="padding:12px 0 0;border-top:2px solid #f3e6d2;color:#2f2117;font-size:15px;font-weight:800;">Total</td><td style="padding:12px 0 0;border-top:2px solid #f3e6d2;text-align:right;color:#c2410c;font-size:18px;font-weight:800;white-space:nowrap;">${currency(order?.total, symbol)}</td></tr>`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>Order Confirmation</title>
<style>
@media only screen and (max-width:480px){
  .wrap{ padding-left:12px !important; padding-right:12px !important; }
  .card-pad{ padding-left:14px !important; padding-right:14px !important; }
  .head-pad{ padding-left:20px !important; padding-right:20px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#f3e6d2;font-family:'Manrope',-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="wrap" style="background:#f3e6d2;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fbf3e6;border-radius:22px;border:1px solid rgba(47,33,23,0.08);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td class="head-pad" style="background:#211711;padding:30px 36px 28px;text-align:center;">
              ${brandOrLogo(logoUrl, brand)}
              <div style="margin-top:6px;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#e3a008;font-weight:700;">Order Confirmed</div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td class="head-pad" style="padding:32px 36px 6px;">
              <div style="font-family:'Fraunces',Georgia,serif;font-size:22px;color:#2f2117;font-weight:600;">Thank you, ${escapeHTML(order?.customer?.name)}!</div>
              <div style="margin-top:8px;font-size:15px;color:#6b5a4c;line-height:1.6;">Your order has been confirmed and is being prepared with care. Here are the details:</div>
            </td>
          </tr>

          <!-- Order summary card -->
          <tr>
            <td class="head-pad" style="padding:22px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid rgba(47,33,23,0.08);">
                <tr>
                  <td class="card-pad" style="padding:18px 20px 14px;border-bottom:1px solid rgba(47,33,23,0.08);">
                    <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c2410c;font-weight:800;margin-bottom:8px;">Order Details</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${detailRows}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="card-pad" style="padding:16px 20px 20px;">
                    <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c2410c;font-weight:800;margin-bottom:4px;">Your Order</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${items}
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
                      ${rows.join("")}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${deliveryCard}

          <!-- Track order -->
          <tr>
            <td class="head-pad" style="padding:26px 36px 0;text-align:center;">
              <div style="font-size:13.5px;color:#6b5a4c;line-height:1.6;margin-bottom:14px;">Want to follow your order in real time? Track it anytime with one tap.</div>
              ${trackButton(order)}
            </td>
          </tr>

          <!-- Footer note -->
          <tr>
            <td class="head-pad" style="padding:24px 36px 8px;">
              <div style="display:block;margin:0 auto;width:96px;height:3px;border-radius:99px;background:#e3a008;margin-bottom:18px;"></div>
              <div style="text-align:center;font-size:14px;color:#2f2117;line-height:1.7;">We will notify you as soon as it's ready.<br/>Thank you for choosing <strong>${escapeHTML(siteName)}</strong>!</div>
            </td>
          </tr>

          <tr>
            <td class="head-pad" style="padding:14px 36px 26px;text-align:center;border-top:1px solid rgba(47,33,23,0.08);">
              <div style="font-size:12px;color:#6b5a4c;line-height:1.7;">This is a system-generated email. For any queries,<br/>reply to this email and we'll help you right away.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// Send order confirmation email to the customer
const sendOrderConfirmationEmail = async (order, siteName = "Pratha", symbol = "Rs.", logoUrl = "") => {
  const to = order?.customer?.email;
  const from = process.env.SMTP_FROM || `${siteName} <${process.env.SMTP_USER || "no-reply@pratha.com"}>`;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[Email] Skipped: SMTP credentials not configured.");
    return { ok: false, skipped: true };
  }
  if (!to) {
    console.warn("[Email] Skipped: customer email missing.");
    return { ok: false, skipped: true };
  }

  try {
    const info = await getTransporter().sendMail({
      from,
      to,
      subject: `Order ${order?.orderNumber} confirmed - Thank you ${order?.customer?.name}!`,
      text: buildOrderConfirmationMessage(order, siteName, symbol),
      html: buildOrderConfirmationHTML(order, siteName, symbol, logoUrl),
    });
    console.log("[Email] Order confirmation sent to", to, info.messageId || "");
    return { ok: true, info };
  } catch (err) {
    console.error("[Email] Send failed:", err.message || err);
    return { ok: false, error: err };
  }
};

// ---- Shared send helper ---------------------------------------------------
// Send an email when SMTP is configured; logs and never throws.
const deliver = async ({ order, siteName = "Pratha", symbol = "Rs.", subject, text, html }) => {
  const to = order?.customer?.email;
  const from = process.env.SMTP_FROM || `${siteName} <${process.env.SMTP_USER || "no-reply@pratha.com"}>`;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[Email] Skipped: SMTP credentials not configured.");
    return { ok: false, skipped: true };
  }
  if (!to) {
    console.warn("[Email] Skipped: customer email missing.");
    return { ok: false, skipped: true };
  }

  try {
    const info = await getTransporter().sendMail({ from, to, subject, text, html });
    console.log("[Email] Sent to", to, info.messageId || "");
    return { ok: true, info };
  } catch (err) {
    console.error("[Email] Send failed:", err.message || err);
    return { ok: false, error: err };
  }
};

// ---- Reusable theme shell -----------------------------------------------------
const emailShell = ({ siteName, headLabel, body, logoUrl = "" }) => {
  const brand = String(siteName || "Pratha").toLowerCase();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>${escapeHTML(headLabel)}</title>
<style>
@media only screen and (max-width:480px){
  .wrap{ padding-left:12px !important; padding-right:12px !important; }
  .card-pad{ padding-left:14px !important; padding-right:14px !important; }
  .head-pad{ padding-left:20px !important; padding-right:20px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#f3e6d2;font-family:'Manrope',-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="wrap" style="background:#f3e6d2;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fbf3e6;border-radius:22px;border:1px solid rgba(47,33,23,0.08);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td class="head-pad" style="background:#211711;padding:30px 36px 28px;text-align:center;">
              ${brandOrLogo(logoUrl, brand)}
              <div style="margin-top:6px;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#e3a008;font-weight:700;">${escapeHTML(headLabel)}</div>
            </td>
          </tr>

          ${body}

          <!-- Footer note -->
          <tr>
            <td class="head-pad" style="padding:26px 36px 8px;">
              <div style="display:block;margin:0 auto;width:96px;height:3px;border-radius:99px;background:#e3a008;margin-bottom:18px;"></div>
              <div style="text-align:center;font-size:14px;color:#2f2117;line-height:1.7;">We will notify you as soon as it's ready.<br/>Thank you for choosing <strong>${escapeHTML(siteName)}</strong>!</div>
            </td>
          </tr>

          <tr>
            <td class="head-pad" style="padding:14px 36px 26px;text-align:center;border-top:1px solid rgba(47,33,23,0.08);">
              <div style="font-size:12px;color:#6b5a4c;line-height:1.7;">This is a system-generated email. For any queries,<br/>reply to this email and we'll help you right away.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// ---- Status update email (simple) -------------------------------------------
// Status translations for the concise "Order update" email.
const STATUS_META = {
  out_for_delivery: {
    badge: "Out for Delivery",
    title: "Your order is on its way!",
    message: "We've handed your order to our rider. Sit back and relax, it will reach you shortly.",
    intro: "Great news!",
  },
  ready_for_pickup: {
    badge: "Ready for Pickup",
    title: "Your order is ready for pickup!",
    message: "Your order is ready. Please come to our counter to pick it up. We'd love to hand it over personally.",
    intro: "Great news!",
  },
};

const buildOrderStatusHTML = (order, statusType, siteName = "Pratha", symbol = "Rs.", logoUrl = "") => {
  const meta = STATUS_META[statusType] || { badge: "Order Update", title: "Your order status has changed", message: "", intro: "" };
  const statusCard = meta.badge === "Out for Delivery" || statusType === "out_for_delivery"
    ? `<div style="background:linear-gradient(135deg,#c2410c,#9a3410);padding:2px;border-radius:99px;margin:0 auto 18px;"><div style="background:#e7e6e6;padding:12px 22px;border-radius:96px;font-size:16px;color:#c2410c;font-weight:800;letter-spacing:0.02em;text-align:center;">${escapeHTML(meta.badge)}</div></div>`
    : `<div style="background:#fff;border:1px solid #e3a008;padding:13px 22px;border-radius:999px;display:inline-block;font-size:16px;color:#8a5f02;font-weight:800;letter-spacing:0.02em;">${escapeHTML(meta.badge)}</div>`;

  const body = `
          <!-- Greeting -->
          <tr>
            <td class="head-pad" style="padding:32px 36px 6px;text-align:center;">
              <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c2410c;font-weight:800;">${escapeHTML(meta.intro)}</div>
              <div style="margin-top:10px;font-family:'Fraunces',Georgia,serif;font-size:22px;color:#2f2117;font-weight:600;">${escapeHTML(meta.title)}</div>
              <div style="margin-top:6px;font-size:14px;color:#6b5a4c;line-height:1.6;">${escapeHTML(meta.message)}</div>
              <div style="margin-top:16px;">${statusCard}</div>
            </td>
          </tr>

          <!-- Order info -->
          <tr>
            <td class="head-pad" style="padding:22px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid rgba(47,33,23,0.08);">
                <tr>
                  <td class="card-pad" style="padding:16px 20px;border-bottom:1px solid rgba(47,33,23,0.08);">
                    <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c2410c;font-weight:800;margin-bottom:8px;">Order #${escapeHTML(order?.orderNumber)}</div>
                    <div style="font-size:14.5px;color:#2f2117;font-weight:600;">Your order</div>
                    <div style="margin-top:2px;font-size:13px;color:#6b5a4c;">${escapeHTML(order?.paymentMethod === "online" ? "Online payment" : "Cash on " + (order?.orderType === "delivery" ? "delivery" : "collection"))}</div>
                  </td>
                </tr>
                <tr>
                  <td class="card-pad" style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:14px;color:#2f2117;font-weight:700;">Order Total</span>
                    <span style="font-size:20px;color:#c2410c;font-weight:800;white-space:nowrap;">${currency(order?.total, symbol)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Track order -->
          <tr>
            <td class="head-pad" style="padding:24px 36px 0;text-align:center;">
              ${trackButton(order)}
            </td>
          </tr>`;

  return emailShell({ siteName, headLabel: "Order Update", body, logoUrl });
};

const buildOrderCompletionHTML = (order, siteName = "Pratha", symbol = "Rs.", logoUrl = "") => {
  const siteUrl = process.env.CLIENT_URL || "https://pratha.com";
  const completed = order?.orderType === "delivery" ? "delivered" : "picked up";
  const icon = "✓";

  const body = `
          <!-- Greeting -->
          <tr>
            <td class="head-pad" style="padding:32px 36px 4px;text-align:center;">
              <div style="margin:0 auto;width:60px;height:60px;border-radius:50%;background:#4b7b5b;color:#fbf3e6;font-size:28px;line-height:60px;font-weight:800;">${icon}</div>
              <div style="margin-top:14px;font-family:'Fraunces',Georgia,serif;font-size:22px;color:#2f2117;font-weight:600;">Your order is complete!</div>
              <div style="margin-top:6px;font-size:14px;color:#6b5a4c;line-height:1.6;">Your order <strong style="color:#2f2117;">#${escapeHTML(order?.orderNumber)}</strong> has been ${escapeHTML(completed)}. Thank you for choosing us!</div>
            </td>
          </tr>

          <!-- Order total -->
          <tr>
            <td class="head-pad" style="padding:22px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid rgba(47,33,23,0.08);">
                <tr>
                  <td class="card-pad" style="padding:18px 20px;text-align:center;">
                    <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#c2410c;font-weight:800;margin-bottom:6px;">Order Total</div>
                    <div style="font-size:28px;color:#2f2117;font-weight:800;">${currency(order?.total, symbol)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order more -->
          <tr>
            <td class="head-pad" style="padding:26px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3e6d2;border-radius:14px;border:1px solid rgba(47,33,23,0.08);">
                <tr>
                  <td class="card-pad" style="padding:26px 24px;text-align:center;">
                    <div style="font-family:'Fraunces',Georgia,serif;font-size:19px;color:#2f2117;font-weight:600;margin-bottom:6px;">Craving something more?</div>
                    <div style="font-size:14px;color:#6b5a4c;line-height:1.6;margin-bottom:16px;">Satisfy your taste buds with our fresh menu — order something new right now.</div>
                    <a href="${siteUrl}/menu" style="display:inline-block;padding:14px 30px;border-radius:999px;background:#c2410c;color:#fffdf8;font-weight:700;font-size:14.5px;text-decoration:none;">Order More</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

  return emailShell({ siteName, headLabel: "Order Complete", body, logoUrl });
};

// Send order update status email
const sendOrderStatusEmail = async (order, status = "out_for_delivery", siteName = "Pratha", symbol = "Rs.", logoUrl = "") => {
  const meta = STATUS_META[status] || {};
  return deliver({
    order,
    siteName,
    symbol,
    subject: `${meta.badge || "Order Update"} - Order ${order?.orderNumber}`,
    text: `${meta.title || "Order update"}\n\nOrder: ${order?.orderNumber}\nTotal: ${currency(order?.total, symbol)}\n\nThank you for choosing ${siteName}!`,
    html: buildOrderStatusHTML(order, status, siteName, symbol, logoUrl),
  });
};

// Send order-completion email
const sendOrderCompletionEmail = async (order, siteName = "Pratha", symbol = "Rs.", logoUrl = "") => {
  const completed = order?.orderType === "delivery" ? "delivered" : "picked up";
  return deliver({
    order,
    siteName,
    symbol,
    subject: `Your order ${order?.orderNumber} is complete - Thank you!`,
    text: `Your order ${order?.orderNumber} has been ${completed}.\nTotal: ${currency(order?.total, symbol)}\n\nCraving something more? Visit us again. Thank you for choosing ${siteName}!`,
    html: buildOrderCompletionHTML(order, siteName, symbol, logoUrl),
  });
};

// ---- Contact form emails --------------------------------------------------
// Generic send (throttle-free) that never throws.
const sendEmail = async ({ to, subject, text, html }) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[Contact] Skipped: SMTP credentials not configured.");
    return { ok: false, skipped: true };
  }
  if (!to) {
    console.warn("[Contact] Skipped: recipient email missing.");
    return { ok: false, skipped: true };
  }
  const from = process.env.SMTP_FROM || `Pratha <${process.env.SMTP_USER || "no-reply@pratha.com"}>`;

  try {
    const info = await getTransporter().sendMail({ from, to, subject, text, html });
    console.log("[Contact] Sent to", to, info.messageId || "");
    return { ok: true, info };
  } catch (err) {
    console.error("[Email] Send failed:", err.message || err);
    return { ok: false, error: err };
  }
};

const notifyDate = () =>
  new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Clean, minimal, single-column email shell.
const contactShell = ({ siteName, heading, intro, details, body, logoUrl }) => {
  const brand = String(siteName || "Pratha");
  const centered = Boolean(logoUrl);
  const brandBlock = logoUrl
    ? `<img src="${escapeHTML(logoUrl)}" alt="${escapeHTML(brand)}" width="170" style="display:inline-block;max-width:170px;max-height:64px;width:auto;height:auto;"/>`
    : `<div style="font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#c2410c;">${escapeHTML(brand)}</div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHTML(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid #e8e8e8;overflow:hidden;">

          <tr>
            <td style="padding:28px 32px 20px;text-align:${centered ? "center" : "left"};">
              ${centered ? `<div style="text-align:center;">${brandBlock}</div>` : brandBlock}
              <div style="margin-top:${centered ? "14px" : "6px"};font-size:20px;font-weight:600;color:#1a1a1a;line-height:1.35;">${escapeHTML(heading)}</div>
              ${intro ? `<div style="margin-top:8px;font-size:14px;color:#6b6b6b;line-height:1.6;">${intro}</div>` : ""}
            </td>
          </tr>

          ${details || ""}

          ${body}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const detailRow = (label, value) =>
  value
    ? `<tr>
        <td width="110" style="padding:5px 0;color:#9a9a9a;font-size:12.5px;vertical-align:top;">${escapeHTML(label)}</td>
        <td style="padding:5px 0;color:#1a1a1a;font-size:13.5px;line-height:1.5;word-break:break-word;">${escapeHTML(value)}</td>
      </tr>`
    : "";

const contactDetails = (contact) => {
  const rows = [
    detailRow("Name", contact?.name),
    detailRow("Email", contact?.email),
    detailRow("Phone", contact?.phone),
    detailRow("Subject", contact?.subject),
  ].join("");

  return `
          <tr>
            <td style="padding:0 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border:1px solid #eeeeee;border-radius:8px;padding:15px;">
                <tr>
                  <td style="padding:16px;">${rows}</td>
                </tr>
              </table>
            </td>
          </tr>`;
};

const contactMessageBlock = (contact) => `
          <tr>
            <td style="padding:22px 30px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9a9a9a;padding-bottom:6px;"> Message</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#1a1a1a;line-height:1.7;white-space:pre-line;word-break:break-word;border-left:3px solid #c2410c;padding:4px 0 4px 14px;">${escapeHTML(contact?.message)}</td>
                </tr>
              </table>
            </td>
          </tr>`;

// Acknowledgement email for the person submitting the contact form
const sendContactAckEmail = async (contact, siteName = "Pratha", logoUrl = "") => {
  const text = `Hi ${contact.name},\n\nWe've received your message and our team will get back to you as soon as possible.\n\nHere is a copy of what you sent us:\n${contact.subject ? `Subject: ${contact.subject}\n` : ""}${contact.message}\n\nThank you for reaching out — ${siteName}!`;

  return sendEmail({
    to: contact?.email,
    subject: "We received your message",
    text,
    html: contactShell({
      siteName,
      logoUrl,
      heading: `Hi ${contact?.name} — message received`,
      intro: `Thank you for writing to ${siteName}. We've received your message and will get back to you as soon as possible.`,
      body: contactMessageBlock(contact),
    }),
  });
};

// Admin notification email for a new contact submission
const sendContactAdminEmail = async (contact, siteName = "Pratha", adminTo) => {
  return sendEmail({
    to: adminTo,
    subject: `New message from ${contact?.name}`,
    text: `New contact form submission on ${siteName}\n\nName: ${contact?.name}\nEmail: ${contact?.email}\nPhone: ${contact?.phone || "—"}\nSubject: ${contact?.subject || "—"}\n\nMessage:\n${contact?.message}`,
    html: contactShell({
      siteName,
      heading: "New contact message",
      intro: `${escapeHTML(contact?.name)} just submitted a message through the contact page.`,
      details: contactDetails(contact),
      body: `
          ${contactMessageBlock(contact)}
          <tr>
            <td style="padding:26px 30px 0;">
              <a href="mailto:${escapeHTML(contact?.email)}?subject=${encodeURIComponent("Re: " + (contact?.subject || "Your message to " + siteName))}" style="display:inline-block;padding:11px 22px;border-radius:8px;background-color:#c2410c;color:#ffffff;font-size:13.5px;font-weight:600;text-decoration:none;">Reply to ${escapeHTML(contact?.name)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px;">
              <div style="font-size:12px;color:#9a9a9a;">Received ${escapeHTML(notifyDate())}.</div>
            </td>
          </tr>`,
    }),
  });
};

module.exports = {
  buildOrderConfirmationMessage,
  buildOrderConfirmationHTML,
  sendOrderConfirmationEmail,
  buildOrderStatusHTML,
  sendOrderStatusEmail,
  buildOrderCompletionHTML,
  sendOrderCompletionEmail,
  sendContactAckEmail,
  sendContactAdminEmail,
};
