import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { globalConfig, users } from '@/lib/db';
import { normalizeLinkedInUrl } from '@/lib/constants';

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
    const baseUrl = `https://${dsn}/api/v1`;
    const headers = {
      'X-API-KEY': cfg.unipile_api_key,
      'Accept': 'application/json',
    };

    // Try the profile view endpoint first
    let profile: any = null;

    // Attempt 1: /users/me with linkedin parameter
    try {
      const res1 = await fetch(
        `${baseUrl}/users/?linkedin=${encodeURIComponent(url)}&account_id=${user.unipile_account_id}`,
        { headers }
      );
      console.log('LOOKUP attempt 1 status:', res1.status);
      if (res1.ok) {
        profile = await res1.json();
        console.log('LOOKUP attempt 1 response:', JSON.stringify(profile, null, 2));
      } else {
        const errText = await res1.text();
        console.log('LOOKUP attempt 1 error:', errText);
      }
    } catch (e: any) {
      console.log('LOOKUP attempt 1 exception:', e.message);
    }

    // Attempt 2: /linkedin/profile endpoint
    if (!profile) {
      try {
        const res2 = await fetch(
          `${baseUrl}/linkedin/profile?linkedin_url=${encodeURIComponent(url)}&account_id=${user.unipile_account_id}`,
          { headers }
        );
        console.log('LOOKUP attempt 2 status:', res2.status);
        if (res2.ok) {
          profile = await res2.json();
          console.log('LOOKUP attempt 2 response:', JSON.stringify(profile, null, 2));
        } else {
          const errText = await res2.text();
          console.log('LOOKUP attempt 2 error:', errText);
        }
      } catch (e: any) {
        console.log('LOOKUP attempt 2 exception:', e.message);
      }
    }

    // Attempt 3: /users/guest with profile URL
    if (!profile) {
      try {
        const res3 = await fetch(
          `${baseUrl}/users/guest?linkedin_url=${encodeURIComponent(url)}&account_id=${user.unipile_account_id}`,
          { headers }
        );
        console.log('LOOKUP attempt 3 status:', res3.status);
        if (res3.ok) {
          profile = await res3.json();
          console.log('LOOKUP attempt 3 response:', JSON.stringify(profile, null, 2));
        } else {
          const errText = await res3.text();
          console.log('LOOKUP attempt 3 error:', errText);
        }
      } catch (e: any) {
        console.log('LOOKUP attempt 3 exception:', e.message);
      }
    }

    if (!profile) {
      return NextResponse.json({ error: 'Could not retrieve profile from Unipile. The profile may not be accessible.' }, { status: 404 });
    }

    // Try every possible field name from the response
    const firstName = profile.first_name || profile.firstName || profile.FirstName || '';
    const lastName = profile.last_name || profile.lastName || profile.LastName || '';
    const fullName = profile.name || profile.Name || profile.display_name || profile.displayName
      || [firstName, lastName].filter(Boolean).join(' ') || '';
    const title = profile.headline || profile.title || profile.job_title || profile.jobTitle
      || profile.position || profile.Headline || '';
    const company = profile.company?.name || profile.company_name || profile.companyName
      || profile.organization || profile.current_company || profile.Company || '';

    return NextResponse.json({
      first_name: firstName,
      last_name: lastName,
      name: fullName,
      title,
      company,
      linkedin_url: url,
    });
  } catch (error: any) {
    console.log('LOOKUP fatal error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
