import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY not configured');
    resend = new Resend(key);
  }
  return resend;
}

const APP_URL = process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://lp.moco.inc';
const FROM_EMAIL = process.env.FROM_EMAIL || 'LinkedIn Prospector <noreply@notify.moco.inc>';

export async function sendInviteEmail(opts: {
  to: string;
  name: string;
  inviterName: string;
  token: string;
  teamName?: string;
}) {
  const { to, name, inviterName, token, teamName } = opts;
  const setupUrl = `${APP_URL}/invite/${token}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: #2563eb; border-radius: 12px; line-height: 48px; text-align: center;">
          <span style="color: white; font-size: 20px;">⚡</span>
        </div>
        <h1 style="font-size: 20px; color: #111; margin: 16px 0 4px;">LinkedIn Prospector</h1>
      </div>

      <p style="font-size: 15px; color: #333; line-height: 1.6;">
        Hi ${name},
      </p>
      <p style="font-size: 15px; color: #333; line-height: 1.6;">
        ${inviterName} has invited you to join ${teamName ? `the <strong>${teamName}</strong> team on` : ''} LinkedIn Prospector — a campaign automation platform for LinkedIn outreach.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${setupUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
          Set Up Your Account
        </a>
      </div>

      <p style="font-size: 13px; color: #888; line-height: 1.5;">
        Or copy this link: <a href="${setupUrl}" style="color: #2563eb;">${setupUrl}</a>
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
      <p style="font-size: 12px; color: #aaa; text-align: center;">
        Powered by Moco
      </p>
    </div>
  `;

  return getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${inviterName} invited you to LinkedIn Prospector`,
    html,
  });
}

export async function sendResetEmail(opts: { to: string; name: string; resetUrl: string }) {
  const { to, name, resetUrl } = opts;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: #2563eb; border-radius: 12px; line-height: 48px; text-align: center;">
          <span style="color: white; font-size: 20px;">⚡</span>
        </div>
      </div>
      <p style="font-size: 15px; color: #333; line-height: 1.6;">Hi ${name},</p>
      <p style="font-size: 15px; color: #333; line-height: 1.6;">We received a request to reset your password. Click the button below to set a new one.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Reset Password</a>
      </div>
      <p style="font-size: 13px; color: #888;">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
      <p style="font-size: 12px; color: #aaa; text-align: center;">Powered by Moco</p>
    </div>
  `;

  return getResend().emails.send({ from: FROM_EMAIL, to, subject: 'Reset your LinkedIn Prospector password', html });
}

export async function sendReplyAlertEmail(opts: {
  to: string;
  userName: string;
  contactName: string;
  contactCompany?: string;
  contactTitle?: string;
  contactId: number;
}) {
  const { to, userName, contactName, contactCompany, contactTitle, contactId } = opts;
  const contactUrl = `${APP_URL}/contacts?open=${contactId}`;
  const jobLine = [contactTitle, contactCompany].filter(Boolean).join(' at ');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: #10b981; border-radius: 12px; line-height: 48px; text-align: center;">
          <span style="color: white; font-size: 22px;">💬</span>
        </div>
      </div>
      <p style="font-size: 15px; color: #333; line-height: 1.6;">Hi ${userName},</p>
      <p style="font-size: 15px; color: #333; line-height: 1.6;">
        <strong>${contactName}</strong>${jobLine ? ` (${jobLine})` : ''} just replied to your LinkedIn message.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${contactUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">View Conversation</a>
      </div>
      <p style="font-size: 13px; color: #888; line-height: 1.5;">Reply quickly — fresh conversations convert best.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
      <p style="font-size: 12px; color: #aaa; text-align: center;">LinkedIn Prospector · Powered by Moco</p>
    </div>
  `;

  try {
    return await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${contactName} replied on LinkedIn`,
      html,
    });
  } catch (err: any) {
    console.error('Reply alert email failed:', err?.message);
  }
}

export async function sendDigestEmail(opts: {
  to: string;
  userName: string;
  connectionsAcceptedYesterday: number;
  repliesYesterday: number;
  messagesSentYesterday: number;
  connectionsSentYesterday: number;
  queuedToday: number;
  dailyLimit: number;
}) {
  const { to, userName, connectionsAcceptedYesterday, repliesYesterday, messagesSentYesterday, connectionsSentYesterday, queuedToday, dailyLimit } = opts;

  // Lead with the most exciting stat in subject line
  let subject = 'Your LinkedIn Prospector daily digest';
  if (connectionsAcceptedYesterday > 0) {
    subject = `${connectionsAcceptedYesterday} ${connectionsAcceptedYesterday === 1 ? 'person' : 'people'} accepted your connection request yesterday`;
  } else if (repliesYesterday > 0) {
    subject = `${repliesYesterday} new ${repliesYesterday === 1 ? 'reply' : 'replies'} on LinkedIn`;
  }

  const stat = (label: string, value: number, color: string) => `
    <td style="padding: 16px; text-align: center; border: 1px solid #eee; border-radius: 8px; background: white;">
      <div style="font-size: 28px; font-weight: 700; color: ${color}; line-height: 1;">${value}</div>
      <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px;">${label}</div>
    </td>`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: #2563eb; border-radius: 12px; line-height: 48px; text-align: center;">
          <span style="color: white; font-size: 20px;">⚡</span>
        </div>
        <h1 style="font-size: 18px; color: #111; margin: 16px 0 4px;">Good morning, ${userName}</h1>
        <p style="font-size: 13px; color: #888; margin: 0;">Here's what happened yesterday</p>
      </div>

      <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 24px;">
        <tr>
          ${stat('Accepted', connectionsAcceptedYesterday, '#10b981')}
          ${stat('Replies', repliesYesterday, '#8b5cf6')}
        </tr>
        <tr>
          ${stat('Sent', connectionsSentYesterday, '#3b82f6')}
          ${stat('Messages', messagesSentYesterday, '#6366f1')}
        </tr>
      </table>

      <div style="background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
        <p style="font-size: 13px; color: #555; margin: 0;">
          <strong style="color: #111;">Today's queue:</strong> ${queuedToday} ${queuedToday === 1 ? 'action' : 'actions'} scheduled
          ${dailyLimit ? ` (${dailyLimit} connection limit)` : ''}
        </p>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${APP_URL}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Open Dashboard</a>
      </div>

      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
      <p style="font-size: 11px; color: #aaa; text-align: center;">
        LinkedIn Prospector · <a href="${APP_URL}/settings" style="color: #aaa;">Unsubscribe</a>
      </p>
    </div>
  `;

  try {
    return await getResend().emails.send({ from: FROM_EMAIL, to, subject, html });
  } catch (err: any) {
    console.error('Digest email failed:', err?.message);
  }
}

export async function sendAlertEmail(opts: { subject: string; body: string }) {
  const adminEmail = process.env.ALERT_EMAIL || 'jeff@moco.inc';
  try {
    return await getResend().emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `[LP Alert] ${opts.subject}`,
      html: `<div style="font-family: sans-serif; padding: 20px;"><h2 style="color: #ef4444;">${opts.subject}</h2><pre style="background: #f5f5f5; padding: 16px; border-radius: 8px; font-size: 13px;">${opts.body}</pre><p style="color: #888; font-size: 12px;">LinkedIn Prospector &middot; ${new Date().toISOString()}</p></div>`,
    });
  } catch { /* silently fail — don't crash the cron over alert emails */ }
}
