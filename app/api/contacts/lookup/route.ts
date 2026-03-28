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

    // Log the full response so we can see the actual field names
    console.log('UNIPILE PROFILE RESPONSE:', JSON.stringify(profile, null, 2));

    // Try every possible field name pattern
    const firstName = profile.first_name || profile.firstName || profile.FirstName || '';
    const lastName = profile.last_name || profile.lastName || profile.LastName || '';
    const fullName = profile.name || profile.Name || profile.display_name || profile.displayName
      || [firstName, lastName].filter(Boolean).join(' ') || '';
    const title = profile.headline || profile.title || profile.job_title || profile.jobTitle
      || profile.position || profile.Headline || '';
    const company = profile.company?.name || profile.company_name || profile.companyName
      || profile.organization || profile.current_company || profile.Company || '';

    // If we got nothing useful, return the raw profile so frontend can show something
    const result = {
      first_name: firstName,
      last_name: lastName,
      name: fullName,
      title,
      company,
      linkedin_url: url,
      _raw_keys: Object.keys(profile), // for debugging
    };

    console.log('LOOKUP RESULT:', JSON.stringify(result));

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
