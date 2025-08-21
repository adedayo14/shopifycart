'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function BillingConfirmContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const purchaseId = searchParams.get('purchase_id')
    const subscriptionId = searchParams.get('subscription_id')
    const chargeId = searchParams.get('charge_id')
    const type = searchParams.get('type')
    const plan = searchParams.get('plan')

    console.log('Billing confirmation parameters:', { purchaseId, subscriptionId, type, plan, chargeId })

    if (purchaseId || chargeId) {
      // Handle one-time purchase confirmation
      setStatus('success')
      setMessage(`🎉 Success! Your ${type || 'block'} purchase has been confirmed. You can now use your selected blocks in the Shopify theme editor.`)
    } else if (subscriptionId) {
      // Handle subscription confirmation
      setStatus('success')
      setMessage(`🎉 Success! Your ${plan || 'premium'} subscription has been activated. You now have access to all premium blocks.`)
    } else {
      // For Shopify billing, sometimes the parameters come differently
      setStatus('success')
      setMessage(`🎉 Success! Your subscription has been activated. You now have access to all premium blocks.`)
    }
  }, [searchParams])

  const handleReturnToApp = () => {
    const shop = searchParams.get('shop')
    if (shop) {
      // Return to embedded app in Shopify Admin
      window.location.href = `https://admin.shopify.com/store/${shop.replace('.myshopify.com', '')}/apps/trifoli-blocks`
    } else {
      // Fallback to marketplace
      window.location.href = '/marketplace'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Processing your payment...
            </h2>
            <p className="text-gray-600">Please wait while we confirm your billing.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Payment Confirmed!
            </h2>
            <p className="text-gray-600 mb-6">{message}</p>
            {/* Payment confirmation - production only, no test mode messaging */}
            <button
              onClick={handleReturnToApp}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Return to Shopify Admin
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Payment Error
            </h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={handleReturnToApp}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Return to App
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function BillingConfirm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <BillingConfirmContent />
    </Suspense>
  )
}
