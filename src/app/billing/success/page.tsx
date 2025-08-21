'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function BillingSuccess() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState<any>(null)

  useEffect(() => {
    const shop = searchParams.get('shop')
    const charge_id = searchParams.get('charge_id')
    const blocks = searchParams.get('blocks')
    const plan = searchParams.get('plan')
    const isTest = searchParams.get('test') === 'true'
    const isMock = searchParams.get('mock') === 'true'
    const isUnpublished = searchParams.get('unpublished') === 'true'
    
    console.log('Billing success page params:', { shop, charge_id, blocks, plan, isTest, isMock, isUnpublished })

    // Process the successful billing
    const processBillingSuccess = async () => {
      try {
        // Handle test/mock subscriptions without calling the API
        if ((isMock || isUnpublished) && plan && shop) {
          console.log('Processing test/mock subscription...');
          
          setStatus('success');
          setMessage(`Test subscription activated for ${plan === 'annual-access' ? 'Annual' : 'Monthly'} Access!`);
          setDetails({
            type: 'subscription',
            plan: plan,
            shop: shop,
            isTest: true,
            isMock: isMock,
            isUnpublished: isUnpublished
          });
          return;
        }
        
        if ((blocks || plan) && charge_id && shop) {
          console.log('Calling billing success API...');
          
          const response = await fetch('/api/billing/success', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shop,
              charge_id,
              blocks,
              plan
            })
          });
          
          const result = await response.json();
          console.log('Billing success API response:', result);
          
          if (result.success) {
            setStatus('success');
            
            if (blocks) {
              const blockIds = blocks.split(',');
              setMessage(`Successfully purchased ${blockIds.length} block${blockIds.length > 1 ? 's' : ''}!`);
              setDetails({
                type: 'purchase',
                blocks: blockIds,
                shop: shop,
                purchases: result.purchases
              });
            } else if (plan) {
              setMessage(`Successfully subscribed to ${plan === 'annual-access' ? 'Annual' : 'Monthly'} Access!`);
              setDetails({
                type: 'subscription',
                plan: plan,
                shop: shop
              });
            }
          } else {
            setStatus('error');
            setMessage(`Failed to process purchase: ${result.error}`);
          }
          
        } else {
          setStatus('error');
          setMessage('Missing required billing parameters');
        }
      } catch (error) {
        console.error('Error processing billing success:', error)
        setStatus('error')
        setMessage('Error processing your purchase. Please contact support.')
      }
    }

    processBillingSuccess()
  }, [searchParams])

  const handleContinue = () => {
    const shop = searchParams.get('shop')
    const host = searchParams.get('host')
    
    console.log('Continue to Marketplace clicked:', { shop, host })
    
    if (shop) {
      // Redirect back to the marketplace with success message
      const marketplaceUrl = `/marketplace?shop=${encodeURIComponent(shop)}${host ? `&host=${encodeURIComponent(host)}` : ''}&billing_success=true`
      console.log('Redirecting to:', marketplaceUrl)
      window.location.href = marketplaceUrl
    } else {
      console.log('No shop found, redirecting to /marketplace')
      window.location.href = '/marketplace'
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Processing your purchase...</h1>
          <p className="text-gray-600">Please wait while we confirm your billing.</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Error</h1>
          <p className="text-gray-600 mb-6">{message}</p>
          <button
            onClick={handleContinue}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Marketplace
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Payment Successful!</h1>
          <p className="text-lg text-gray-600">{message}</p>
        </div>
        
        {/* Subscription Details */}
        {details?.type === 'subscription' && (
          <div className={`rounded-xl p-6 mb-8 border ${
            details.isTest 
              ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200' 
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100'
          }`}>
            <div className="flex items-center mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                details.isTest ? 'bg-amber-600' : 'bg-blue-600'
              }`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                {details.isTest ? 'Test Subscription Active' : 'Subscription Active'}
              </h3>
              {details.isTest && (
                <span className="ml-2 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                  TEST MODE
                </span>
              )}
            </div>
            <p className="text-gray-700 leading-relaxed">
              {details.isTest ? (
                details.isUnpublished ? (
                  <>You now have test access to all premium blocks! This is a test subscription because the app is not yet published on the Shopify App Store. All features are available for testing.</>
                ) : (
                  <>You now have test access to all premium blocks! This is a development/test subscription with full functionality.</>
                )
              ) : (
                <>You now have access to all premium blocks! Your {details.plan === 'annual-access' ? 'annual' : 'monthly'} subscription includes a 30-day free trial.</>
              )}
            </p>
            {details.isTest && (
              <div className="mt-4 p-3 bg-amber-100 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> This is a test subscription for development purposes. No actual payment was processed.
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Purchase Details */}
        {details?.type === 'purchase' && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 mb-8 border border-green-100">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Your Blocks</h3>
            </div>
            <div className="space-y-2">
              {details.blocks.map((blockId: string) => (
                <div key={blockId} className="flex items-center text-gray-700">
                  <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {blockId.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="space-y-4 mt-8">
          <button
            onClick={handleContinue}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            Continue to Marketplace
          </button>
          
          <button
            onClick={() => {
              const shop = searchParams.get('shop')
              console.log('View My Blocks clicked, shop:', shop)
              if (shop) {
                window.location.href = `/my-blocks?shop=${encodeURIComponent(shop)}`
              } else {
                window.location.href = '/my-blocks'
              }
            }}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 py-4 px-6 rounded-xl font-medium border-2 border-gray-300 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            View My Blocks
          </button>
        </div>
        
        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500">
            Questions? Contact us at <span className="font-medium text-gray-700">support@trifoli.com</span>
          </p>
        </div>
      </div>
    </div>
  )
} 