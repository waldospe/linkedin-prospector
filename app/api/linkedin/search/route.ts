import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { globalConfig, users } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId, userId: authUserId } = getEffectiveUser(req);
    const viewUserId = effectiveUserId || authUserId;
    const user = users.getById(viewUserId) as any;
    const cfg = globalConfig.get();

    if (!cfg?.unipile_api_key) {
      return NextResponse.json({ error: 'Unipile API not configured' }, { status: 400 });
    }
    if (!user?.unipile_account_id) {
      return NextResponse.json({ error: 'No Unipile account linked. Go to Settings to connect.' }, { status: 400 });
    }

    const body = await req.json();
    const { keywords, url, category, api, cursor } = body;

    if (!keywords && !url) {
      return NextResponse.json({ error: 'Keywords or LinkedIn search URL required' }, { status: 400 });
    }

    const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';
    const searchUrl = `https://${dsn}/api/v1/linkedin/search?account_id=${user.unipile_account_id}`;

    // Build search request body
    const searchBody: any = {
      api: api || 'classic',
      category: category || 'people',
    };

    if (url) {
      searchBody.url = url;
    } else {
      searchBody.keywords = keywords;
    }

    if (cursor) {
      searchBody.cursor = cursor;
    }

    const res = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': cfg.unipile_api_key,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      // Search failed
      return NextResponse.json({ error: `Search failed: ${errText.slice(0, 200)}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Search error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
