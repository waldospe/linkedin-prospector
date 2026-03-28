import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { queue, contacts, stats } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const pending = queue.getPending(userId);
    const processed = [];

    for (const item of pending.slice(0, 5) as any[]) {
      // In a real implementation, this would call the Unipile API
      queue.updateStatus(item.id, 'completed', userId);

      if (item.action_type === 'connection') {
        contacts.updateStatus(item.contact_id, 'connected', userId);
        stats.increment('connections_sent', userId);
      } else if (item.action_type === 'message') {
        contacts.updateStatus(item.contact_id, 'messaged', userId);
        stats.increment('messages_sent', userId);
      }

      processed.push(item.id);
    }

    return NextResponse.json({ processed: processed.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
