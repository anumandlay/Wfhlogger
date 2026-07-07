import nodemailer from 'nodemailer';
import fs from 'fs'
import path from 'path'

// Use environment variables for credentials
// In development, you can use Ethereal (https://ethereal.email) if no Gmail credentials provided
const config = process.env.EMAIL_HOST ? {
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
} : {
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
};

const transporter = nodemailer.createTransport(config);

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.warn('[Email] Connection warning:', error.message);
  } else {
    console.log('[Email] Server is ready to take our messages');
  }
});

function slugifyName(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function normalizeAppUrl(raw) {
  const s = String(raw || '').trim()
  if (!s) return 'http://localhost:5173'
  return s.endsWith('/') ? s.slice(0, -1) : s
}

function tenantUrl(companyName, routePath) {
  const base = normalizeAppUrl(process.env.APP_URL || 'http://localhost:5173')
  const slug = slugifyName(companyName || 'company') || 'company'
  const rp = String(routePath || '/').startsWith('/') ? String(routePath || '/') : `/${routePath}`
  return `${base}/${slug}${rp}`
}

function buildTenantLogoAttachment(companyLogoUrl) {
  try {
    const raw = String(companyLogoUrl || '').trim()
    if (!raw) return null
    if (raw.startsWith('http://') || raw.startsWith('https://')) return null
    const rel = raw.replace(/^\//, '')
    const abs = path.resolve(process.cwd(), rel)
    if (!fs.existsSync(abs)) return null
    const stat = fs.statSync(abs)
    if (!stat.isFile() || stat.size <= 0 || stat.size > 1_500_000) return null
    return { filename: path.basename(abs), path: abs, cid: 'tenant-logo' }
  } catch {
    return null
  }
}

function renderEmail({ companyName, companyId, companyLogoUrl, preheader, title, tone = 'blue', blocks = [], cta }) {
  const safeCompanyName = escapeHtml(companyName || 'Your Company')
  const brand = escapeHtml(process.env.EMAIL_BRAND_NAME || 'Time Tracker')
  const toneMap = {
    blue: { bar: '#2563EB', soft: '#EFF6FF', text: '#1D4ED8' },
    emerald: { bar: '#059669', soft: '#ECFDF5', text: '#047857' },
    amber: { bar: '#D97706', soft: '#FFFBEB', text: '#B45309' },
    rose: { bar: '#E11D48', soft: '#FFF1F2', text: '#BE123C' },
    slate: { bar: '#334155', soft: '#F1F5F9', text: '#0F172A' },
  }
  const t = toneMap[tone] || toneMap.blue
  const att = buildTenantLogoAttachment(companyLogoUrl)
  const logoHtml = att
    ? `<img src="cid:tenant-logo" width="36" height="36" style="display:block;border-radius:10px;border:1px solid #E2E8F0;object-fit:cover;" alt="${safeCompanyName}" />`
    : `<div style="width:36px;height:36px;border-radius:10px;border:1px solid #E2E8F0;background:${t.soft};color:${t.text};display:flex;align-items:center;justify-content:center;font-weight:800;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">${escapeHtml((companyName || 'C').trim().slice(0, 1).toUpperCase())}</div>`

  const pre = preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>` : ''
  const bodyBlocks = blocks.map(b => `<div style="margin-top:14px;color:#334155;font-size:14px;line-height:20px;">${b}</div>`).join('')

  const ctaHtml = cta?.url && cta?.label ? `
    <div style="margin-top:18px;">
      <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:12px 16px;background:${t.bar};color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">${escapeHtml(cta.label)}</a>
    </div>
  ` : ''

  const html = `
    ${pre}
    <div style="background:#F1F5F9;padding:24px 12px;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="background:#fff;border-radius:18px;border:1px solid #E2E8F0;overflow:hidden;">
          <div style="height:6px;background:${t.bar};"></div>
          <div style="padding:20px 20px 12px 20px;">
            <div style="display:flex;align-items:center;gap:12px;">
              ${logoHtml}
              <div style="min-width:0;">
                <div style="font-size:14px;font-weight:800;color:#0F172A;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">${safeCompanyName}</div>
                <div style="margin-top:2px;font-size:12px;color:#64748B;">${brand}${companyId != null ? ` • Tenant #${escapeHtml(companyId)}` : ''}</div>
              </div>
            </div>
            <div style="margin-top:16px;background:${t.soft};border:1px solid #E2E8F0;border-radius:14px;padding:14px;">
              <div style="font-size:16px;font-weight:900;color:#0F172A;">${escapeHtml(title || 'Notification')}</div>
              ${bodyBlocks}
              ${ctaHtml}
            </div>
          </div>
          <div style="padding:14px 20px 18px 20px;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px;line-height:18px;">
            <div>Need help? Contact ${escapeHtml(process.env.SUPPORT_EMAIL || 'support@timetracker.com')}.</div>
            <div style="margin-top:6px;">This is an automated message. Please do not reply.</div>
          </div>
        </div>
      </div>
    </div>
  `

  const attachments = att ? [att] : []
  return { html, attachments }
}

export async function sendEmail(to, subject, text, html, extra = {}) {
  // If no credentials, log and return
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER.includes('example.com')) {
    console.log('[Email] Mock send (No credentials):', { to, subject });
    return true;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Time Tracker" <noreply@timetracker.com>',
      to,
      subject,
      text,
      html: html || text,
      ...(extra || {})
    });
    console.log('[Email] Sent:', info.messageId);
    return true;
  } catch (error) {
    // Auth errors: log details and throw so callers can detect failure
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      console.error('[Email] Authentication Failed. Check EMAIL_USER, EMAIL_PASS, and domain verification.');
      console.error('[Email] Original error:', error.message);
      console.log('   --- Email content (not sent) ---');
      console.log(`   To: ${to}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Body: ${text}`);
      console.log('   ---------------------------------');
      throw new Error(`Email auth failed: ${error.message}`);
    }
    
    console.error('[Email] Send failed:', error.message);
    throw error;
  }
}

export function sendLowCreditWarning(toOrPayload, balanceLegacy) {
  const payload = typeof toOrPayload === 'object' && toOrPayload
    ? toOrPayload
    : { to: toOrPayload, balance: balanceLegacy }
  const to = payload.to
  const balance = Number(payload.balance || 0)
  const companyName = payload.companyName || payload.company?.name || ''
  const companyId = payload.companyId ?? payload.company?.id
  const companyLogoUrl = payload.companyLogoUrl || payload.company?.logo_url || ''
  const billingUrl = payload.billingUrl || tenantUrl(companyName, '/billing')
  const subject = `Low credits: ${balance} remaining`
  const text = `Your credit balance is low (${balance} credits). Add credits to avoid service disruption.`
  const { html, attachments } = renderEmail({
    companyName,
    companyId,
    companyLogoUrl,
    title: 'Low credit balance',
    tone: 'amber',
    preheader: `Low credits: ${balance} remaining`,
    blocks: [
      `Your current balance is <strong>${escapeHtml(balance)}</strong> credits.`,
      `Add credits to ensure uninterrupted monitoring and reporting for your team.`,
    ],
    cta: { label: 'Add credits', url: billingUrl }
  })
  return sendEmail(to, subject, text, html, { attachments })
}

export function sendPaymentSuccess(toOrPayload, amountLegacy, creditsLegacy) {
  const payload = typeof toOrPayload === 'object' && toOrPayload
    ? toOrPayload
    : { to: toOrPayload, amount_usd: amountLegacy, credits: creditsLegacy }
  const to = payload.to
  const amountUsd = Number(payload.amount_usd ?? payload.amount ?? 0)
  const credits = Number(payload.credits ?? 0)
  const balance = payload.balance != null ? Number(payload.balance) : null
  const invoiceId = payload.invoice_id || payload.invoiceId || ''
  const ref = payload.payment_reference_id || payload.reference_id || payload.ref || ''
  const companyName = payload.companyName || payload.company?.name || ''
  const companyId = payload.companyId ?? payload.company?.id
  const companyLogoUrl = payload.companyLogoUrl || payload.company?.logo_url || ''
  const billingUrl = payload.billingUrl || tenantUrl(companyName, '/billing')
  const subject = `Payment received • $${amountUsd.toFixed(2)}`
  const text = `Payment received: $${amountUsd.toFixed(2)}. ${credits} credits added${balance != null ? ` (new balance: ${balance})` : ''}.`
  const blocks = [
    `We received your payment of <strong>$${escapeHtml(amountUsd.toFixed(2))}</strong>.`,
    `<strong>${escapeHtml(credits)}</strong> credits have been added to your account${balance != null ? ` (new balance: <strong>${escapeHtml(balance)}</strong>)` : ''}.`,
  ]
  if (invoiceId) blocks.push(`Invoice: <strong>${escapeHtml(invoiceId)}</strong>`)
  if (ref) blocks.push(`Transaction reference: <strong>${escapeHtml(ref)}</strong>`)
  const { html, attachments } = renderEmail({
    companyName,
    companyId,
    companyLogoUrl,
    title: 'Payment successful',
    tone: 'emerald',
    preheader: `Payment received: $${amountUsd.toFixed(2)}`,
    blocks,
    cta: { label: 'Open billing', url: billingUrl }
  })
  return sendEmail(to, subject, text, html, { attachments })
}

export function sendCreationBlocked(toOrPayload) {
  const payload = typeof toOrPayload === 'object' && toOrPayload ? toOrPayload : { to: toOrPayload }
  const to = payload.to
  const companyName = payload.companyName || payload.company?.name || ''
  const companyId = payload.companyId ?? payload.company?.id
  const companyLogoUrl = payload.companyLogoUrl || payload.company?.logo_url || ''
  const billingUrl = payload.billingUrl || tenantUrl(companyName, '/billing')
  const actor = payload.actor || ''
  const subject = 'Employee creation blocked (insufficient credits)'
  const text = 'Employee creation was blocked due to insufficient credits. Add credits to continue.'
  const blocks = [
    `An attempt to create an employee was blocked because your credit balance is insufficient.`,
    actor ? `Action attempted by: <strong>${escapeHtml(actor)}</strong>` : '',
    `Add credits to continue provisioning employees.`
  ].filter(Boolean)
  const { html, attachments } = renderEmail({
    companyName,
    companyId,
    companyLogoUrl,
    title: 'Action blocked',
    tone: 'rose',
    preheader: 'Insufficient credits for employee creation',
    blocks,
    cta: { label: 'Add credits', url: billingUrl }
  })
  return sendEmail(to, subject, text, html, { attachments })
}

export function sendSubscriptionDeduction(toOrPayload, deductedLegacy, remainingLegacy) {
  const payload = typeof toOrPayload === 'object' && toOrPayload
    ? toOrPayload
    : { to: toOrPayload, deducted: deductedLegacy, remaining: remainingLegacy }
  const to = payload.to
  const deducted = Number(payload.deducted || 0)
  const remaining = Number(payload.remaining || 0)
  const companyName = payload.companyName || payload.company?.name || ''
  const companyId = payload.companyId ?? payload.company?.id
  const companyLogoUrl = payload.companyLogoUrl || payload.company?.logo_url || ''
  const billingUrl = payload.billingUrl || tenantUrl(companyName, '/billing')
  const subject = `Monthly billing: ${deducted} credits deducted`
  const text = `Monthly deduction: ${deducted} credits. Remaining balance: ${remaining}.`
  const { html, attachments } = renderEmail({
    companyName,
    companyId,
    companyLogoUrl,
    title: 'Monthly subscription deduction',
    tone: 'slate',
    preheader: `Deducted ${deducted} credits`,
    blocks: [
      `We deducted <strong>${escapeHtml(deducted)}</strong> credits for your active employees.`,
      `Remaining balance: <strong>${escapeHtml(remaining)}</strong> credits.`
    ],
    cta: { label: 'Open billing', url: billingUrl }
  })
  return sendEmail(to, subject, text, html, { attachments })
}

export function sendEmployeeCreatedDeduction(toOrPayload, legacyPayload) {
  const payload = typeof toOrPayload === 'object' && toOrPayload
    ? toOrPayload
    : { to: toOrPayload, ...(legacyPayload || {}) }
  const to = payload.to
  const employeeName = payload.employeeName || ''
  const employeeEmail = payload.employeeEmail || ''
  const deducted = Number(payload.deducted || 0)
  const remaining = Number(payload.remaining || 0)
  const companyName = payload.companyName || payload.company?.name || ''
  const companyId = payload.companyId ?? payload.company?.id
  const companyLogoUrl = payload.companyLogoUrl || payload.company?.logo_url || ''
  const billingUrl = payload.billingUrl || tenantUrl(companyName, '/billing')
  const subject = 'Employee created • credits deducted'
  const text = `New employee created (${employeeEmail}). Deducted ${deducted} credit(s). Remaining balance: ${remaining}.`
  const { html, attachments } = renderEmail({
    companyName,
    companyId,
    companyLogoUrl,
    title: 'New employee provisioned',
    tone: 'blue',
    preheader: 'Employee created and credits updated',
    blocks: [
      `Employee: <strong>${escapeHtml(employeeName || '—')}</strong>`,
      `Email: <strong>${escapeHtml(employeeEmail)}</strong>`,
      `Credits deducted: <strong>${escapeHtml(deducted)}</strong>`,
      `Remaining balance: <strong>${escapeHtml(remaining)}</strong>`,
    ],
    cta: { label: 'Open billing', url: billingUrl }
  })
  return sendEmail(to, subject, text, html, { attachments })
}

export function sendNewUserCreated(to, data) {
  const { name, email, role, teamName, password, loginUrl } = data || {}
  const subject = 'New user account created';
  const text = `A new user account has been created.
  
Name: ${name}
Email: ${email}
Role: ${role}
Team: ${teamName}
Password: ${password}

Login here: ${loginUrl}`;

  const companyName = data?.companyName || data?.company?.name || teamName || 'Organization'
  const companyId = data?.companyId ?? data?.company?.id ?? null
  const companyLogoUrl = data?.companyLogoUrl || data?.company?.logo_url || ''
  const { html, attachments } = renderEmail({
    companyName,
    companyId,
    companyLogoUrl,
    title: 'New account created',
    tone: 'blue',
    preheader: `Account created for ${email}`,
    blocks: [
      `Name: <strong>${escapeHtml(name)}</strong>`,
      `Email: <strong>${escapeHtml(email)}</strong>`,
      `Role: <strong>${escapeHtml(role)}</strong>`,
      password ? `Temporary password: <strong>${escapeHtml(password)}</strong>` : '',
      `For security, change the password after first login.`
    ].filter(Boolean),
    cta: { label: 'Open login', url: loginUrl }
  })
  return sendEmail(to, subject, text, html, { attachments })
}

export function sendRequestStatus(to, status, date, reason) {
  const subject = `Time request ${status}`;
  const text = `Your time request for ${date} has been ${status}.
  
Reason: ${reason}`;

  const tone = status === 'approved' ? 'emerald' : status === 'rejected' ? 'rose' : 'slate'
  const { html, attachments } = renderEmail({
    companyName: process.env.EMAIL_BRAND_NAME || 'Time Tracker',
    companyId: null,
    companyLogoUrl: '',
    title: 'Time request update',
    tone,
    preheader: `Your request is ${status}`,
    blocks: [
      `Date: <strong>${escapeHtml(date)}</strong>`,
      `Status: <strong>${escapeHtml(String(status || '').toUpperCase())}</strong>`,
      reason ? `Reason: ${escapeHtml(reason)}` : '',
    ].filter(Boolean),
  })
  return sendEmail(to, subject, text, html, { attachments })
}

export function sendMonthlyBillingSummary(toOrPayload, legacyData) {
  const payload = typeof toOrPayload === 'object' && toOrPayload
    ? toOrPayload
    : { to: toOrPayload, ...(legacyData || {}) }
  const to = payload.to
  const period = payload.period || ''
  const activeEmployees = payload.activeEmployees ?? 0
  const deducted = payload.deducted ?? 0
  const remaining = payload.remaining ?? 0
  const companyName = payload.companyName || payload.company?.name || (process.env.EMAIL_BRAND_NAME || 'Time Tracker')
  const companyId = payload.companyId ?? payload.company?.id ?? null
  const companyLogoUrl = payload.companyLogoUrl || payload.company?.logo_url || ''
  const billingUrl = payload.billingUrl || tenantUrl(companyName, '/billing')

  const subject = `Monthly billing summary • ${period}`
  const text = `Here is your monthly billing summary for ${period}.\n\n- Active Employees: ${activeEmployees}\n- Credits Deducted: ${deducted}\n- Remaining Balance: ${remaining}`
  const { html, attachments } = renderEmail({
    companyName,
    companyId,
    companyLogoUrl,
    title: 'Monthly billing summary',
    tone: 'slate',
    preheader: `Summary for ${period}`,
    blocks: [
      `Period: <strong>${escapeHtml(period)}</strong>`,
      `Active employees: <strong>${escapeHtml(activeEmployees)}</strong>`,
      `Credits deducted: <strong>${escapeHtml(deducted)}</strong>`,
      `Remaining balance: <strong>${escapeHtml(remaining)}</strong>`,
    ],
    cta: { label: 'Open billing', url: billingUrl }
  })
  return sendEmail(to, subject, text, html, { attachments })
}

export function sendAccountSuspensionWarning(toOrPayload) {
  const payload = typeof toOrPayload === 'object' && toOrPayload ? toOrPayload : { to: toOrPayload }
  const to = payload.to
  const companyName = payload.companyName || payload.company?.name || ''
  const companyId = payload.companyId ?? payload.company?.id
  const companyLogoUrl = payload.companyLogoUrl || payload.company?.logo_url || ''
  const billingUrl = payload.billingUrl || tenantUrl(companyName, '/billing')
  const subject = 'Urgent: account credits exhausted'
  const text = 'Your account credits reached zero. Recharge immediately to avoid interruption.'
  const { html, attachments } = renderEmail({
    companyName,
    companyId,
    companyLogoUrl,
    title: 'Account at risk',
    tone: 'rose',
    preheader: 'Credits are exhausted',
    blocks: [
      `Your credits have reached <strong>0</strong>.`,
      `Recharge now to keep monitoring and reporting available for your team.`,
    ],
    cta: { label: 'Recharge now', url: billingUrl }
  })
  return sendEmail(to, subject, text, html, { attachments })
}

export function sendContactFormEmail(to, { name, email, subject, message }) {
  const emailSubject = `Contact Form: ${subject}`;
  const text = `New message from Contact Form:

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}`;

  const { html, attachments } = renderEmail({
    companyName: process.env.EMAIL_BRAND_NAME || 'Time Tracker',
    companyId: null,
    companyLogoUrl: '',
    title: 'New contact form submission',
    tone: 'slate',
    preheader: `From ${name}`,
    blocks: [
      `Name: <strong>${escapeHtml(name)}</strong>`,
      `Email: <strong>${escapeHtml(email)}</strong>`,
      `Subject: <strong>${escapeHtml(subject)}</strong>`,
      `<div style="margin-top:10px;padding:12px;border:1px solid #E2E8F0;border-radius:12px;background:#fff;">${escapeHtml(message).replace(/\n/g, '<br>')}</div>`
    ]
  })
  return sendEmail(to, emailSubject, text, html, { attachments });
}

export function sendPasswordResetEmail(to, resetUrl) {
  const subject = 'Password Reset Request';
  const text = `You requested a password reset for your Time Tracker account.
  
Please click the link below to reset your password:
${resetUrl}

If you did not request this, please ignore this email.
Link expires in 1 hour.`;

  const { html, attachments } = renderEmail({
    companyName: process.env.EMAIL_BRAND_NAME || 'Time Tracker',
    companyId: null,
    companyLogoUrl: '',
    title: 'Reset your password',
    tone: 'blue',
    preheader: 'Password reset link (expires in 1 hour)',
    blocks: [
      `Click the button below to reset your password.`,
      `This link expires in <strong>1 hour</strong>. If you didn’t request this, you can ignore this email.`
    ],
    cta: { label: 'Reset password', url: resetUrl }
  })
  return sendEmail(to, subject, text, html, { attachments })
}

export function sendActivationEmail(to, { fullName, companyName, activateUrl, loginUrl, password }) {
  const safeBrand = process.env.EMAIL_BRAND_NAME || 'Time Tracker';
  const subject = `Activate your ${safeBrand} workspace`;
  const text = `Hi ${fullName},\n\nThank you for creating a workspace "${companyName}".\n\nPlease click the link below to activate your account:\n${activateUrl}\n\nOnce activated, you can log in at:\n${loginUrl}\n\nYour temporary credentials:\nEmail: ${to}\nPassword: ${password}\n\nFor security, change your password after first login.\n\n- ${safeBrand} Team`;

  const { html, attachments } = renderEmail({
    companyName,
    companyId: null,
    companyLogoUrl: '',
    title: 'Welcome! Activate your workspace',
    tone: 'blue',
    preheader: `Activate "${companyName}" workspace`,
    blocks: [
      `Hi <strong>${escapeHtml(fullName)}</strong>,`,
      `Thank you for creating a workspace <strong>"${escapeHtml(companyName)}"</strong>. Please click the button below to activate your account and get started.`,
      `<div style="margin-top:6px;padding:12px;border:1px solid #E2E8F0;border-radius:12px;background:#fff;">
        <div style="font-size:11px;color:#64748B;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Temporary Credentials</div>
        <div style="margin-top:6px;font-size:13px;">
          <div><span style="color:#64748B;">Email:</span> <strong>${escapeHtml(to)}</strong></div>
          <div style="margin-top:2px;"><span style="color:#64748B;">Password:</span> <strong>${escapeHtml(password)}</strong></div>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#94A3B8;">⚠️ Change your password after first login.</div>
      </div>`,
      `Once activated, you can log in at: <a href="${escapeHtml(loginUrl)}" style="color:#2563EB;">${escapeHtml(loginUrl)}</a>`
    ],
    cta: { label: 'Activate workspace', url: activateUrl }
  })
  return sendEmail(to, subject, text, html, { attachments })
}
