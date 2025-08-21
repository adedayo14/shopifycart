'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import React from 'react';
import { useAppBridge } from '../hooks/useAppBridge';
import MarketplaceContent from './marketplace/marketplace-content';

function HomeContent() {
  const [shop, setShop] = useState('');
  const [isInstalled, setIsInstalled] = useState(false);
  const [installedShop, setInstalledShop] = useState('');
  const [isClient, setIsClient] = useState(false);
  const searchParams = useSearchParams();
  const { getSessionToken, isReady: appBridgeReady } = useAppBridge();

  // Simple shop detection
  useEffect(() => {
    setIsClient(true);
    const shopParam = searchParams.get('shop');
    if (shopParam) {
      setShop(shopParam);
    }
  }, [searchParams]);

  // Failsafe: Always set as installed after 2 seconds regardless
  useEffect(() => {
    if (!isClient) return;
    
    const failsafeTimer = setTimeout(() => {
      console.log('Failsafe: Setting app as installed after timeout');
      setIsInstalled(true);
      if (shop) {
        setInstalledShop(shop);
      }
    }, 2000);
    
    return () => clearTimeout(failsafeTimer);
  }, [isClient, shop]);

  // Initialize App Bridge and session (needed for billing) but avoid install screens
  useEffect(() => {
    if (!isClient || !shop) return;

    const initializeSession = async () => {
      try {
        console.log('Initializing session for shop:', shop);
        
        // Wait a moment for App Bridge to be ready if needed
        if (!appBridgeReady) {
          console.log('Waiting for App Bridge to be ready...');
          setTimeout(() => initializeSession(), 100);
          return;
        }
        
        // Try to get session token for billing functionality
        let sessionToken = null;
        try {
          sessionToken = await getSessionToken();
          console.log('Session token obtained:', !!sessionToken);
        } catch (error) {
          console.warn('Could not get session token (this is OK for navigation):', error);
        }
        
        // Always treat as installed to avoid install screens
        // but preserve session token for billing
        console.log('Shop detected - treating as installed with session support');
        setIsInstalled(true);
        setInstalledShop(shop);
        
        // Auto-refresh blocks in background to ensure metafields are up-to-date
        // This ensures new blocks like reveal-banner appear in theme editor automatically
        if (sessionToken) {
          console.log('Auto-refreshing blocks in background...');
          fetch('/api/auto-refresh-metafields', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ shop })
          }).then(response => response.json())
            .then(result => {
              if (result.success) {
                console.log('✅ Blocks auto-refreshed successfully');
              } else {
                console.log('⚠️ Auto-refresh completed with issues:', result.message);
              }
            })
            .catch(error => {
              console.log('Auto-refresh failed (non-critical):', error);
            });
        }
        
      } catch (error) {
        console.error('Error initializing session:', error);
        // Even on error, treat as installed to avoid install screen
        setIsInstalled(true);
        setInstalledShop(shop);
      }
    };

    // Start initialization
    initializeSession();
    
  }, [isClient, shop, appBridgeReady, getSessionToken]);

  // Show branded loading screen while app loads
  if (!isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-6">
            {/* Animated Trifoli Logo */}
            <div className="mx-auto w-24 h-24 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl animate-pulse"></div>
              <div className="absolute inset-2 bg-white rounded-xl flex items-center justify-center">
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  T
                </span>
              </div>
            </div>
            
            {/* Brand Name */}
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight animate-bounce">
                Trifoli
              </h1>
              <p className="text-lg text-gray-600">
                Elevating your store with premium blocks
              </p>
            </div>
            
            {/* Loading Animation */}
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <p className="text-sm text-gray-500">Loading your marketplace...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show marketplace when app is ready
  return <MarketplaceContent />;
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
