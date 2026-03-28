import { NextRequest, NextResponse } from 'next/server';
import { contacts, queue, sequences } from '@/lib/db-mem';

// Helper to get user_id from cookie/token
function getUserId(req: NextRequest): number | undefined {
  // For now, check localStorage via a header or default to 1 (Jeff)
  // In a real app, decode the JWT token
  const userId = req.headers.get('x-user-id');
  return userId ? parseInt(userId) : 1;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const allContacts = contacts.getAll(userId);
    return NextResponse.json(allContacts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const data = await req.json();
    
    const result = contacts.create({
      ...data,
      user_id: userId
    });
    
    // If sequence_id provided, add to queue
    if (data.sequence_id) {
      const seq: any = sequences.getById(data.sequence_id);
      if (seq) {
        const steps = JSON.parse(seq.steps as string);
        if (steps.length > 0) {
          queue.create({
            contact_id: result.id,
            sequence_id: data.sequence_id,
            step_number: 1,
            action_type: steps[0].action
          });
        }
      }
    }
    
    return NextResponse.json({ id: result.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
