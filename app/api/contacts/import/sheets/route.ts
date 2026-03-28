import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';

// Fetch a public Google Sheet as CSV and return parsed rows + headers
export async function POST(req: NextRequest) {
  try {
    getUserFromRequest(req); // auth check

    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'Google Sheets URL required' }, { status: 400 });
    }

    // Convert Google Sheets URL to CSV export URL
    const csvUrl = toGoogleCsvUrl(url);
    if (!csvUrl) {
      return NextResponse.json({ error: 'Invalid Google Sheets URL. Make sure the sheet is publicly accessible.' }, { status: 400 });
    }

    const response = await fetch(csvUrl);
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch sheet. Make sure it is published or shared as "Anyone with the link".' }, { status: 400 });
    }

    const csvText = await response.text();
    const { headers, rows } = parseCsv(csvText);

    if (headers.length === 0) {
      return NextResponse.json({ error: 'Sheet appears to be empty' }, { status: 400 });
    }

    return NextResponse.json({ headers, rows, rowCount: rows.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function toGoogleCsvUrl(url: string): string | null {
  // Handle various Google Sheets URL formats
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/pub
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const sheetId = match[1];

  // Check for gid parameter
  const gidMatch = url.match(/gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function parseCsv(text: string): { headers: string[]; rows: Array<Record<string, string>> } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}
