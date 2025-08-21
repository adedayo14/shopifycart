import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/shopify-session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { shop } = await request.json();
    
    if (!shop) {
      return NextResponse.json({ error: 'Shop parameter required' }, { status: 400 });
    }

    console.log('🔄 Clearing sessions for shop:', shop);
    
    // Delete all sessions for this shop
    const deletedSessions = await prisma.session.deleteMany({
      where: {
        shop: {
          contains: shop
        }
      }
    });
    
    console.log('✅ Deleted sessions:', deletedSessions);
    
    return NextResponse.json({ 
      success: true, 
      message: `Cleared ${deletedSessions.count} sessions for ${shop}`,
      deletedCount: deletedSessions.count
    });
  } catch (error) {
    console.error('Clear sessions error:', error);
    return NextResponse.json(
      { error: 'Failed to clear sessions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 