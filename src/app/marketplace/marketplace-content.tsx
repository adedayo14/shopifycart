'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createApp } from '@shopify/app-bridge'
import { Redirect } from '@shopify/app-bridge/actions'
import { useAppBridge } from '../../hooks/useAppBridge'
import blocksConfig, { BlockMeta } from '../../config/blocks'
import './marketplace-styles.css'

// Types
type Block = BlockMeta & {
  previewUrl?: string
  isInstalled?: boolean
}

interface PlanFeature {
  text: string
  included: boolean
  tooltip?: string
}

interface ShopInfo {
  shop: string
  isReady: boolean
  sessionToken?: string
}

interface SubscriptionStatus {
  hasSubscription: boolean
  subscription?: {
    id?: string
    planType: string
    status: string
    currentPeriodEnd: string
    currentPeriodStart?: string
    chargeId?: string
  }
}

// Video guides data
const videoGuides = [
  {
    id: 'setup-guide',
    title: 'Getting Started',
    description: 'Learn how to install and set up your first block',
    videoId: 'ybi_UWzdA8w',
    duration: '2:30'
  },
  {
    id: 'customization-guide', 
    title: 'Customization Tips',
    description: 'Master the art of customizing blocks for your brand',
    videoId: 'GLnRLXcRjMQ',
    duration: '3:15'
  },
  {
    id: 'advanced-features',
    title: 'Advanced Features',
    description: 'Unlock powerful features and integrations',
    videoId: 'hW3pVFoXCi4',
    duration: '4:20'
  }
]

// Constants
const API_ENDPOINTS = {
  SESSION_CHECK: '/api/session/check',
  SUBSCRIPTION: '/api/subscription-management',
  MY_BLOCKS: '/api/my-blocks',
  PURCHASE_BLOCK: '/api/purchase-block', // Use real purchase endpoint
  SUBSCRIBE: '/api/subscribe',
  INSTALL: '/api/shopify-install'
} as const

// Custom hooks
const useShopifyApp = () => {
  const searchParams = useSearchParams()
  const [app, setApp] = useState<any>(null)
  
  useEffect(() => {
    const host = searchParams.get('host')
    const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY
    
    if (host && apiKey && typeof window !== 'undefined') {
      try {
        const shopifyApp = createApp({
          apiKey,
          host,
          forceRedirect: true
        })
        setApp(shopifyApp)
      } catch (error) {
        console.error('Failed to create Shopify app instance:', error)
      }
    }
  }, [searchParams])
  
  return app
}

const useShopifySession = () => {
  const searchParams = useSearchParams()
  const { getSessionToken, isReady: appBridgeReady } = useAppBridge()
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null)
  const [loading, setLoading] = useState(true)
  
  const initializeSession = useCallback(async () => {
    try {
      let shop = searchParams.get('shop')
      
      // Try to get shop from localStorage if not in URL
      if (!shop && typeof window !== 'undefined') {
        shop = localStorage.getItem('currentShop')
        console.log('Using shop from localStorage:', shop)
        
        // If we found a shop in localStorage, update the URL to include it
        if (shop) {
          const url = new URL(window.location.href)
          url.searchParams.set('shop', shop)
          window.history.replaceState({}, '', url.toString())
        }
      }
      
      if (!shop) {
        console.log('No shop parameter found in URL or localStorage')
        setLoading(false)
        return
      }
      
      console.log('Initializing session for shop:', shop)
      
      // Store shop for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('currentShop', shop)
      }
      
      // Check if user just completed OAuth installation
      const oauthSuccess = searchParams.get('oauth_success')
      if (oauthSuccess === 'true') {
        console.log('OAuth installation completed - verifying session...')
        // Clear the oauth_success parameter from URL
        const url = new URL(window.location.href)
        url.searchParams.delete('oauth_success')
        window.history.replaceState({}, '', url.toString())
        
        // Wait a moment for OAuth session to propagate, then verify via API
        setTimeout(async () => {
          try {
            const response = await fetch(`${API_ENDPOINTS.SESSION_CHECK}?shop=${encodeURIComponent(shop)}`)
            const data = await response.json()
            console.log('Post-OAuth session check:', data)
            
            setShopInfo({
              shop,
              isReady: data.success && !data.requiresInstallation,
              sessionToken: data.sessionToken
            })
          } catch (error) {
            console.error('Post-OAuth session check failed:', error)
            // Fall back to assuming they need installation
            setShopInfo({ shop, isReady: false, sessionToken: undefined })
          }
        }, 1000) // Wait 1 second for OAuth to complete
        return
      }
      
      // Get session token from App Bridge (for embedded apps)
      let sessionToken: string | null = null
      if (appBridgeReady) {
        try {
          sessionToken = await getSessionToken()
          console.log('App Bridge session token obtained:', !!sessionToken)
          
          // Store the session token for reuse
          if (sessionToken && typeof window !== 'undefined') {
            localStorage.setItem('sessionToken', sessionToken)
          }
        } catch (error) {
          console.warn('Failed to get App Bridge session token:', error)
          
          // Try to get cached session token
          if (typeof window !== 'undefined') {
            const cachedToken = localStorage.getItem('sessionToken')
            if (cachedToken) {
              console.log('Using cached session token')
              sessionToken = cachedToken
            }
          }
        }
      }
      
      // Fallback: Check URL params for id_token (direct links)
      const urlIdToken = searchParams.get('id_token')
      if (!sessionToken && urlIdToken) {
        sessionToken = urlIdToken
        console.log('Using URL id_token as session token')
      }
      
      if (sessionToken) {
        // Embedded app with valid token - they're authenticated
        console.log('Setting shopInfo with session token:', !!sessionToken)
        console.log('🔑 SESSION: Token length:', sessionToken?.length || 0)
        setShopInfo({ shop, isReady: true, sessionToken })
      } else {
        // Check session status via API (for non-embedded or direct access)
        try {
          const response = await fetch(`${API_ENDPOINTS.SESSION_CHECK}?shop=${encodeURIComponent(shop)}`)
          
          if (response.ok) {
            const data = await response.json()
            console.log('Session check response:', data)
            
            // If they have a valid session, they're ready to use the app
            setShopInfo({
              shop,
              isReady: data.success && !data.requiresInstallation,
              sessionToken: data.sessionToken || sessionToken // Use API token or App Bridge token
            })
          } else {
            // API error - assume they need installation
            console.error('Session check failed:', response.status)
            setShopInfo({
              shop,
              isReady: false,
              sessionToken: undefined
            })
          }
        } catch (apiError) {
          console.error('Session check API error:', apiError)
          // If API fails, assume they need installation
          setShopInfo({
            shop,
            isReady: false,
            sessionToken: undefined
          })
        }
      }
    } catch (error) {
      console.error('Session initialization error:', error)
    } finally {
      setLoading(false)
    }
  }, [searchParams, getSessionToken, appBridgeReady])
  
  useEffect(() => {
    // Wait for App Bridge to be ready before initializing session
    if (appBridgeReady || !searchParams.get('host')) {
      initializeSession()
    }
  }, [initializeSession, appBridgeReady, searchParams])
  
  return { shopInfo, loading, refetch: initializeSession }
}

