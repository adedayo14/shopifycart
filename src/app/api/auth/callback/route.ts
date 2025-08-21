import { NextRequest, NextResponse } from 'next/server';
import { validateAuthCallback } from '../../../../lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('=== OAUTH CALLBACK ===');
    
    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    const host = url.searchParams.get('host');
    
    const result = await validateAuthCallback(request);
    
    if (result.error) {
      console.error('OAuth callback error:', result.message);
      const errorUrl = new URL(`${process.env.SHOPIFY_APP_URL}/marketplace`);
      errorUrl.searchParams.set('error', result.message);
      if (host) errorUrl.searchParams.set('host', host);
      return NextResponse.redirect(errorUrl.toString());
    }
    
    console.log('OAuth callback successful for shop:', result.shop);
    
    // Redirect back to the app with success and host parameter
    const successUrl = new URL(`${process.env.SHOPIFY_APP_URL}/marketplace`);
    if (result.shop) {
      successUrl.searchParams.set('shop', result.shop);
    }
    successUrl.searchParams.set('oauth_success', 'true');
    if (host) {
      successUrl.searchParams.set('host', host);
    }
    
    return NextResponse.redirect(successUrl.toString());
    
  } catch (error) {
    console.error('OAuth callback exception:', error);
    const errorUrl = new URL(`${process.env.SHOPIFY_APP_URL}/marketplace`);
    errorUrl.searchParams.set('error', 'OAuth callback failed');
    return NextResponse.redirect(errorUrl.toString());
  }
} 
