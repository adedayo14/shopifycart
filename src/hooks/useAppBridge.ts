'use client';

import { useEffect, useState, useCallback } from 'react';
import { createApp } from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge/utilities';
import { useSearchParams } from 'next/navigation';

interface AppBridgeHook {
  app: any | null;
  getSessionToken: () => Promise<string | null>;
  isReady: boolean;
}

export function useAppBridge(): AppBridgeHook {
  const searchParams = useSearchParams();
  const [app, setApp] = useState<any | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let host = searchParams.get('host');
    const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

    // If host is missing, try to extract it from the current URL or iframe context
    if (!host && typeof window !== 'undefined') {
      // Try to get host from current URL hash (Shopify sometimes puts it there)
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.replace('#', '?'));
      host = hashParams.get('host');
      
      // Try to get from parent frame if embedded
      if (!host && window.parent !== window) {
        try {
          const parentUrl = new URL(window.parent.location.href);
          host = parentUrl.searchParams.get('host');
        } catch (e) {
          // Cross-origin, can't access parent URL
          console.log('Cannot access parent frame URL (expected in embedded context)');
        }
      }
      
      // Try to reconstruct host from shop parameter (fallback)
      if (!host) {
        const shop = searchParams.get('shop');
        if (shop) {
          // Convert shop domain to base64 host format that Shopify uses
          const shopDomain = shop.endsWith('.myshopify.com') ? shop : `${shop}.myshopify.com`;
          host = btoa(shopDomain + '/admin').replace(/=/g, '');
          console.log('Reconstructed host from shop:', host);
        }
      }
    }

    console.log('App Bridge initialization:', { 
      host: host ? 'present' : 'missing', 
      apiKey: apiKey ? 'present' : 'missing',
      searchParams: Object.fromEntries(searchParams.entries()),
      windowLocation: typeof window !== 'undefined' ? window.location.href : 'server'
    });

    if (host && apiKey && typeof window !== 'undefined') {
      try {
        console.log('Creating Shopify App Bridge instance with host:', host);
        const shopifyApp = createApp({
          apiKey,
          host,
          forceRedirect: true
        });

        setApp(shopifyApp);
        setIsReady(true);
        console.log('App Bridge ready');
      } catch (error) {
        console.error('Failed to create Shopify app instance:', error);
        setIsReady(false);
      }
    } else {
      console.warn('Missing host or API key for App Bridge:', { 
        host: !!host, 
        apiKey: !!apiKey,
        actualHost: host,
        allParams: Object.fromEntries(searchParams.entries())
      });
      
      // If we're missing the host but have other Shopify parameters, 
      // this might be a direct access issue
      const shop = searchParams.get('shop');
      if (shop && !host) {
        console.warn('Direct access detected - app may not function properly without Shopify embedding');
        console.log('Possible solutions:');
        console.log('1. Ensure app URL in Shopify Partners includes ?host={{HOST}} parameter');
        console.log('2. Check that the app is being accessed through Shopify Admin, not directly');
      }
      
      setIsReady(false);
    }
  }, [searchParams]);

  const getSessionTokenFromBridge = useCallback(async (): Promise<string | null> => {
    if (!app) {
      console.warn('App Bridge not ready, cannot get session token');
      return null;
    }

    try {
      console.log('Getting session token from App Bridge...');
      const token = await getSessionToken(app);
      console.log('Session token obtained:', !!token);
      return token;
    } catch (error) {
      console.error('Failed to get session token:', error);
      return null;
    }
  }, [app]);

  return {
    app,
    getSessionToken: getSessionTokenFromBridge,
    isReady
  };
}
