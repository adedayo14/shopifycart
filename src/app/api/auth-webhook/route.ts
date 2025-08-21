// Authentication webhook endpoint to capture and store access tokens
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('🔗 App installation/auth webhook received');
    
    const body = await request.json();
    console.log('Webhook payload:', JSON.stringify(body, null, 2));
    
    // Extract shop and access token from webhook payload
    const shop = body.shop_domain || body.shop;
    const accessToken = body.access_token;
    
    if (!shop || !accessToken) {
      console.log('❌ Missing shop or access token in webhook payload');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    console.log(`✅ Storing access token for shop: ${shop}`);
    
    // Create a unique session ID
    const sessionId = `offline_${shop}_${Date.now()}`;
    
    // Store or update the session with access token
    await prisma.session.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        shop,
        state: 'authenticated',
        accessToken,
        scope: body.scope || 'read_products,write_products,read_themes,write_themes',
        isOnline: false,
        updatedAt: new Date(),
        createdAt: new Date()
      },
      update: {
        accessToken,
        scope: body.scope || 'read_products,write_products,read_themes,write_themes',
        updatedAt: new Date()
      }
    });
    
    console.log('✅ Session updated with access token');
    
    // Trigger metafield refresh for this shop
    console.log('🔄 Auto-refreshing metafields for subscriber...');
    
    try {
      // Make API call to our auto-refresh endpoint instead of direct import
      const refreshResponse = await fetch(`${process.env.VERCEL_URL || 'https://shopifyapp-weld.vercel.app'}/api/auto-refresh-metafields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shop })
      });
      
      const refreshResult = await refreshResponse.json();
      console.log('Auto-refresh result:', refreshResult);
      
    } catch (error: any) {
      console.log('⚠️ Could not trigger automatic metafield refresh:', error.message);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Access token stored and metafield refresh triggered' 
    });
    
  } catch (error) {
    console.error('❌ Error in auth webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Auth webhook endpoint ready',
    timestamp: new Date().toISOString()
  });
}