// API utilities
const createAuthHeaders = (shop: string, sessionToken?: string) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Shopify-Shop-Domain': shop
  }
  
  // Pass session token in Authorization header (preferred by backend)
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`
    headers['X-Shopify-ID-Token'] = sessionToken // Keep both for compatibility
  }
  
  return headers
}

const apiRequest = async <T = any>(
  endpoint: string,
  options: {
    method?: string
    body?: any
    shop: string
    sessionToken?: string
  }
): Promise<T> => {
  const { method = 'GET', body, shop, sessionToken } = options
  
  // For GET requests, add shop as query parameter
  let url = endpoint
  if (method === 'GET') {
    const urlObj = new URL(endpoint, window.location.origin)
    urlObj.searchParams.set('shop', shop)
    url = urlObj.toString()
  }
  
  console.log('apiRequest:', {
    url,
    method,
    body,
    shop,
    sessionToken: sessionToken ? `present (${sessionToken.length} chars)` : 'missing'
  })
  
  const response = await fetch(url, {
    method,
    headers: createAuthHeaders(shop, sessionToken),
    ...(body && method !== 'GET' && { body: JSON.stringify(body) })
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    const error = new Error(errorData.message || errorData.error || `HTTP ${response.status}`)
    // Preserve the full error response data for special handling
    ;(error as any).responseData = errorData
    throw error
  }
  
  return response.json()
}

// Main component
export default function MarketplaceContent() {
  const searchParams = useSearchParams()
  const app = useShopifyApp()
  const { shopInfo, loading: sessionLoading, refetch: refetchSession } = useShopifySession()
  const { getSessionToken, isReady: appBridgeReady } = useAppBridge()
  
  // State
  const [blocks] = useState<Block[]>(blocksConfig)
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set())
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [purchasedBlocks, setPurchasedBlocks] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [showSuggestionForm, setShowSuggestionForm] = useState(false)
  const [suggestionFormData, setSuggestionFormData] = useState({
    name: '',
    email: '',
    blockDescription: '',
    features: '',
    websiteLink: '',
    image: null as File | null
  })
  const [customFormData, setCustomFormData] = useState({
    name: '',
    email: '',
    blockDescription: '',
    features: '',
    timeline: 'Not specified',
    budget: 'Not specified',
    whatsappContact: false,
    whatsappNumber: ''
  })
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  
  // Auto-refresh state
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<number>(0)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  
  // Manual shop entry state
  const [manualShop, setManualShop] = useState('')
  const [manualShopError, setManualShopError] = useState('')
  
  // OAuth loop prevention
  const [lastOAuthAttempt, setLastOAuthAttempt] = useState<number>(0)
  const [oauthRetryCount, setOauthRetryCount] = useState<number>(0)
  const OAUTH_COOLDOWN = 30000 // 30 seconds
  const MAX_OAUTH_RETRIES = 3
  
  // Get unique categories for filter
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(blocks.map(block => block.category)))
    return ['All', ...uniqueCategories]
  }, [blocks])
  
  // Filter blocks by category
  const filteredBlocks = useMemo(() => {
    if (selectedCategory === 'All') return blocks
    return blocks.filter(block => block.category === selectedCategory)
  }, [blocks, selectedCategory])
  
  // Handle OAuth success to reset retry counters
  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth_success')
    if (oauthSuccess === 'true') {
      console.log('OAuth success detected - resetting retry counters')
      setOauthRetryCount(0)
      setLastOAuthAttempt(0)
    }
  }, [searchParams])
  
  // Auto-refresh and session recovery
  const autoRefreshData = useCallback(async () => {
    if (!shopInfo?.shop || !shopInfo.isReady) return
    
    try {
      // Try to get fresh session token
      let freshToken = shopInfo.sessionToken
      if (appBridgeReady) {
        try {
          const newToken = await getSessionToken()
          if (newToken && newToken !== freshToken) {
            freshToken = newToken
            
            // Update localStorage
            if (typeof window !== 'undefined') {
              localStorage.setItem('sessionToken', freshToken)
            }
          }
        } catch (error) {
          console.warn('Could not get fresh token:', error)
        }
      }
      
      // Try to refresh subscription status
      const subData = await apiRequest<any>(API_ENDPOINTS.SUBSCRIPTION, {
        shop: shopInfo.shop,
        sessionToken: freshToken
      })
      
      setSubscriptionStatus(subData)
      setLastSuccessfulFetch(Date.now())
      
      // Clear any existing errors since refresh worked
      setError(null)
      
      // If active subscription, user has access to all blocks
      if (subData.hasSubscription && subData.subscription?.status === 'active') {
        setPurchasedBlocks(blocks.map(b => b.id))
      } else {
        // Refresh purchased blocks too
        const blocksData = await apiRequest<any>(API_ENDPOINTS.MY_BLOCKS, {
          shop: shopInfo.shop,
          sessionToken: freshToken
        })
        
        if (blocksData.success && blocksData.blocks) {
          setPurchasedBlocks(blocksData.blocks.map((block: any) => block.blockId))
        }
      }
      
    } catch (error) {
      console.warn('Auto-refresh failed:', error)
      // Don't show errors for background refresh failures
    }
  }, [shopInfo, appBridgeReady, getSessionToken, blocks])
  
  // Set up automatic refresh interval
  useEffect(() => {
    if (shopInfo?.isReady && !refreshInterval) {
      const interval = setInterval(() => {
        const timeSinceLastSuccess = Date.now() - lastSuccessfulFetch
        
        // Only auto-refresh if it's been more than 25 seconds since last successful fetch
        // This prevents rapid refreshing but ensures fresh data
        if (timeSinceLastSuccess > 25000) {
          autoRefreshData()
        }
      }, 30000) // Check every 30 seconds
      
      setRefreshInterval(interval)
      
      // Initial successful fetch timestamp
      setLastSuccessfulFetch(Date.now())
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        setRefreshInterval(null)
      }
    }
  }, [shopInfo, refreshInterval, autoRefreshData, lastSuccessfulFetch])
  
  // Page visibility change handling - refresh when user comes back to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && shopInfo?.isReady) {
        const timeSinceLastSuccess = Date.now() - lastSuccessfulFetch
        
        // If user comes back to tab and it's been more than 2 minutes, refresh
        if (timeSinceLastSuccess > 120000) {
          autoRefreshData()
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [shopInfo, autoRefreshData, lastSuccessfulFetch])
  
  // Window focus handling - refresh when user focuses window
  useEffect(() => {
    const handleWindowFocus = () => {
      if (shopInfo?.isReady) {
        const timeSinceLastSuccess = Date.now() - lastSuccessfulFetch
        
        // If user focuses window and data is stale, refresh
        if (timeSinceLastSuccess > 60000) {
          autoRefreshData()
        }
      }
    }
    
    window.addEventListener('focus', handleWindowFocus)
    
    return () => {
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [shopInfo, autoRefreshData, lastSuccessfulFetch])
  const fetchSubscriptionStatus = useCallback(async () => {
    if (!shopInfo?.shop) return
    
    try {
      // Try to get fresh session token if we don't have one
      let sessionToken = shopInfo.sessionToken
      if (!sessionToken && appBridgeReady) {
        try {
          const freshToken = await getSessionToken()
          if (freshToken) {
            sessionToken = freshToken
          }
        } catch (error) {
          console.warn('Failed to get fresh session token:', error)
        }
      }
      
      const data = await apiRequest<any>(API_ENDPOINTS.SUBSCRIPTION, {
        shop: shopInfo.shop,
        sessionToken: sessionToken
      })
      
      console.log('✅ MARKETPLACE: Subscription API response:', data)
      
      setSubscriptionStatus(data)
      setLastSuccessfulFetch(Date.now()) // Update successful fetch timestamp
      
      // If active subscription, user has access to all blocks
      if (data.hasSubscription && data.subscription?.status === 'active') {
        setPurchasedBlocks(blocks.map(b => b.id))
        
        // Auto-refresh block access for active subscribers to ensure they have access to new blocks
        try {
          console.log('🔄 Auto-refreshing block access for active subscriber...');
          const refreshResponse = await fetch('/api/refresh-blocks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shop: shopInfo.shop
            })
          });
          
          const refreshResult = await refreshResponse.json();
          if (refreshResult.success) {
            console.log('✅ Successfully refreshed block access:', refreshResult.message);
          } else {
            console.warn('⚠️ Block refresh warning:', refreshResult.error);
          }
        } catch (refreshError) {
          console.warn('Block access refresh failed (non-critical):', refreshError);
        }
      } else {
        // Only fetch individual purchased blocks if no subscription
        await fetchPurchasedBlocks()
      }
    } catch (error) {
      console.error('Failed to fetch subscription status:', error)
      
      // Trigger automatic recovery attempt after a delay
      setTimeout(() => {
        autoRefreshData()
      }, 5000)
      
      // Still try to fetch purchased blocks if subscription check fails
      fetchPurchasedBlocks()
    }
  }, [shopInfo, blocks, getSessionToken, appBridgeReady, autoRefreshData])
  
  const fetchPurchasedBlocks = useCallback(async () => {
    if (!shopInfo?.shop) return
    
    try {
      // Try to get fresh session token if we don't have one
      let sessionToken = shopInfo.sessionToken
      if (!sessionToken && appBridgeReady) {
        try {
          const freshToken = await getSessionToken()
          if (freshToken) {
            sessionToken = freshToken
          }
        } catch (error) {
          console.warn('Failed to get fresh session token for blocks:', error)
        }
      }
      
      const data = await apiRequest<any>(API_ENDPOINTS.MY_BLOCKS, {
        shop: shopInfo.shop,
        sessionToken: sessionToken
      })
      
      if (data.success && data.blocks) {
        setPurchasedBlocks(data.blocks.map((block: any) => block.blockId))
        setLastSuccessfulFetch(Date.now()) // Update successful fetch timestamp
      }
    } catch (error: any) {
      console.error('Failed to fetch purchased blocks:', error)
      
      // If session token expired, try to get fresh token and retry
      if (error.message?.includes('SESSION_TOKEN_EXPIRED') || error.message?.includes('session')) {
        console.log('Session may have expired for my-blocks, trying fresh token...')
        try {
          const freshToken = await getSessionToken()
          if (freshToken) {
            const retryData = await apiRequest<any>(API_ENDPOINTS.MY_BLOCKS, {
              shop: shopInfo.shop,
              sessionToken: freshToken
            })
            
            if (retryData.success && retryData.blocks) {
              setPurchasedBlocks(retryData.blocks.map((block: any) => block.blockId))
              setLastSuccessfulFetch(Date.now()) // Update successful fetch timestamp
            }
          }
        } catch (retryError) {
          console.error('Failed to retry fetching purchased blocks:', retryError)
          
          // Trigger automatic recovery attempt after a delay
          setTimeout(() => {
            console.log('🔄 BLOCKS: Attempting automatic recovery after blocks fetch failure')
            autoRefreshData()
          }, 5000)
        }
      }
    }
  }, [shopInfo, getSessionToken, appBridgeReady, autoRefreshData])
  
  useEffect(() => {
    if (shopInfo?.isReady) {
      fetchSubscriptionStatus()
      fetchPurchasedBlocks()
    }
  }, [shopInfo, fetchSubscriptionStatus, fetchPurchasedBlocks])
  
  // Handlers
  const handleRedirect = useCallback((url: string) => {
    console.log('🔄 Handling redirect to:', url)
    
    // Check if this is an OAuth URL and prevent loops
    if (url.includes('/admin/oauth/authorize')) {
      const now = Date.now()
      const timeSinceLastOAuth = now - lastOAuthAttempt
      
      console.log('OAuth redirect requested:', {
        url,
        timeSinceLastOAuth,
        retryCount: oauthRetryCount,
        cooldownRemaining: Math.max(0, OAUTH_COOLDOWN - timeSinceLastOAuth)
      })
      
      // Prevent rapid OAuth attempts
      if (timeSinceLastOAuth < OAUTH_COOLDOWN) {
        console.warn('OAuth redirect blocked - still in cooldown period')
        setError(`Please wait ${Math.ceil((OAUTH_COOLDOWN - timeSinceLastOAuth) / 1000)} more seconds before trying again.`)
        return
      }
      
      // Prevent too many OAuth attempts
      if (oauthRetryCount >= MAX_OAUTH_RETRIES) {
        console.error('OAuth retry limit exceeded')
        setError(`Too many authorization attempts (${oauthRetryCount}/${MAX_OAUTH_RETRIES}). This might indicate a configuration issue. Please contact support or try refreshing the page.`)
        return
      }
      
      setLastOAuthAttempt(now)
      setOauthRetryCount(prev => prev + 1)
    }
    
    // For billing/admin URLs, use top-level redirect to avoid frame issues
    if (url.includes('admin.shopify.com') || url.includes('/admin/charges') || url.includes('billing') || url.includes('/admin/') || url.includes('shopify.com')) {
      console.log('🔄 Using top-level redirect for admin/billing URL')
      if (window.top) {
        window.top.location.href = url
      } else {
        window.location.href = url
      }
      return
    }
    
    if (app) {
      try {
        console.log('🔄 Using App Bridge redirect')
        Redirect.create(app).dispatch(Redirect.Action.REMOTE, url)
      } catch (error) {
        console.error('App Bridge redirect failed:', error)
        console.log('🔄 Falling back to window.location.href')
        window.location.href = url
      }
    } else {
      console.log('🔄 No App Bridge, using window.location.href')
      window.location.href = url
    }
  }, [app, lastOAuthAttempt, oauthRetryCount, OAUTH_COOLDOWN, MAX_OAUTH_RETRIES])
  
  const handleInstallApp = useCallback(async () => {
    if (!shopInfo?.shop) return
    
    try {
      setLoading(true)
      const data = await apiRequest<any>(API_ENDPOINTS.INSTALL, {
        method: 'POST',
        body: { shop: shopInfo.shop },
        shop: shopInfo.shop
      })
      
      if (data.success && data.authUrl) {
        handleRedirect(data.authUrl)
      } else {
        throw new Error('Failed to get installation URL')
      }
    } catch (error) {
      console.error('Installation error:', error)
      setError('Failed to start installation. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [shopInfo, handleRedirect])
  
  const handleSubscribe = useCallback(async (planType: string) => {
    if (!shopInfo?.shop) return
    
    if (!shopInfo.isReady) {
      // Instead of prompting, automatically try to get a session token or install
      console.log('User not ready, attempting to authenticate or install...')
      
      // Try to get a fresh session token first
      if (appBridgeReady) {
        try {
          const freshToken = await getSessionToken()
          if (freshToken) {
            console.log('Got fresh session token, refetching session')
            refetchSession()
            // Continue with the subscription after refetch
            setTimeout(() => handleSubscribe(planType), 500)
            return
          }
        } catch (error) {
          console.warn('Could not get fresh session token:', error)
        }
      }
      
      // If no session token available, start installation
      handleInstallApp()
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      // Try to get fresh session token if we don't have one
      let sessionToken = shopInfo.sessionToken
      if (!sessionToken && appBridgeReady) {
        try {
          const freshToken = await getSessionToken()
          if (freshToken) {
            sessionToken = freshToken
          }
          console.log('🔄 SUBSCRIBE: Got fresh session token:', !!sessionToken)
        } catch (error) {
          console.warn('🔄 SUBSCRIBE: Failed to get fresh session token:', error)
        }
      }
      
      const result = await apiRequest<any>(API_ENDPOINTS.SUBSCRIBE, {
        method: 'POST',
        body: { 
          planType, 
          shop: shopInfo.shop,
          idToken: sessionToken || null 
        },
        shop: shopInfo.shop,
        sessionToken: sessionToken
      })
      
      // Handle session token expired - retry with fresh token
      if (result.error === 'SESSION_TOKEN_EXPIRED') {
        console.log('Session token expired, getting fresh token and retrying subscription...')
        try {
          // Get fresh session token
          const freshToken = await getSessionToken()
          if (freshToken) {
            console.log('Got fresh token, retrying subscription...')
            
            // Retry the subscription with fresh token
            const retryResult = await apiRequest<any>(API_ENDPOINTS.SUBSCRIBE, {
              method: 'POST',
              body: {
                planType,
                shop: shopInfo.shop,
                idToken: freshToken
              },
              shop: shopInfo.shop,
              sessionToken: freshToken
            })
            
            // Handle retry result
            if (retryResult.error === 'EMBEDDED_NEEDS_OAUTH' && retryResult.authUrl) {
              handleRedirect(retryResult.authUrl)
              return
            } else if (retryResult.success && retryResult.confirmationUrl) {
              handleRedirect(retryResult.confirmationUrl)
              return
            } else if (retryResult.error === 'APP_NOT_PUBLISHED') {
              setError('This app needs to be published to the Shopify App Store before billing features can be used.')
              return
            } else {
              throw new Error(retryResult.message || retryResult.error || 'Subscription failed after retry')
            }
          } else {
            throw new Error('Could not get fresh session token')
          }
        } catch (retryError) {
          console.error('Failed to retry subscription with fresh token:', retryError)
          setError('Your session needs to be refreshed. The system will automatically try to recover in a few seconds, or you can click Retry above.')
          
          // Trigger automatic recovery
          setTimeout(() => {
            console.log('🔄 SUBSCRIBE: Attempting automatic recovery after subscription failure')
            autoRefreshData()
          }, 3000)
          return
        }
      }
      
      if (result.error === 'EMBEDDED_NEEDS_OAUTH' && result.authUrl) {
        handleRedirect(result.authUrl)
        return
      }
      
      if (result.success && result.confirmationUrl) {
        handleRedirect(result.confirmationUrl)
      } else if (result.success && result.isDevelopment) {
        // Handle development mode success
        console.log('Development mode subscription created:', result)
        handleRedirect(result.confirmationUrl)
      } else if (result.error === 'APP_NOT_PUBLISHED') {
        setError('This app needs to be published to the Shopify App Store before billing features can be used.')
      } else if (result.error === 'BILLING_API_ERROR') {
        setError('Unable to create subscription at this time. Please try again or contact support if the problem persists.')
      } else {
        throw new Error(result.message || result.error || 'Subscription failed')
      }
    } catch (error: any) {
      console.error('Subscription error:', error)
      
      // Check if error has response data with OAuth info
      const errorData = error.responseData
      if (errorData) {
        // Handle session token expired
        if (errorData.error === 'SESSION_TOKEN_EXPIRED') {
          console.log('Session token expired in catch, getting fresh token and retrying...')
          try {
            const freshToken = await getSessionToken()
            if (freshToken) {
              console.log('Got fresh token in catch, retrying subscription...')
              // Recursive call with fresh token - will go through the main flow again
              return handleSubscribe(planType)
            }
          } catch (retryError) {
            console.error('Failed to retry subscription with fresh token:', retryError)
            setError('Your session needs to be refreshed. The system will automatically try to recover in a few seconds, or you can click Retry above.')
            
            // Trigger automatic recovery
            setTimeout(() => {
              console.log('🔄 SUBSCRIBE: Attempting automatic recovery after subscription failure')
              autoRefreshData()
            }, 3000)
            return
          }
        }
        
        // Handle OAuth redirect needed
        if (errorData.error === 'EMBEDDED_NEEDS_OAUTH' && errorData.authUrl) {
          console.log('Embedded app needs OAuth, redirecting to:', errorData.authUrl)
          handleRedirect(errorData.authUrl)
          return
        }
        
        // Handle billing API errors with better user messaging
        if (errorData.error === 'BILLING_API_ERROR') {
          setError('Unable to create subscription at this time. This may be because the app needs additional permissions. Please contact support if the problem persists.')
          return
        }
        
        // Handle app not published errors
        if (errorData.error === 'APP_NOT_PUBLISHED') {
          setError('This app needs to be published to the Shopify App Store before billing features can be used.')
          return
        }
      }
      
      // Handle generic errors with more user-friendly messages
      let userFriendlyMessage = 'Unable to start subscription. Please try again.'
      
      if (error.message.includes('GraphQL') || error.message.includes('API error')) {
        userFriendlyMessage = 'There was a problem connecting to Shopify\'s billing system. Please try again or contact support.'
      } else if (error.message.includes('permission') || error.message.includes('access')) {
        userFriendlyMessage = 'The app needs additional permissions to create subscriptions. Please contact support.'
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        userFriendlyMessage = 'Network error. Please check your connection and try again.'
      }
      
      setError(userFriendlyMessage)
    } finally {
      setLoading(false)
    }
  }, [shopInfo, handleInstallApp, handleRedirect, appBridgeReady, getSessionToken, refetchSession, autoRefreshData])
  
  const handleCancelSubscription = useCallback(async () => {
    if (!shopInfo?.shop || !subscriptionStatus?.subscription) return
    
    try {
      setCancelLoading(true)
      setError(null)
      
      // Get session token for the request
      let sessionToken = shopInfo.sessionToken
      if (!sessionToken && appBridgeReady) {
        try {
          const token = await getSessionToken()
          sessionToken = token || undefined
        } catch (error) {
          console.warn('Could not get session token for cancellation:', error)
        }
      }
      
      const result = await apiRequest<any>(API_ENDPOINTS.SUBSCRIPTION, {
        method: 'DELETE',
        body: {
          subscriptionId: (subscriptionStatus.subscription as any).chargeId || subscriptionStatus.subscription.planType,
          shop: shopInfo.shop
        },
        shop: shopInfo.shop,
        sessionToken: sessionToken
      })
      
      if (result.success) {
        // Refresh subscription status to reflect cancellation
        await fetchSubscriptionStatus()
        setShowCancelModal(false)
        // Show success message
        alert('Subscription cancelled successfully. You will retain access until the end of your current billing period.')
      } else {
        throw new Error(result.error || 'Failed to cancel subscription')
      }
    } catch (error: any) {
      console.error('Cancellation error:', error)
      setError(error.message || 'Failed to cancel subscription. Please try again.')
    } finally {
      setCancelLoading(false)
    }
  }, [shopInfo, subscriptionStatus, appBridgeReady, getSessionToken, fetchSubscriptionStatus])
  
  const handleCustomFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await fetch('/api/custom-block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...customFormData,
          shopDomain: shopInfo?.shop || 'unknown'
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert('Custom block request submitted successfully! We will contact you within 24 hours.')
        setShowCustomForm(false)
        setCustomFormData({
          name: '',
          email: '',
          blockDescription: '',
          features: '',
          timeline: 'Not specified',
          budget: 'Not specified',
          whatsappContact: false,
          whatsappNumber: ''
        })
      } else {
        throw new Error(result.error || 'Failed to submit request')
      }
    } catch (error: any) {
      console.error('Custom form error:', error)
      alert('Failed to submit request. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [customFormData, shopInfo])

  const handleSuggestionFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // First check if user has premium access before allowing suggestion
      if (!subscriptionStatus?.isActive && purchasedBlocks.length === 0) {
        alert('Please purchase a block or subscribe to suggest new blocks.')
        setLoading(false)
        return
      }

      const formData = new FormData()
      formData.append('name', suggestionFormData.name)
      formData.append('email', suggestionFormData.email)
      formData.append('blockDescription', suggestionFormData.blockDescription)
      formData.append('features', suggestionFormData.features)
      formData.append('websiteLink', suggestionFormData.websiteLink)
      formData.append('shopDomain', shopInfo?.shop || 'unknown')
      
      if (suggestionFormData.image) {
        formData.append('image', suggestionFormData.image)
      }

      const response = await fetch('/api/suggest-block', {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert('Block suggestion submitted successfully! Thank you for your input.')
        setShowSuggestionForm(false)
        setSuggestionFormData({
          name: '',
          email: '',
          blockDescription: '',
          features: '',
          websiteLink: '',
          image: null
        })
      } else {
        throw new Error(result.error || 'Failed to submit suggestion')
      }
    } catch (error: any) {
      console.error('Suggestion form error:', error)
      alert('Failed to submit suggestion. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [suggestionFormData, shopInfo, subscriptionStatus, purchasedBlocks])
  
  const handlePurchase = useCallback(async () => {
    if (!shopInfo?.shop || selectedBlocks.size === 0) return
    
    if (!shopInfo.isReady) {
      // Instead of prompting, try to authenticate or install silently  
      console.log('User not ready for purchase, attempting to authenticate...')
      
      // Try to get a fresh session token first
      if (appBridgeReady) {
        try {
          const freshToken = await getSessionToken()
          if (freshToken) {
            console.log('Got fresh session token, refetching session')
            refetchSession()
            // Continue with the purchase after refetch
            setTimeout(() => handlePurchase(), 500)
            return
          }
        } catch (error) {
          console.warn('Could not get fresh session token:', error)
        }
      }
      
      // If no session token available, start installation
      handleInstallApp()
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      const blockIds = Array.from(selectedBlocks)
      
      // Check for already purchased blocks
      const alreadyPurchased = blockIds.filter(id => purchasedBlocks.includes(id))
      if (alreadyPurchased.length > 0) {
        setError(`You have already purchased: ${alreadyPurchased.join(', ')}`)
        setLoading(false)
        return
      }
      
      const purchaseType = blockIds.length === 3 ? 'pick-and-mix' : 'individual'
      
      console.log('Making purchase request with:', {
        blockIds,
        purchaseType,
        shop: shopInfo.shop,
        sessionToken: shopInfo.sessionToken ? 'present' : 'missing'
      })
      
      const result = await apiRequest<any>(API_ENDPOINTS.PURCHASE_BLOCK, {
        method: 'POST',
        body: { 
          blockIds, 
          purchaseType, 
          shop: shopInfo.shop,
          idToken: shopInfo.sessionToken || null 
        },
        shop: shopInfo.shop,
        sessionToken: shopInfo.sessionToken
      })
      
      // Handle various response scenarios
      if (result.error === 'SESSION_TOKEN_EXPIRED') {
        console.log('Session token expired, getting fresh token and retrying...')
        try {
          // Get fresh session token
          const freshToken = await getSessionToken()
          if (freshToken) {
            console.log('Got fresh token, retrying purchase...')
            
            // Retry the purchase with fresh token
            const retryResult = await apiRequest<any>(API_ENDPOINTS.PURCHASE_BLOCK, {
              method: 'POST',
              body: {
                blockIds: Array.from(selectedBlocks),
                purchaseType: purchaseType,
                shop: shopInfo.shop,
                idToken: freshToken
              },
              shop: shopInfo.shop,
              sessionToken: freshToken
            })
            
            // Handle retry result
            if (retryResult.error === 'EMBEDDED_NEEDS_OAUTH' && retryResult.authUrl) {
              handleRedirect(retryResult.authUrl)
              return
            } else if (retryResult.success && retryResult.confirmationUrl) {
              handleRedirect(retryResult.confirmationUrl)
              return
            } else if (retryResult.success) {
              setSelectedBlocks(new Set())
              setCurrentPlan(null)
              await fetchPurchasedBlocks()
              return
            } else {
              throw new Error(retryResult.message || retryResult.error || 'Purchase failed after retry')
            }
          } else {
            throw new Error('Could not get fresh session token')
          }
        } catch (retryError) {
          console.error('Failed to retry purchase with fresh token:', retryError)
          setError('Your session needs to be refreshed. The system will automatically try to recover in a few seconds, or you can click Retry above.')
          
          // Trigger automatic recovery
          setTimeout(() => {
            console.log('🔄 PURCHASE: Attempting automatic recovery after purchase failure')
            autoRefreshData()
          }, 3000)
          return
        }
      }
      
      if (result.error === 'EMBEDDED_NEEDS_OAUTH' && result.authUrl) {
        handleRedirect(result.authUrl)
        return
      }
      
      // Handle billing API errors that need real OAuth
      if (result.error === 'billing_api_error' && result.needsRealOAuth) {
        console.log('Billing needs real OAuth - redirecting to OAuth flow')
        const scopes = 'read_products,write_products,write_payment_terms'
        const state = `${shopInfo.shop}:billing:${Date.now()}`
        const redirectUri = `${window.location.origin}/api/auth/callback`
        const authUrl = `https://${shopInfo.shop}/admin/oauth/authorize?` +
          `client_id=${process.env.NEXT_PUBLIC_SHOPIFY_API_KEY}&` +
          `scope=${encodeURIComponent(scopes)}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `state=${encodeURIComponent(state)}`
        handleRedirect(authUrl)
        return
      }
      
      if (result.success && result.confirmationUrl) {
        handleRedirect(result.confirmationUrl)
      } else if (result.success) {
        setSelectedBlocks(new Set())
        setCurrentPlan(null)
        // Refresh purchased blocks
        await fetchPurchasedBlocks()
      } else {
        throw new Error(result.message || result.error || 'Purchase failed')
      }
    } catch (error: any) {
      console.error('Purchase error:', error)
      
      // Check if error has response data with OAuth info
      const errorData = error.responseData
      if (errorData) {
        // Handle session token expired
        if (errorData.error === 'SESSION_TOKEN_EXPIRED') {
          console.log('Session token expired in catch, getting fresh token and retrying...')
          try {
            const freshToken = await getSessionToken()
            if (freshToken) {
              console.log('Got fresh token in catch, retrying purchase...')
              // Recursive call with fresh token - will go through the main flow again
              return handlePurchase()
            }
          } catch (retryError) {
            console.error('Failed to retry purchase with fresh token:', retryError)
            setError('Your session needs to be refreshed. The system will automatically try to recover in a few seconds, or you can click Retry above.')
            
            // Trigger automatic recovery
            setTimeout(() => {
              console.log('🔄 PURCHASE: Attempting automatic recovery after purchase failure')
              autoRefreshData()
            }, 3000)
            return
          }
        }
        
        // Handle OAuth redirect needed
        if (errorData.error === 'EMBEDDED_NEEDS_OAUTH' && errorData.authUrl) {
          console.log('Embedded app needs OAuth, redirecting to:', errorData.authUrl)
          handleRedirect(errorData.authUrl)
          return
        }
        
        // Handle other billing API errors that need OAuth
        if (errorData.error === 'billing_api_error' && errorData.needsRealOAuth) {
          console.log('Billing needs real OAuth - redirecting to OAuth flow')
          const scopes = 'read_products,write_products,write_payment_terms'
          const state = `${shopInfo.shop}:billing:${Date.now()}`
          const redirectUri = `${window.location.origin}/api/auth/callback`
          const authUrl = `https://${shopInfo.shop}/admin/oauth/authorize?` +
            `client_id=${process.env.NEXT_PUBLIC_SHOPIFY_API_KEY}&` +
            `scope=${encodeURIComponent(scopes)}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `state=${encodeURIComponent(state)}`
          handleRedirect(authUrl)
          return
        }
      }
      
      setError(error.message || 'Failed to process purchase. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [shopInfo, selectedBlocks, purchasedBlocks, handleInstallApp, handleRedirect, fetchPurchasedBlocks, appBridgeReady, getSessionToken, refetchSession])
  
  // Remove sync blocks functionality - everything should be automatic
  
  // Plans configuration
  const plans = useMemo(() => [
    {
      name: "Annual Access",
      subtitle: "Best Value",
      benefitLine: null,
      price: "$99",
      period: "per year",
      priceSubtext: "Just $8.25/month",
      description: "Pricing set for early adopters",
      features: [
        { text: "All current & future blocks", included: true },
        { text: "Always up to date", included: true },
        { text: "Try free for 30 days", included: true },
        { text: "New blocks added regularly", included: true }
      ],
      highlight: true,
      cta: "Go Annual – Save $80/year",
      ctaSubtext: "30-day free trial, then $99/year",
      badge: "Best Value",
      type: "subscription-annual",
      colorTheme: "navy"
    },
    {
      name: "Monthly Access",
      subtitle: "Most Flexible",
      benefitLine: null, 
      price: "$14.99",
      period: "per month",
      priceSubtext: null,
      description: "Pricing set for early adopters",
      features: [
        { text: "All current & future blocks", included: true },
        { text: "Cancel anytime", included: true },
        { text: "Always up to date", included: true },
        { text: "Try free for 30 days", included: true },
        { text: "New blocks added regularly", included: true }
      ],
      highlight: false,
      cta: "Start Monthly",
      ctaSubtext: "30-day free trial, then $14.99/month",
      badge: "Flexible",
      type: "subscription-monthly",
      colorTheme: "blue"
    },
    {
      name: "Build Your Toolkit",
      subtitle: "Pay Once, Keep Forever",
      benefitLine: null,
      price: "$29",
      period: "per block",
      priceSubtext: "3 blocks for $75 — own forever",
      description: "Own exactly what you need, forever",
      features: [
        { text: "Choose your blocks", included: true },
        { text: "Launch pricing – locked forever", included: true },
        { text: "Own them permanently", included: true },
        { text: "6 months of updates included", included: true }
      ],
      highlight: false,
      cta: "Build My Toolkit",
      ctaSubtext: "No subscription. Just a one-time purchase",
      badge: "Build",
      type: "one-time",
      colorTheme: "charcoal"
    }
  ], [])
  
  // Loading state
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading marketplace...</p>
        </div>
      </div>
    )
  }
  
  // Manual shop entry - only show if we truly have no shop info and aren't loading
  if (!shopInfo?.shop && !sessionLoading) {
    // Last attempt to get shop from localStorage before showing form
    const storedShop = typeof window !== 'undefined' ? localStorage.getItem('currentShop') : null
    if (storedShop) {
      // Redirect with stored shop parameter
      if (typeof window !== 'undefined') {
        window.location.href = `${window.location.pathname}?shop=${encodeURIComponent(storedShop)}`
      }
      return <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Trifoli</h1>
            <p className="text-gray-600 mb-4">
              Premium Shopify theme blocks for your store. Install the app to get started.
            </p>
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-2">Please enter your Shopify store URL</h2>
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <form
              onSubmit={e => {
                e.preventDefault()
                if (!manualShop || !manualShop.endsWith('.myshopify.com')) {
                  setManualShopError('Please enter a valid Shopify domain.')
                  return
                }
                setManualShopError('')
                if (typeof window !== 'undefined') {
                  localStorage.setItem('currentShop', manualShop)
                  window.location.href = `${window.location.pathname}?shop=${encodeURIComponent(manualShop)}`
                }
              }}
              className="space-y-4"
            >
              <input
                type="text"
                value={manualShop}
                onChange={e => setManualShop(e.target.value)}
                placeholder="your-store.myshopify.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              {manualShopError && <div className="text-red-600 text-sm">{manualShopError}</div>}
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Continue
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="app-title text-gray-900 mb-4">
            Trifolii: Blocks & Sections
          </h1>
          

        </div>
        
        {/* Error Display */}
        {error && (
          <div className="mb-6 mx-auto max-w-2xl">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Unable to Process Request</p>
                  <p className="text-sm">{error}</p>
                  {error.includes('Session') && (
                    <p className="text-xs mt-2 text-amber-700">
                      💡 The system will automatically try to reconnect in a few seconds.
                    </p>
                  )}
                  {error.includes('permissions') && (
                    <p className="text-xs mt-2 text-amber-700">
                      💡 You may need to reinstall the app or contact support for assistance.
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setError(null)
                  console.log('🔄 Manual recovery attempt after error')
                  autoRefreshData()
                }}
                className="ml-3 text-amber-700 hover:text-amber-900 text-sm font-medium flex items-center space-x-1"
                title="Try again"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Try Again</span>
              </button>
            </div>
          </div>
        )}
        
        {/* Pricing Section */}
        <div className="text-center mb-12">
           <h2 className="app-tagline text-slate-900 mb-4">
             Designed to convert. Built to impress.
           </h2>
          <p className="app-description text-slate-600 mb-2 max-w-3xl mx-auto leading-relaxed">
            Professional theme blocks built to feel native and boost conversions.
          </p>
        </div>
        
        {/* Plans Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          {plans.map((plan, index) => {
            const getColorStyles = (colorTheme: string, isHighlighted: boolean) => {
              switch (colorTheme) {
                case 'navy':
                  return {
                    border: isHighlighted ? 'border-slate-700 ring-2 ring-slate-200' : 'border-slate-200', // Lightened from slate-800 to slate-700
                    background: isHighlighted ? 'bg-gradient-to-br from-slate-50 to-blue-50' : 'bg-white',
                    badge: 'bg-slate-800 text-white',
                    button: 'bg-slate-800 hover:bg-slate-900 text-white', // Primary action - darkest
                    priceColor: 'text-slate-900',
                    shadow: isHighlighted ? 'shadow-xl shadow-slate-200/50' : 'shadow-md hover:shadow-lg'
                  }
                case 'blue':
                  return {
                    border: 'border-slate-200',
                    background: 'bg-white',
                    badge: 'bg-blue-600 text-white',
                    button: 'bg-blue-600 hover:bg-blue-700 text-white', // Secondary action - blue
                    priceColor: 'text-slate-900',
                    shadow: 'shadow-md hover:shadow-lg'
                  }
                case 'charcoal':
                  return {
                    border: 'border-slate-200',
                    background: 'bg-white',
                    badge: 'bg-slate-600 text-white',
                    button: 'bg-slate-500 hover:bg-slate-600 text-white', // Alternative path - medium grey
                    priceColor: 'text-slate-900',
                    shadow: 'shadow-md hover:shadow-lg'
                  }
                default:
                  return {
                    border: 'border-slate-200',
                    background: 'bg-white',
                    badge: 'bg-slate-800 text-white',
                    button: 'bg-slate-800 hover:bg-slate-900 text-white',
                    priceColor: 'text-slate-900',
                    shadow: 'shadow-md hover:shadow-lg'
                  }
              }
            }
            
            const colors = getColorStyles(plan.colorTheme, plan.highlight)
            
            // Check if this is the user's current plan
            const isCurrentPlan = subscriptionStatus?.hasSubscription && 
              ((plan.type === 'subscription-annual' && subscriptionStatus.subscription?.planType === 'annual-access') ||
               (plan.type === 'subscription-monthly' && subscriptionStatus.subscription?.planType === 'monthly-access'))
            
            return (
              <div
                key={index}
                className={`relative rounded-xl border-2 p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  plan.highlight ? `${colors.border} ${colors.background} lg:scale-105` : `${colors.border} ${colors.background}`
                } ${colors.shadow}`}
              >
                {/* Show "Current Plan" badge for active subscription, otherwise show regular badge */}
                {isCurrentPlan ? (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1.5 rounded-full text-sm font-semibold bg-green-600 text-white">
                    Current Plan
                  </div>
                ) : plan.badge && (
                  <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1.5 rounded-full text-sm font-semibold ${colors.badge}`}>
                    {plan.badge}
                  </div>
                )}
                
                {/* Header */}
                <div className="text-center mb-4">
                  <h3 className={`text-2xl font-bold mb-2 ${plan.highlight ? 'text-slate-900' : 'text-slate-800'}`}>
                    {plan.name}
                  </h3>
                  {plan.subtitle && (
                    <p className="text-sm font-medium text-slate-600 mb-2">{plan.subtitle}</p>
                  )}
                </div>
                
                {/* Pricing */}
                <div className="text-center mb-6">
                  <div className={`text-4xl font-bold mb-2 ${colors.priceColor}`}>
                    {plan.price}
                  </div>
                  <div className="text-base text-slate-600 mb-2">{plan.period}</div>
                  {plan.priceSubtext && (
                    <div className={`text-sm font-semibold inline-block px-3 py-1.5 rounded-full border ${
                      plan.type === 'one-time' 
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    }`}>
                      {plan.priceSubtext}
                    </div>
                  )}
                </div>
                
                {/* Features */}
                <ul className="space-y-3 mb-6 flex-grow">
                  {plan.features.map((feature, featureIndex) => (
                    <li 
                      key={featureIndex} 
                      className="flex items-start animate-fadeIn"
                    >
                      <svg className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-slate-700 leading-relaxed">{feature.text}</span>
                    </li>
                  ))}
                </ul>
                
                {/* Description */}
                <div className="text-center mb-6">
                  <p className="text-sm text-slate-600 italic">{plan.description}</p>
                </div>
                
                {/* CTA */}
                <div className="mt-auto">
                  <button 
                    onClick={() => {
                      // Check if this is the user's current plan
                      const isCurrentPlan = subscriptionStatus?.hasSubscription && 
                        ((plan.type === 'subscription-annual' && subscriptionStatus.subscription?.planType === 'annual-access') ||
                         (plan.type === 'subscription-monthly' && subscriptionStatus.subscription?.planType === 'monthly-access'))
                      
                      if (isCurrentPlan) {
                        // Check if already cancelled - allow resubscription
                        if (subscriptionStatus.subscription?.status === 'cancelled') {
                          // Allow resubscription by treating as new subscription
                          if (plan.type === 'subscription-annual') {
                            handleSubscribe('annual-access')
                          } else if (plan.type === 'subscription-monthly') {
                            handleSubscribe('monthly-access')
                          }
                          return
                        }
                        setShowCancelModal(true)
                        return
                      }
                      
                      if (plan.type === 'one-time') {
                        setCurrentPlan('one-time-purchase')
                      } else if (plan.type === 'subscription-annual') {
                        handleSubscribe('annual-access')
                      } else if (plan.type === 'subscription-monthly') {
                        handleSubscribe('monthly-access')
                      }
                    }}
                    disabled={loading}
                    className={`w-full py-4 px-6 rounded-lg font-semibold text-base transition-colors duration-200 ${
                      (subscriptionStatus?.hasSubscription && 
                        ((plan.type === 'subscription-annual' && subscriptionStatus.subscription?.planType === 'annual-access') ||
                         (plan.type === 'subscription-monthly' && subscriptionStatus.subscription?.planType === 'monthly-access')))
                        ? (subscriptionStatus.subscription?.status === 'cancelled' 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'bg-red-600 text-white hover:bg-red-700')
                        : loading 
                          ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
                          : colors.button
                    }`}
                  >
                    {(subscriptionStatus?.hasSubscription && 
                      ((plan.type === 'subscription-annual' && subscriptionStatus.subscription?.planType === 'annual-access') ||
                       (plan.type === 'subscription-monthly' && subscriptionStatus.subscription?.planType === 'monthly-access'))) 
                      ? (subscriptionStatus.subscription?.status === 'cancelled' 
                          ? 'Resubscribe' 
                          : 'Cancel Subscription') 
                      : loading 
                        ? 'Processing...' 
                        : plan.cta}
                  </button>
                  
                  {plan.ctaSubtext && (
                    <p className="text-xs text-slate-600 mt-3 text-center leading-relaxed">
                      {plan.ctaSubtext}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Video Guides Section */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Quick Start Guides</h2>
            <p className="text-gray-600">Get up and running in minutes with our video tutorials</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {videoGuides.map((guide) => (
              <div key={guide.id} className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300">
                <div className="relative aspect-video bg-gray-900 overflow-hidden">
                  <iframe
                    src={`https://www.youtube.com/embed/${guide.videoId}?autoplay=1&mute=1&loop=1&playlist=${guide.videoId}&controls=1&showinfo=0&rel=0&modestbranding=1`}
                    className="w-full h-full"
                    title={guide.title}
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                  <div className="absolute bottom-3 right-3 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                    {guide.duration}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-gray-900 mb-2">{guide.title}</h3>
                  <p className="text-sm text-gray-600">{guide.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Blocks Section */}
        <div className="mt-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Browse Blocks</h2>
            <p className="text-gray-600">Explore our collection of premium theme blocks</p>
          </div>
          
          {/* Category Filter Pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBlocks.map((block) => {
              const isPurchased = purchasedBlocks.includes(block.id);
              return (
                <div key={block.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col">
                  {/* Top Row */}
                  <div className="p-4 flex items-center justify-between">
                    <span 
                      className="inline-block px-3 py-1 text-xs font-medium rounded-full hover:opacity-80 transition-opacity duration-200"
                      style={{
                        backgroundColor: block.category === 'Media' ? '#FED7AA' : 
                                       block.category === 'Product Display' ? '#DBEAFE' : 
                                       block.category === 'Layout' ? '#E9D5FF' : 
                                       block.category === 'Utility' ? '#BBF7D0' : '#DBEAFE',
                        color: block.category === 'Media' ? '#C2410C' : 
                               block.category === 'Product Display' ? '#1D4ED8' : 
                               block.category === 'Layout' ? '#7C3AED' : 
                               block.category === 'Utility' ? '#16A34A' : '#1D4ED8'
                      }}
                    >
                      {block.category}
                    </span>
                    <div className="flex items-center gap-3">
                      {isPurchased ? (
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">Purchased</span>
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-gray-900 px-2 py-1 border border-gray-900 rounded hover:bg-gray-900 hover:text-white transition-colors duration-200">Buy</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Title */}
                  <div className="px-4 pb-2">
                    <h3 className="text-lg font-bold text-gray-900 leading-tight" style={{ 
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {block.name}
                    </h3>
                  </div>
                  
                  {/* Description */}
                  <div className="px-4 pb-4 flex-grow">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {block.description}
                    </p>
                  </div>
                  
                  {/* CTA Button */}
                  <div className="p-4 pt-0">
                    {isPurchased ? (
                      <button 
                        onClick={() => {
                          if (shopInfo?.shop) {
                            window.open(`https://${shopInfo.shop}/admin/themes/current/editor`, '_blank');
                          }
                        }}
                        className="w-full py-3 px-4 rounded-lg font-medium transition-colors duration-200 text-sm bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-50"
                      >
                        View in My Store →
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          if (block.price === 0) {
                            handleRedirect(`/my-blocks?shop=${encodeURIComponent(shopInfo?.shop || '')}`);
                          } else {
                            // Open demo store in new tab
                            window.open('https://sectionappblocks.myshopify.com/?_bt=BAh7BkkiC19yYWlscwY6BkVUewhJIglkYXRhBjsAVEkiI3NlY3Rpb25hcHBibG9ja3MubXlzaG9waWZ5LmNvbQY7AEZJIghleHAGOwBUSSIdMjAyNS0wOC0wNVQyMToyOTozMy44NThaBjsAVEkiCHB1cgY7AFRJIh5wZXJtYW5lbnRfcGFzc3dvcmRfYnlwYXNzBjsARg%3D%3D--89e90f3ad6b1711a96167a402cadf3ea469d2f01', '_blank');
                          }
                        }}
                        className="w-full py-3 px-4 rounded-lg font-medium transition-colors duration-200 text-sm bg-gray-900 hover:bg-gray-800 text-white"
                      >
                        View Live Demo →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Bottom Section - Full Width Modern Design */}
        <div className="mt-16 -mx-4 sm:-mx-6 lg:-mx-8">
          {/* Trust & Features Bar */}
          <div className="bg-blue-50 border-y border-blue-100 py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-center">
                <div className="flex items-center gap-2 text-blue-700">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Use in client projects and sell your designs</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Secure Shopify billing</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Try subscriptions free for 30 days</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Custom Block CTA */}
          <div className="bg-white py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-5xl mx-auto">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Need Something Custom?</h3>
                  <p className="text-lg text-gray-600">Choose the option that works best for you</p>
                </div>
                
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Column 1: Custom Block Design */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm h-full flex flex-col">
                    <div className="text-center mb-4">
                      <h4 className="text-xl font-bold text-gray-900 mb-2">Custom Block Design</h4>
                      <div className="text-3xl font-bold text-gray-900">$299</div>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-2 flex-grow">
                      <li>• Fully custom functionality</li>
                      <li>• Brand styling</li>
                      <li>• Responsive design</li>
                    </ul>
                    <button 
                      onClick={() => setShowCustomForm(true)}
                      className="w-full mt-6 bg-gray-900 text-white font-medium px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Request Custom Block
                    </button>
                  </div>
                  
                  {/* Column 2: Annual Subscriber Offer */}
                  <div className="bg-white rounded-xl p-6 border-2 border-blue-500 shadow-sm h-full flex flex-col relative">
                    <div className="text-center mb-4">
                      <h4 className="text-xl font-bold text-gray-900 mb-2">Annual Subscriber Offer</h4>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="text-3xl font-bold text-gray-900">$199</div>
                        <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">SAVE $100</span>
                      </div>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-2 flex-grow">
                      <li>• Everything in custom design</li>
                      <li>• Brand styling</li>
                      <li>• Responsive design</li>
                    </ul>
                    <button 
                      onClick={() => setShowCustomForm(true)}
                      className="w-full mt-6 bg-gray-900 text-white font-medium px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Request Custom Block
                    </button>
                  </div>
                  
                  {/* Column 3: Suggest a Block */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm h-full flex flex-col">
                    <div className="text-center mb-4">
                      <h4 className="text-xl font-bold text-gray-900 mb-2">Suggest a Block</h4>
                      <div className="text-3xl font-bold text-gray-900">Free</div>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-2 flex-grow">
                      <li>• Share an idea for a new block</li>
                      <li>• Helps shape future block releases</li>
                      <li>• No coding needed</li>
                    </ul>
                    <button 
                      onClick={() => setShowSuggestionForm(true)}
                      className="w-full mt-6 bg-gray-900 text-white font-medium px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Suggest a Block
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Block Selection Modal */}
        {currentPlan === 'one-time-purchase' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">Choose Your Blocks</h2>
              <p className="text-gray-600 mb-2">
                Select the blocks you want to purchase. You have selected {selectedBlocks.size} block{selectedBlocks.size !== 1 ? 's' : ''}.
              </p>
              <p className="text-sm text-blue-600 font-medium mb-6">
                💡 <strong>Save money:</strong> Buy 3 blocks for just $49 (normally $57)
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {blocks.map((block) => {
                  const isPurchased = purchasedBlocks.includes(block.id)
                  const isSelected = selectedBlocks.has(block.id)
                  
                  return (
                    <div 
                      key={block.id}
                      className={`border rounded-lg p-4 h-full flex flex-col transition-all ${
                        isPurchased 
                          ? 'border-green-200 bg-green-50 opacity-75 cursor-not-allowed' 
                          : isSelected
                            ? 'border-blue-500 bg-blue-50 cursor-pointer' 
                            : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!isPurchased) {
                          setSelectedBlocks(prev => {
                            const newSet = new Set(prev)
                            if (newSet.has(block.id)) {
                              newSet.delete(block.id)
                            } else {
                              newSet.add(block.id)
                            }
                            return newSet
                          })
                        }
                      }}
                    >
                      <h3 className="font-semibold mb-2">{block.name}</h3>
                      <p className="text-sm text-gray-600 mb-3 flex-grow">{block.description}</p>
                      <div className="flex justify-between items-center mt-auto">
                        <span className="inline-block px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">
                          {block.category}
                        </span>
                        <span className={`inline-block px-2 py-1 text-xs rounded font-medium ${
                          isPurchased
                            ? 'bg-green-100 text-green-800'
                            : isSelected
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {isPurchased ? 'Purchased' : isSelected ? 'Selected' : block.price === 0 ? 'Free' : `$${block.price}`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Pricing Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold mb-2">Your Selection</h3>
                {selectedBlocks.size === 0 ? (
                  <p className="text-gray-500">No blocks selected</p>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      {selectedBlocks.size} block{selectedBlocks.size !== 1 ? 's' : ''} selected
                    </p>
                    <div className="text-lg font-bold">
                      {(() => {
                        const selectedBlocksList = Array.from(selectedBlocks)
                        const selectedBlocksData = selectedBlocksList.map(id => blocks.find(b => b.id === id)).filter(Boolean)
                        const freeBlocks = selectedBlocksData.filter(block => block?.price === 0).length
                        const paidBlocks = selectedBlocksData.length - freeBlocks
                        
                        if (paidBlocks === 0) {
                          return <span className="text-green-600">Free!</span>
                        }
                        
                        // Calculate pricing with 3-block discount
                        const groups = Math.floor(paidBlocks / 3)
                        const remainder = paidBlocks % 3
                        const total = (groups * 49) + (remainder * 19)
                        
                        if (paidBlocks === 3) {
                          return (
                            <span className="text-green-600">
                              Special Price: $49 
                              <span className="text-sm font-normal text-gray-500 line-through ml-2">($57)</span>
                            </span>
                          )
                        }
                        
                        if (groups > 0 && remainder > 0) {
                          return (
                            <span>
                              Total: ${total}
                              <span className="text-sm font-normal text-gray-500 ml-2">
                                ({groups} bundle{groups > 1 ? 's' : ''} of 3 + {remainder} individual)
                              </span>
                            </span>
                          )
                        }
                        
                        return <span>Total: ${total}</span>
                      })()}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between">
                <button 
                  onClick={() => {
                    setCurrentPlan(null)
                    setSelectedBlocks(new Set())
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  disabled={selectedBlocks.size === 0 || loading}
                  onClick={handlePurchase}
                  className={`px-6 py-2 rounded-lg text-white font-medium ${
                    selectedBlocks.size > 0 && !loading
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Processing...' : 
                   selectedBlocks.size === 0 ? 'Select Blocks' :
                   (() => {
                     const selectedBlocksList = Array.from(selectedBlocks)
                     const selectedBlocksData = selectedBlocksList.map(id => blocks.find(b => b.id === id)).filter(Boolean)
                     const freeBlocks = selectedBlocksData.filter(block => block?.price === 0).length
                     const paidBlocks = selectedBlocksData.length - freeBlocks
                     
                     if (paidBlocks === 0) {
                       return 'Get Free Block'
                     }
                     
                     const groups = Math.floor(paidBlocks / 3)
                     const remainder = paidBlocks % 3
                     const total = (groups * 49) + (remainder * 19)
                     
                     if (paidBlocks === 3) {
                       return 'Purchase 3 Blocks for $49'
                     }
                     
                     if (paidBlocks === 1) {
                       return 'Purchase 1 Block for $19'
                     }
                     
                     return `Purchase ${paidBlocks} Blocks for $${total}`
                   })()}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Cancel Subscription Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Cancel Subscription</h2>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to cancel your subscription?
                </p>
                
                {subscriptionStatus?.subscription?.currentPeriodEnd && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Important:</strong> You will retain access to all subscription features until{' '}
                      <strong>{new Date(subscriptionStatus.subscription.currentPeriodEnd).toLocaleDateString()}</strong>.
                      Your subscription will not renew after this date.
                    </p>
                  </div>
                )}
                
                <p className="text-sm text-gray-600">
                  After cancellation, you can still purchase individual blocks or resubscribe at any time.
                </p>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCancelModal(false)
                    setError(null)
                  }}
                  disabled={cancelLoading}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50"
                >
                  {cancelLoading ? 'Cancelling...' : 'Yes, Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Custom Block Request Form Modal */}
        {showCustomForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Request Custom Block</h2>
              <p className="text-gray-600 mb-6">Tell us about your custom block requirements and we'll get back to you within 24 hours.</p>
              
              <form onSubmit={handleCustomFormSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      value={customFormData.name}
                      onChange={(e) => setCustomFormData(prev => ({ ...prev, name: e.target.value }))}
                      aria-label="Your name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={customFormData.email}
                      onChange={(e) => setCustomFormData(prev => ({ ...prev, email: e.target.value }))}
                      aria-label="Your email address"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Block Description *</label>
                  <textarea
                    required
                    rows={4}
                    value={customFormData.blockDescription}
                    onChange={(e) => setCustomFormData(prev => ({ ...prev, blockDescription: e.target.value }))}
                    placeholder="Describe what you want your custom block to do..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Required Features</label>
                  <textarea
                    rows={3}
                    value={customFormData.features}
                    onChange={(e) => setCustomFormData(prev => ({ ...prev, features: e.target.value }))}
                    placeholder="List specific features you need..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Timeline</label>
                    <select
                      value={customFormData.timeline}
                      onChange={(e) => setCustomFormData(prev => ({ ...prev, timeline: e.target.value }))}
                      aria-label="Project timeline"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option>ASAP</option>
                      <option>1 week</option>
                      <option>2 weeks</option>
                      <option>1 month</option>
                      <option>Not specified</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                    <select
                      value={customFormData.budget}
                      onChange={(e) => setCustomFormData(prev => ({ ...prev, budget: e.target.value }))}
                      aria-label="Project budget"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option>$199 (Standard custom block)</option>
                      <option>$299 (Premium custom block)</option>
                      <option>$500-$999 (Complex functionality)</option>
                      <option>$1000-$2000 (Advanced features)</option>
                      <option>$2000+ (Enterprise solution)</option>
                      <option>Not specified</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="whatsapp"
                      checked={customFormData.whatsappContact}
                      onChange={(e) => setCustomFormData(prev => ({ ...prev, whatsappContact: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="whatsapp" className="ml-2 text-sm text-gray-700">
                      I can be contacted via WhatsApp for faster communication
                    </label>
                  </div>
                  
                  {customFormData.whatsappContact && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                      <input
                        type="tel"
                        value={customFormData.whatsappNumber}
                        onChange={(e) => setCustomFormData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                        placeholder="+1234567890"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCustomForm(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors duration-200 disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Suggestion Form Modal */}
        {showSuggestionForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-2">Suggest a Block</h2>
              <p className="text-gray-600 mb-6">Have an idea for a new block? Share it with us!</p>
              
              <form onSubmit={handleSuggestionFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                    <input
                      type="text"
                      required
                      value={suggestionFormData.name}
                      onChange={(e) => setSuggestionFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="John Doe"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={suggestionFormData.email}
                      onChange={(e) => setSuggestionFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="john@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Block Description *</label>
                  <textarea
                    required
                    value={suggestionFormData.blockDescription}
                    onChange={(e) => setSuggestionFormData(prev => ({ ...prev, blockDescription: e.target.value }))}
                    placeholder="Describe what this block should do and how it would benefit users..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Specific Features</label>
                  <textarea
                    value={suggestionFormData.features}
                    onChange={(e) => setSuggestionFormData(prev => ({ ...prev, features: e.target.value }))}
                    placeholder="List specific features or functionality you'd like to see..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Website Link</label>
                  <input
                    type="url"
                    value={suggestionFormData.websiteLink}
                    onChange={(e) => setSuggestionFormData(prev => ({ ...prev, websiteLink: e.target.value }))}
                    placeholder="https://example.com (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Share a website that has a similar design or functionality</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSuggestionFormData(prev => ({ ...prev, image: e.target.files?.[0] || null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Upload an image showing what you have in mind (optional)</p>
                  {suggestionFormData.image && (
                    <p className="text-sm text-green-600 mt-2">✓ {suggestionFormData.image.name}</p>
                  )}
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowSuggestionForm(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Submit Suggestion'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}