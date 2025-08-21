import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function getShopifySession(request: Request) {
  try {
    console.log('=== SESSION LOOKUP DEBUG ===');
    
    // 1. Extract session token (JWT) from request
    const authHeader = request.headers.get('Authorization');
    const idTokenHeader = request.headers.get('X-Shopify-ID-Token');
    let sessionToken = null;
    let shop = null;

    // Try multiple ways to get the session token
    if (authHeader?.startsWith('Bearer ')) {
      sessionToken = authHeader.replace('Bearer ', '');
    } else if (idTokenHeader) {
      sessionToken = idTokenHeader;
    } else {
      // Try request body
      try {
        const body = await request.clone().json();
        sessionToken = body.idToken;
        shop = body.shop; // Also get shop from body
      } catch (e) {
        // Not JSON body, try URL params
        const url = new URL(request.url);
        shop = url.searchParams.get('shop');
      }
    }

    console.log('Session token found:', !!sessionToken);
    console.log('Shop from request:', shop);

    // 2. If we have a session token (embedded app), decode it
    if (sessionToken) {
      try {
        // Decode JWT to get shop information
        const decoded = jwt.verify(sessionToken, process.env.SHOPIFY_API_SECRET!) as any;
        shop = decoded.dest.replace('https://', '');
        console.log('Shop from JWT:', shop);
        
        // Validate JWT claims
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp <= now) {
          const expiredAgo = now - decoded.exp;
          console.log(`JWT expired ${expiredAgo} seconds ago`);
          return {
            error: true,
            message: 'Session token expired - please refresh the page',
            needsFreshToken: true,
            shop: shop
          };
        }
        if (decoded.aud !== process.env.SHOPIFY_API_KEY) {
          console.log('JWT audience mismatch:', decoded.aud, 'vs', process.env.SHOPIFY_API_KEY);
          return {
            error: true,
            message: 'Invalid session token audience'
          };
        }
        
        console.log('JWT validation successful');
        
      } catch (jwtError) {
        console.error('JWT verification failed:', jwtError);
        
        if (jwtError instanceof Error && jwtError.message.includes('expired')) {
          return {
            error: true,
            message: 'Session token expired - please refresh the page',
            needsFreshToken: true,
            shop: shop
          };
        }
        
        return {
          error: true,
          message: 'Invalid session token: ' + (jwtError instanceof Error ? jwtError.message : 'Unknown error')
        };
      }
    }

    // 3. If no shop found, return error
    if (!shop) {
      return {
        error: true,
        message: 'Shop parameter required'
      };
    }

    // Normalize shop domain
    if (!shop.endsWith('.myshopify.com')) {
      shop = `${shop}.myshopify.com`;
    }

    console.log('Looking up access token for shop:', shop);

    // 4. Look up access token in database
    const session = await prisma.session.findUnique({
      where: { id: shop } // Try primary key first
    });

    // Try alternate formats if not found
    let alternateSession = null;
    if (!session) {
      const shopWithoutDomain = shop.replace('.myshopify.com', '');
      alternateSession = await prisma.session.findUnique({
        where: { id: shopWithoutDomain }
      });
    }

    const finalSession = session || alternateSession;
    
    console.log('Database session found:', !!finalSession);
    console.log('Has access token:', !!finalSession?.accessToken);

    // 5. Return result
    if (!finalSession || !finalSession.accessToken) {
      return {
        error: true,
        message: 'No access token found - OAuth required',
        needsOAuth: true,
        shop: shop,
        hasSessionToken: !!sessionToken,
        isEmbedded: !!sessionToken
      };
    }

    return {
      shop: finalSession.shop,
      accessToken: finalSession.accessToken,
      scope: finalSession.scope || 'read_products,write_products',
      isEmbedded: !!sessionToken,
      sessionValid: true
    };

  } catch (error) {
    console.error('Session lookup error:', error);
    return {
      error: true,
      message: 'Session lookup failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    };
  }
}

// Helper function to generate OAuth URL with billing scopes
export function generateBillingOAuthUrl(shop: string): string {
  const scopes = 'read_products,write_products,write_payment_terms';
  const state = `${shop}:billing:${Date.now()}`;
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

    if (!code || !shop) {
      return { error: true, message: 'Missing OAuth parameters' };
    }

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

    const tokenData = await tokenResponse.json();

    // Save to database - both Session and Shop tables for compatibility
    await prisma.session.upsert({
      where: { id: shop },
      update: { 
        shop,
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
        state: 'active'
      },
      create: { 
        id: shop,
        shop,
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
        state: 'active'
      }
    });

    // Also save to Shop table for session checks
    await prisma.shop.upsert({
      where: { domain: shop },
      update: {
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
        isActive: true
      },
      create: {
        domain: shop,
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
        isActive: true
      }
    });

    console.log('OAuth tokens saved to both Session and Shop tables');

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

// Export functions that other files expect
export async function beginAuth(shop: string, isOnline: boolean = true) {
  const scopes = 'read_products,write_products,write_payment_terms';
  const state = `${shop}:auth:${Date.now()}`;
  const redirectUri = `${process.env.SHOPIFY_APP_URL}/api/auth/callback`;
  
  return `https://${shop}/admin/oauth/authorize?` +
    `client_id=${process.env.SHOPIFY_API_KEY}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${encodeURIComponent(state)}`;
}

export function createAdminApiClient(shop: string, accessToken: string) {
  return {
    shop,
    accessToken,
    async query(query: string, variables?: any) {
      const response = await fetch(`https://${shop}/admin/api/2023-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });
      
      return response.json();
    }
  };
}

// Re-export GraphQLClient for compatibility
export { GraphQLClient } from 'graphql-request';
