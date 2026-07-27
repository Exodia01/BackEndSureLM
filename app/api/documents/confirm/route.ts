import { validateRequest } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  try {
    const { authenticated, user } = await validateRequest(req);
    if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { scanIds, crmUpdateBatch } = body;

    if (!scanIds || !Array.isArray(scanIds) || scanIds.length === 0) {
      return NextResponse.json({ error: 'scanIds array is required' }, { status: 400 });
    }

    const existingScans = await db.documentScan.findMany({
      where: { id: { in: scanIds } },
      select: { id: true, leadId: true },
    });

    if (existingScans.length !== scanIds.length) {
      return NextResponse.json({ error: 'Some scans not found' }, { status: 404 });
    }

    await db.documentScan.updateMany({
      where: { id: { in: scanIds } },
      data: {
        status: 'VALIDATED',
        validatedAt: new Date(),
      },
    });

    if (crmUpdateBatch) {
      const leadUpdates = crmUpdateBatch.map((batchItem: any) => ({
        where: { id: batchItem.leadId },
        data: batchItem.record,
      }));

      for (const update of leadUpdates) {
        await db.policyLead.update(update);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Document confirmation error:', error);
    return NextResponse.json({ error: 'Failed to confirm documents' }, { status: 500 });
  }
}
