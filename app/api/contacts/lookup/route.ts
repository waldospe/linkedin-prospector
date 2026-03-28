import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { globalConfig, users } from '@/lib/db';
import { normalizeLinkedInUrl } from '@/lib/constants';

// Extract the LinkedIn username slug from a URL
// https://www.linkedin.com/in/jeffwald/ -> jeffwald
function extractLinkedInSlug(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_.]+)/);
  return match ? match[1] : null;
}

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
    const slug = extractLinkedInSlug(url);

    if (!slug) {
      return NextResponse.json({ error: 'Invalid LinkedIn URL. Expected format: linkedin.com/in/username' }, { status: 400 });
    }

    const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';

    // Unipile API: GET /api/v1/users/{slug}?account_id={id}&linkedin_sections=*
    const res = await fetch(
      `https://${dsn}/api/v1/users/${slug}?account_id=${user.unipile_account_id}&linkedin_sections=*`,
      {
        headers: {
          'X-API-KEY': cfg.unipile_api_key,
          'Accept': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.log('LOOKUP error:', res.status, errText);
      return NextResponse.json({ error: 'Profile not found. Check the URL and try again.' }, { status: 404 });
    }

    const profile = await res.json();
    console.log('LOOKUP profile keys:', Object.keys(profile));

    // Extract fields
    const firstName = profile.first_name || profile.firstName || '';
    const lastName = profile.last_name || profile.lastName || '';
    const fullName = profile.name || profile.display_name
      || [firstName, lastName].filter(Boolean).join(' ') || '';
    const headline = profile.headline || profile.title || '';

    // Try to extract company from experience or headline
    let company = '';
    if (profile.experience && Array.isArray(profile.experience) && profile.experience.length > 0) {
      company = profile.experience[0].company_name || profile.experience[0].company || '';
    }
    if (!company && profile.company_name) {
      company = profile.company_name;
    }
    if (!company && profile.company?.name) {
      company = profile.company.name;
    }

    // Try to extract title from experience or headline
    let title = '';
    if (profile.experience && Array.isArray(profile.experience) && profile.experience.length > 0) {
      title = profile.experience[0].title || '';
    }
    if (!title) {
      title = headline;
    }

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
