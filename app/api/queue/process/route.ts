import { NextRequest, NextResponse } from 'next/server';
import { queue, contacts, stats } from '@/lib/db';

export async function POST() {
  try {
    const pending = queue.getPending();
    const processed = [];

    for (const item of pending.slice(0, 5) as any[]) { // Process max 5 at a time
      // In a real implementation, this would call the Unipile API
      // For now, we'll just mark as completed
      
      queue.updateStatus(item.id, 'completed');
      
      // Update contact status
      if (item.action_type === 'connection') {
        contacts.updateStatus(item.contact_id, 'connected');
        stats.increment('connections_sent');
      } else if (item.action_type === 'message') {
        contacts.updateStatus(item.contact_id, 'messaged');
        stats.increment('messages_sent');
      }
      
      processed.push(item.id);
    }

    return NextResponse.json({ processed: processed.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
