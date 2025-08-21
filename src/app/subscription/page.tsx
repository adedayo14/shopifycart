'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface Subscription {
  id: string
  planType: string
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  chargeId: string
}

function SubscriptionManagementContent() {
  const searchParams = useSearchParams()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [])

  const fetchSubscriptionStatus = async () => {
    try {
      const shop = searchParams.get('shop')
      
      // Debug information
      console.log('=== SUBSCRIPTION PAGE DEBUG ===')
      console.log('Shop from searchParams:', shop)
      console.log('All search params:', Object.fromEntries(searchParams.entries()))
      
      if (!shop) {
        console.error('No shop parameter found in URL!')
        setError('No shop parameter found. Please access this page from within your Shopify admin.')
        setLoading(false)
        return
      }
      
      console.log('Making API request to:', `/api/subscription-management?shop=${encodeURIComponent(shop)}`)
      
      const response = await fetch(`/api/subscription-management?shop=${encodeURIComponent(shop)}`)
      const data = await response.json()
      
      console.log('API Response:', data)
      console.log('Has subscription:', data.hasSubscription)
      console.log('Subscription data:', data.subscription)
      
      if (data.hasSubscription && data.subscription) {
        setSubscription(data.subscription)
        console.log('✅ Subscription found and set!')
      } else {
        console.log('❌ No subscription found for shop:', shop)
      }
    } catch (err) {
      console.error('❌ Error fetching subscription:', err)
      setError('Failed to load subscription details')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!subscription) return

    setCancelling(true)
    setError(null)

    try {
      const shop = searchParams.get('shop') || 'demo-shop.myshopify.com'
      
      const response = await fetch('/api/subscription-management', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.chargeId,
          shop: shop
        })
      })

      const result = await response.json()

      if (result.success) {
        setSubscription(prev => prev ? { ...prev, status: 'cancelled' } : null)
        alert('Subscription cancelled successfully. You will retain access until the end of your current billing period.')
      } else {
        setError(result.error || 'Failed to cancel subscription')
      }
    } catch (err) {
      setError('Failed to cancel subscription')
      console.error('Error cancelling subscription:', err)
    } finally {
      setCancelling(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getPlanDisplayName = (planType: string) => {
    switch (planType) {
      case 'monthly-access':
        return 'Monthly Access'
      case 'annual-access':
        return 'Annual Access'
      default:
        return planType
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading subscription details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Subscription Management</h1>
            <p className="text-gray-600 mt-1">Manage your Trifoli subscription and billing</p>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {!subscription ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No Active Subscription</h3>
                <p className="mt-2 text-gray-500">You don't have an active subscription.</p>
                <div className="mt-6">
                  <a
                    href="/marketplace"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Browse Plans
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Current Subscription</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm font-medium text-gray-500">Plan</div>
                      <div className="mt-1 text-lg text-gray-900">{getPlanDisplayName(subscription.planType)}</div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-gray-500">Status</div>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          subscription.status === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : subscription.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-500">Current Period Start</div>
                      <div className="mt-1 text-sm text-gray-900">{formatDate(subscription.currentPeriodStart)}</div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-500">Current Period End</div>
                      <div className="mt-1 text-sm text-gray-900">{formatDate(subscription.currentPeriodEnd)}</div>
                    </div>
                  </div>
                </div>

                {subscription.status === 'active' && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Subscription Actions</h3>
                    
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">
                            Cancel Subscription
                          </h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>
                              If you cancel your subscription, you'll retain access to all blocks until the end of your current billing period 
                              ({formatDate(subscription.currentPeriodEnd)}). You can reactivate anytime.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleCancelSubscription}
                      disabled={cancelling}
                      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                        cancelling 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {cancelling ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Cancelling...
                        </>
                      ) : (
                        'Cancel Subscription'
                      )}
                    </button>
                  </div>
                )}

                {subscription.status === 'cancelled' && (
                  <div className="border-t border-gray-200 pt-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-blue-800">
                            Subscription Cancelled
                          </h3>
                          <div className="mt-2 text-sm text-blue-700">
                            <p>
                              Your subscription has been cancelled. You'll retain access until {formatDate(subscription.currentPeriodEnd)}.
                            </p>
                            <div className="mt-4">
                              <a
                                href="/marketplace"
                                className="text-blue-700 hover:text-blue-600 font-medium"
                              >
                                Reactivate subscription →
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionManagement() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading subscription details...</p>
        </div>
      </div>
    }>
      <SubscriptionManagementContent />
    </Suspense>
  );
}
