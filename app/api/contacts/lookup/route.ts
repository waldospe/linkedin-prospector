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
    console.log('LOOKUP full response:', JSON.stringify(profile, null, 2));

    // Extract name fields
    const firstName = profile.first_name || profile.firstName || '';
    const lastName = profile.last_name || profile.lastName || '';
    const fullName = profile.name || profile.display_name
      || [firstName, lastName].filter(Boolean).join(' ') || '';

    // Find current job title and company from experience/positions
    let title = '';
    let company = '';

    // Check linkedin_sections for experience data
    const sections = profile.linkedin_sections || profile.sections || {};
    const experience = profile.experience || sections.experience || profile.positions || sections.positions || [];

    // Experience might be an object with items array
    const expItems = Array.isArray(experience) ? experience : (experience.items || experience.entries || []);

    if (expItems.length > 0) {
      // First item is typically current/most recent position
      const current = expItems[0];
      title = current.title || current.position || current.role || '';
      company = current.company_name || current.company || current.organization || current.org_name || '';

      // If company is an object, get its name
      if (typeof company === 'object' && company !== null) {
        company = (company as any).name || (company as any).company_name || '';
      }
    }

    // Fallback: try top-level fields
    if (!title) title = profile.occupation || profile.job_title || '';
    if (!company) company = profile.company_name || profile.company?.name || profile.organization || '';

    // Last resort for title: use headline but NOT if we found a real title
    const headline = profile.headline || '';
    if (!title && headline) title = headline;

    // Avatar
    const avatarUrl = profile.profile_picture_url || profile.profile_picture_url_large || profile.avatar_url || '';

    return NextResponse.json({
      first_name: firstName,
      last_name: lastName,
      name: fullName,
      title,
      company,
      headline,
      linkedin_url: url,
      avatar_url: avatarUrl,
    });
  } catch (error: any) {
    console.log('LOOKUP fatal error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
