import { NextRequest, NextResponse } from 'next/server';
import blocks from '../../../../config/blocks';

// Auto-install webhook for subscription activations
export async function POST(request: NextRequest) {
  try {
    console.log('=== SUBSCRIPTION WEBHOOK HANDLER ===');
    
    const body = await request.json();
    console.log('Webhook payload:', body);
    
    // Extract shop domain from webhook
    const shop = body.shop_domain || body.myshopify_domain;
    
    if (!shop) {
      console.log('No shop domain in webhook');
      return NextResponse.json({ error: 'No shop domain' }, { status: 400 });
    }
    
    // Check if this is a subscription activation
    if (body.status === 'active' || body.status === 'accepted') {
      console.log(`🚀 Subscription activated for ${shop}, auto-installing blocks...`);
      
      try {
        // Get all block IDs from imported config
        const allBlocks = blocks.map((block: any) => block.id);
        
        // Call install-blocks-v2 API internally 
        const installResponse = await fetch(`${process.env.NEXTAUTH_URL || 'https://shopifyapp-weld.vercel.app'}/api/install-blocks-v2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            shop: shop,
            blockIds: allBlocks
          })
        });
        
        const installResult = await installResponse.json();
        
        if (installResult.success) {
          console.log(`✅ WEBHOOK AUTO-INSTALL SUCCESS: ${installResult.message}`);
        } else {
          console.error('❌ WEBHOOK AUTO-INSTALL FAILED:', installResult.error);
        }
        
      } catch (installError) {
        console.error('❌ WEBHOOK AUTO-INSTALL ERROR:', installError);
      }
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Subscription webhook error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
