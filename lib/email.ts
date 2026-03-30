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
