import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { contacts, sequences, queue } from '@/lib/db';
import { normalizeLinkedInUrl, isValidLinkedInUrl, substituteVariables } from '@/lib/constants';

// Known contact fields and common CSV header aliases
const FIELD_ALIASES: Record<string, string[]> = {
  first_name: ['first_name', 'firstname', 'first name', 'first', 'fname', 'given name'],
  last_name: ['last_name', 'lastname', 'last name', 'last', 'lname', 'surname', 'family name'],
  name: ['name', 'full name', 'fullname', 'full_name', 'contact name', 'contact'],
  linkedin_url: ['linkedin_url', 'linkedin url', 'linkedin', 'linkedin profile', 'profile url', 'profile_url', 'linkedin link'],
  company: ['company', 'company name', 'organization', 'org', 'employer', 'company_name'],
  title: ['title', 'job title', 'job_title', 'position', 'role', 'job role'],
};

const VALID_FIELDS = Object.keys(FIELD_ALIASES);

function normalizeHeader(header: string): string | null {
  const h = header.trim().toLowerCase().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ');
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  return null;
}

// POST: Preview/validate headers for CSV or Google Sheets data
// Body: { headers: string[] } -> returns suggested mapping
// Or: { rows: Array<Record<string, string>>, mapping: Record<string, string> } -> imports data
export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId, userId: authUserId } = getEffectiveUser(req);
    const userId = effectiveUserId || authUserId;
    const body = await req.json();

    // Step 1: Header validation - return suggested mapping
    if (body.headers && !body.rows) {
      const headers = body.headers as string[];
      const mapping: Record<string, string | null> = {};
      const suggestions: Record<string, string | null> = {};

      for (const header of headers) {
        const match = normalizeHeader(header);
        suggestions[header] = match;
      }

      return NextResponse.json({
        headers,
        suggestions,
        validFields: VALID_FIELDS,
        fieldLabels: {
          first_name: 'First Name',
          last_name: 'Last Name',
          name: 'Full Name',
          linkedin_url: 'LinkedIn URL',
          company: 'Company',
          title: 'Title',
        },
      });
    }

    // Step 2: Import with confirmed mapping
    if (body.rows && body.mapping) {
      const rows = body.rows as Array<Record<string, string>>;
      const mapping = body.mapping as Record<string, string>; // csv_header -> our_field

      let invalidUrls = 0;
      const mapped = rows.map((row) => {
        const contact: Record<string, string> = {};
        for (const [csvHeader, ourField] of Object.entries(mapping)) {
          if (ourField && VALID_FIELDS.includes(ourField)) {
            contact[ourField] = row[csvHeader] || '';
          }
        }
        // Normalize and validate LinkedIn URLs
        if (contact.linkedin_url) {
          contact.linkedin_url = normalizeLinkedInUrl(contact.linkedin_url);
          if (contact.linkedin_url && !isValidLinkedInUrl(contact.linkedin_url)) {
            invalidUrls++;
            contact.linkedin_url = ''; // clear invalid URLs
          }
        }
        return contact;
      }).filter((c) => c.first_name || c.last_name || c.name); // skip empty

      const count = contacts.bulkCreate(userId, mapped);

      // Assign to sequence if specified
      let sequenced = 0;
      if (body.sequence_id && count > 0) {
        const seq = sequences.getById(body.sequence_id, userId) as any;
        if (seq) {
          const steps = typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps;
          if (steps.length > 0) {
            // Get the newly created contacts (last N by created_at)
            const allContacts = contacts.getAll(userId) as any[];
            const newContacts = allContacts.slice(0, count); // getAll returns DESC by created_at
            for (const c of newContacts) {
              const messageText = steps[0].template
                ? substituteVariables(steps[0].template, c)
                : '';
              queue.create(userId, {
                contact_id: c.id,
                sequence_id: body.sequence_id,
                step_number: 1,
                action_type: steps[0].action,
                message_text: messageText,
              });
              contacts.updateStatus(c.id, 'queued', userId);
              sequenced++;
            }
          }
        }
      }

      return NextResponse.json({ imported: count, total: rows.length, invalidUrls, sequenced });
    }

    return NextResponse.json({ error: 'Invalid request. Send { headers } or { rows, mapping }' }, { status: 400 });
  } catch (error: any) {
    console.error('IMPORT ERROR:', error.message, error.stack?.split('\n')[1]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
