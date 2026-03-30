import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { contacts, sequences, queue } from '@/lib/db';
import { normalizeLinkedInUrl, isValidLinkedInUrl, substituteVariables } from '@/lib/constants';

// Allow large request bodies for CSV imports (up to 10MB)
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Known contact fields and common CSV header aliases
const FIELD_ALIASES: Record<string, string[]> = {
  first_name: ['first_name', 'firstname', 'first name', 'first', 'fname', 'given name', 'givenname'],
  last_name: ['last_name', 'lastname', 'last name', 'last', 'lname', 'surname', 'family name', 'familyname'],
  name: ['name', 'full name', 'fullname', 'full_name', 'contact name', 'contact', 'person', 'person name'],
  linkedin_url: ['linkedin_url', 'linkedin url', 'linkedin', 'linkedin profile', 'profile url', 'profile_url', 'linkedin link', 'linkedinurl', 'linkedinprofile', 'li url', 'li profile', 'profile'],
  company: ['company', 'company name', 'organization', 'org', 'employer', 'company_name', 'companyname', 'organisation', 'firm', 'business', 'account', 'account name'],
  title: ['title', 'job title', 'job_title', 'position', 'role', 'job role', 'jobtitle', 'job', 'headline', 'designation', 'job position'],
};

const VALID_FIELDS = Object.keys(FIELD_ALIASES);

// Headers that should NEVER be auto-matched (they contain misleading keywords)
const IGNORE_HEADERS = new Set([
  'companydescription', 'companyheadcount', 'companydomain', 'companywebsite',
  'summary', 'personalization', 'subindustry', 'industry',
  'emailprovider', 'emailsecuritygatewayprovider', 'verificationstatus',
  'interststatus', 'leadstatus', 'campaignname', 'campaign',
  'sentandy', 'sentrobert', 'statusandy', 'statusrobert',
  'acceptedandy', 'acceptedrobert', 'connectioncount',
  'esgcode', 'espcode', 'lastcontactedfrom', 'joblevel',
  'website', 'department', 'email',
]);

// Score how well a CSV header matches a contact field (0 = no match, higher = better)
function scoreHeaderMatch(header: string, field: string): number {
  const h = header.trim().toLowerCase().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ');
  const compact = h.replace(/\s/g, '');
  const aliases = FIELD_ALIASES[field] || [];

  // Never match ignored headers
  if (IGNORE_HEADERS.has(compact)) return 0;

  // Exact match = highest score
  if (aliases.includes(h)) return 100;

  // Compact match (remove spaces)
  for (const alias of aliases) {
    if (alias.replace(/\s/g, '') === compact) return 90;
  }

  // Keyword match (lower score, only for specific exact patterns)
  if (field === 'linkedin_url' && (compact === 'linkedin' || compact === 'linkedinurl' || compact === 'linkedinprofile')) return 80;
  if (field === 'first_name' && (compact === 'firstname' || compact === 'fname')) return 80;
  if (field === 'last_name' && (compact === 'lastname' || compact === 'lname' || compact === 'surname')) return 80;
  if (field === 'title' && (compact === 'jobtitle' || compact === 'position' || compact === 'designation')) return 80;
  if (field === 'company' && (compact === 'companyname' || compact === 'organizationname' || compact === 'employer')) return 80;
  if (field === 'name' && (compact === 'fullname' || compact === 'contactname')) return 70;

  return 0;
}

// POST: Preview/validate headers for CSV or Google Sheets data
// Body: { headers: string[] } -> returns suggested mapping
// Or: { rows: Array<Record<string, string>>, mapping: Record<string, string> } -> imports data
export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId, userId: authUserId } = getEffectiveUser(req);
    const userId = effectiveUserId || authUserId;
    console.log('IMPORT: userId =', userId, 'effectiveUserId =', effectiveUserId);
    const body = await req.json();

    // Step 1: Header validation - return suggested mapping
    if (body.headers && !body.rows) {
      const headers = body.headers as string[];
      const suggestions: Record<string, string | null> = {};
      const usedFields = new Set<string>();

      // First pass: score each header against each field
      const scores: Array<{ header: string; field: string; score: number }> = [];
      for (const header of headers) {
        for (const field of VALID_FIELDS) {
          const score = scoreHeaderMatch(header, field);
          if (score > 0) scores.push({ header, field, score });
        }
      }

      // Sort by score descending, then assign greedily (each field used only once)
      scores.sort((a, b) => b.score - a.score);
      for (const { header, field } of scores) {
        if (suggestions[header] !== undefined) continue; // header already assigned
        if (usedFields.has(field)) continue; // field already used
        suggestions[header] = field;
        usedFields.add(field);
      }

      // Fill in unmatched headers as null
      for (const header of headers) {
        if (suggestions[header] === undefined) suggestions[header] = null;
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
            contact.linkedin_url = '';
          }
        }
        return contact;
      }).filter((c) => c.first_name || c.last_name || c.name || c.linkedin_url || c.company); // accept any row with useful data

      // Dedup: skip contacts whose LinkedIn URL already exists for this user
      let duplicates = 0;
      const existingUrls = new Set<string>();
      const existingContacts = contacts.getAll(userId!) as any[];
      for (const c of existingContacts) {
        if (c.linkedin_url) existingUrls.add(c.linkedin_url.toLowerCase());
      }

      const deduped = mapped.filter(c => {
        if (c.linkedin_url) {
          const normalized = c.linkedin_url.toLowerCase();
          if (existingUrls.has(normalized)) {
            duplicates++;
            return false;
          }
          existingUrls.add(normalized); // also dedup within the import itself
        }
        return true;
      });

      const insertedIds = contacts.bulkCreate(userId!, deduped);
      const count = insertedIds.length;

      // Assign to sequence if specified
      let sequenced = 0;
      if (body.sequence_id && count > 0) {
        const seq = sequences.getById(body.sequence_id, userId) as any;
        if (seq) {
          const steps = typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps;
          if (steps.length > 0) {
            for (const contactId of insertedIds) {
              const c = contacts.getById(contactId, userId) as any;
              if (!c) continue;
              const messageText = steps[0].template
                ? substituteVariables(steps[0].template, c)
                : '';
              queue.create(userId, {
                contact_id: contactId,
                sequence_id: body.sequence_id,
                step_number: 1,
                action_type: steps[0].action,
                message_text: messageText,
              });
              contacts.updateStatus(contactId, 'queued', userId);
              sequenced++;
            }
          }
        }
      }

      return NextResponse.json({ imported: count, total: rows.length, invalidUrls, duplicates, sequenced });
    }

    return NextResponse.json({ error: 'Invalid request. Send { headers } or { rows, mapping }' }, { status: 400 });
  } catch (error: any) {
    console.error('IMPORT ERROR:', error.message, error.stack?.split('\n')[1]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
