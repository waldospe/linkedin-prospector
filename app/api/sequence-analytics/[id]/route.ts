import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { sequenceAnalytics } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const seqId = Number(params.id);
    const [stepPerformance, funnel, variants] = [
      sequenceAnalytics.getStepPerformance(seqId, effectiveUserId!),
      sequenceAnalytics.getConversionFunnel(seqId, effectiveUserId!),
      sequenceAnalytics.getVariantPerformance(seqId, effectiveUserId!),
    ];
    return NextResponse.json({ stepPerformance, funnel, variants });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
