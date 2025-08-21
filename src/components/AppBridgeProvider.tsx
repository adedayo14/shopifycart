'use client';

import { createApp } from '@shopify/app-bridge';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, createContext, useContext } from 'react';

export function AppBridgeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const host = searchParams.get('host');
    const shop = searchParams.get('shop');
    
    if (host && shop) {
      const appConfig = {
        apiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '1117aad08ec2207e73d29446d0d7b712',
        host: host,
        forceRedirect: true,
      };
      
      setConfig(appConfig);
      
      // Store shop and host in session storage for navigation
      sessionStorage.setItem('shopify_shop', shop);
      sessionStorage.setItem('shopify_host', host);
    } else {
      // Check if we have stored values
      const storedShop = sessionStorage.getItem('shopify_shop');
      const storedHost = sessionStorage.getItem('shopify_host');
      
      if (storedShop && storedHost) {
        const appConfig = {
          apiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '1117aad08ec2207e73d29446d0d7b712',
          host: storedHost,
          forceRedirect: true,
        };
        
        setConfig(appConfig);
      }
    }
  }, [searchParams]);

  // Always render children - let the main page handle loading states
  return <>{children}</>;
} 