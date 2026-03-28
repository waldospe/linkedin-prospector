import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { globalConfig, users } from '@/lib/db';
import { normalizeLinkedInUrl } from '@/lib/constants';

// Look up a LinkedIn profile via Unipile and return name, title, company
export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;
    const cfg = globalConfig.get();

    if (!cfg?.unipile_api_key) {
      return NextResponse.json({ error: 'Unipile API not configured' }, { status: 400 });
    }
    if (!user?.unipile_account_id) {
      return NextResponse.json({ error: 'No Unipile account linked to your profile' }, { status: 400 });
    }

    const { linkedin_url } = await req.json();
    if (!linkedin_url) {
      return NextResponse.json({ error: 'LinkedIn URL required' }, { status: 400 });
    }

    const url = normalizeLinkedInUrl(linkedin_url);
    const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';

    const res = await fetch(
      `https://${dsn}/api/v1/users/?linkedin=${encodeURIComponent(url)}&account_id=${user.unipile_account_id}`,
      {
        headers: {
          'X-API-KEY': cfg.unipile_api_key,
          'Accept': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: 'Profile not found. Check the URL and try again.' }, { status: 404 });
    }

    const profile = await res.json();

    // Extract fields from Unipile profile response
    const firstName = profile.first_name || profile.firstName || '';
    const lastName = profile.last_name || profile.lastName || '';
    const fullName = profile.name || [firstName, lastName].filter(Boolean).join(' ') || '';
    const title = profile.headline || profile.title || profile.job_title || '';
    const company = profile.company?.name || profile.company_name || profile.organization || '';

    return NextResponse.json({
      first_name: firstName,
      last_name: lastName,
      name: fullName,
      title,
      company,
      linkedin_url: url,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
