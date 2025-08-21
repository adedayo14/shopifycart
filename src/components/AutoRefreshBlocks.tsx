'use client';

import { useEffect } from 'react';

interface AutoRefreshBlocksProps {
  shop: string;
  enabled?: boolean;
}

export default function AutoRefreshBlocks({ shop, enabled = true }: AutoRefreshBlocksProps) {
  useEffect(() => {
    if (!enabled || !shop) return;

    // Auto-refresh blocks on component mount (when user visits the page)
    const refreshBlocks = async () => {
      try {
        console.log('Auto-refreshing blocks for', shop);
        const response = await fetch(`/api/auto-refresh-metafields`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ shop, forceRefresh: true }),
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            console.log('✅ Blocks auto-refreshed successfully');
          } else {
            console.log('❌ Auto-refresh failed:', result.error);
          }
        }
      } catch (error) {
        console.log('Auto-refresh error (non-critical):', error);
      }
    };

    // Add a small delay to avoid blocking the initial page load
    const timer = setTimeout(refreshBlocks, 2000);
    
    return () => clearTimeout(timer);
  }, [shop, enabled]);

  // This component renders nothing - it's purely functional
  return null;
}
