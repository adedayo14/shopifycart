// Enhanced Shopify Session Management for Embedded Apps
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// Fix environment variables in production - inline
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  const correctDatabaseUrl = 'postgres://neondb_owner:npg_K4EJuhNx6bps@ep-soft-unit-adlij0zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('file:')) {
    console.log('=== FIXING DATABASE_URL IN SHOPIFY-SESSION ===');
    process.env.DATABASE_URL = correctDatabaseUrl;
    console.log('Fixed DATABASE_URL in shopify-session');
  }
}

const prisma = new PrismaClient();

export interface SessionResult {
  error?: boolean;
  message?: string;
  shop?: string;
  accessToken?: string;
  scope?: string;
  isEmbedded?: boolean;
  needsOAuth?: boolean;
  needsFreshToken?: boolean;
  sessionValid?: boolean;
}

export async function getShopifySession(request: Request): Promise<SessionResult> {
  try {
    console.log('=== ENHANCED SESSION LOOKUP ===');
    
    let sessionToken: string | null = null;
    let shop: string | null = null;

    // 1. Extract session token from multiple sources
    const authHeader = request.headers.get('Authorization');
    const idTokenHeader = request.headers.get('X-Shopify-ID-Token');
    const shopHeader = request.headers.get('X-Shopify-Shop-Domain');

    if (authHeader?.startsWith('Bearer ')) {
      sessionToken = authHeader.replace('Bearer ', '');
    } else if (idTokenHeader) {
      sessionToken = idTokenHeader;
    }

    // Get shop from header first (most reliable)
    if (shopHeader) {
      shop = shopHeader;
    }

    // If no session token, try request body/URL
    if (!sessionToken || !shop) {
      try {
        const body = await request.clone().json();
        sessionToken = sessionToken || body.sessionToken || body.idToken;
        shop = shop || body.shop;
      } catch (e) {
        // Not JSON, try URL params
        const url = new URL(request.url);
        shop = shop || url.searchParams.get('shop');
      }
    }

    console.log('Session token found:', !!sessionToken);
    console.log('Shop from request:', shop);

    // 2. Handle embedded app session token
    if (sessionToken) {
      return await handleEmbeddedSession(sessionToken, shop || undefined);
    }

    // 3. Handle non-embedded session (direct OAuth)
    if (shop) {
      return await handleDirectSession(shop);
    }

    return {
      error: true,
      message: 'No shop or session token provided'
    };

  } catch (error) {
    console.error('Session lookup error:', error);
    return {
      error: true,
      message: 'Session lookup failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    };
  }
}

async function handleEmbeddedSession(sessionToken: string, shop?: string): Promise<SessionResult> {
  try {
    // Verify and decode JWT
    const decoded = jwt.verify(sessionToken, process.env.SHOPIFY_API_SECRET!) as any;
    
    const jwtShop = decoded.dest?.replace('https://', '') || decoded.iss?.replace('https://', '');
    const finalShop = shop || jwtShop;

    if (!finalShop) {
      return {
        error: true,
        message: 'Unable to determine shop from session token'
      };
    }

    // Validate JWT claims
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp <= now) {
      return {
        error: true,
        message: 'Session token expired - please refresh the app',
        needsFreshToken: true,
        shop: finalShop,
        isEmbedded: true
      };
    }

    if (decoded.aud !== process.env.SHOPIFY_API_KEY) {
      return {
        error: true,
        message: 'Invalid session token audience',
        isEmbedded: true
      };
    }

    console.log('JWT validation successful for shop:', finalShop);

    // Look up access token in database
    const session = await findSessionInDatabase(finalShop);
    
    if (!session) {
      console.log('No session found in database for shop:', finalShop);
      return {
        error: true,
        message: 'App needs billing permissions - OAuth required',
        needsOAuth: true,
        shop: finalShop,
        isEmbedded: true
      };
    }

    console.log('Session found in database for shop:', finalShop);
    return {
      shop: session.shop,
      accessToken: session.accessToken,
      scope: session.scope || 'read_products,write_products',
      isEmbedded: true,
      sessionValid: true
    };

  } catch (jwtError) {
    console.error('JWT verification failed:', jwtError);
    
    if (jwtError instanceof Error && jwtError.message.includes('expired')) {
      return {
        error: true,
        message: 'Session token expired - please refresh the app',
        needsFreshToken: true,
        isEmbedded: true
      };
    }

    return {
      error: true,
      message: 'Invalid session token: ' + (jwtError instanceof Error ? jwtError.message : 'Unknown error'),
      isEmbedded: true
    };
  }
}

async function handleDirectSession(shop: string): Promise<SessionResult> {
  // Normalize shop domain
  let normalizedShop = shop;
  if (!normalizedShop.endsWith('.myshopify.com')) {
    normalizedShop = `${normalizedShop}.myshopify.com`;
  }

  console.log('Looking up direct session for shop:', normalizedShop);

  const session = await findSessionInDatabase(normalizedShop);
  
  if (!session) {
    return {
      error: true,
      message: 'No access token found - OAuth required',
      needsOAuth: true,
      shop: normalizedShop,
      isEmbedded: false
    };
  }

  return {
    shop: session.shop,
    accessToken: session.accessToken,
    scope: session.scope || 'read_products,write_products',
    isEmbedded: false,
    sessionValid: true
  };
}

async function findSessionInDatabase(shop: string) {
  // Try multiple shop formats
  const shopFormats = [
    shop,
    shop.replace('.myshopify.com', ''),
    shop.endsWith('.myshopify.com') ? shop : `${shop}.myshopify.com`
  ];

  for (const shopFormat of shopFormats) {
    const session = await prisma.session.findUnique({
      where: { id: shopFormat }
    });
    
    if (session && session.accessToken) {
      console.log('Found session for shop format:', shopFormat);
      return session;
    }
  }

  console.log('No session found for any shop format:', shopFormats);
  return null;
}

// Helper function to generate OAuth URL with billing scopes
export function generateBillingOAuthUrl(shop: string): string {
  const scopes = 'read_products,write_products,write_payment_terms';
  const nonce = Math.random().toString(36).substring(2, 15);
  const state = `${shop}:billing:${Date.now()}:${nonce}`;
  const redirectUri = `${process.env.SHOPIFY_APP_URL}/api/auth/callback`;
  
  return `https://${shop}/admin/oauth/authorize?` +
    `client_id=${process.env.SHOPIFY_API_KEY}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${encodeURIComponent(state)}`;
}

// OAuth callback handler
export async function validateAuthCallback(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const shop = url.searchParams.get('shop');
    const state = url.searchParams.get('state');

    if (!code || !shop) {
      return { error: true, message: 'Missing OAuth parameters' };
    }

    // Validate state parameter
    if (state && !state.startsWith(shop)) {
      return { error: true, message: 'Invalid state parameter' };
    }

    console.log('Processing OAuth callback for shop:', shop);

    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code: code
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return { error: true, message: 'Failed to exchange OAuth code' };
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully obtained access token for shop:', shop);

    // Save to database
    await prisma.session.upsert({
      where: { id: shop },
      update: { 
        shop,
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
        state: 'active',
        updatedAt: new Date()
      },
      create: { 
        id: shop,
        shop,
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
        state: 'active'
      }
    });

    return {
      shop,
      accessToken: tokenData.access_token,
      scope: tokenData.scope
    };

  } catch (error) {
    console.error('OAuth callback error:', error);
    return { error: true, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export { prisma };
