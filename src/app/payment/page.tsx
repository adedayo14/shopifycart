'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

function PaymentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [block, setBlock] = useState<any>(null)
  
  const blockId = searchParams.get('blockId')
  const shop = searchParams.get('shop')
  const amount = searchParams.get('amount')

  useEffect(() => {
    // Fetch block details
    const fetchBlock = async () => {
      if (blockId) {
        try {
          const response = await fetch(`/api/blocks/${blockId}`)
          if (response.ok) {
            const data = await response.json()
            setBlock(data.block)
          }
        } catch (error) {
          console.error('Error fetching block:', error)
        }
      }
    }
    
    fetchBlock()
  }, [blockId])

  const handlePayment = async () => {
    setLoading(true)
    
    try {
      // In production, this would integrate with:
      // - Shopify Billing API for recurring charges
      // - Stripe for one-time payments
      // - PayPal for alternative payment methods
      
      // For demo purposes, simulate payment processing
      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': shop || ''
        },
        body: JSON.stringify({
          blockId,
          shop,
          amount: parseFloat(amount || '0'),
          paymentMethod: 'demo' // In production: 'stripe', 'shopify', etc.
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        alert(`✅ Payment successful!\n\n${data.message}\n\nYou can now install and use this block.`)
        router.push(`/marketplace?shop=${shop}`)
      } else {
        alert(`❌ Payment failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Payment error:', error)
      alert('❌ Payment failed due to a network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!block) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading payment details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Purchase</h1>
          <p className="text-gray-600">Secure payment for your premium block</p>
        </div>

        <div className="space-y-6">
          {/* Block Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-2">{block.name}</h3>
            <p className="text-gray-600 text-sm mb-3">{block.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Price:</span>
              <span className="text-2xl font-bold text-blue-600">${amount}</span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">🔒 Secure Payment</h4>
            <p className="text-blue-700 text-sm">
              In production, this would integrate with Shopify Billing API or Stripe for secure payment processing.
            </p>
          </div>

          {/* Demo Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-900 mb-2">⚠️ Demo Mode</h4>
            <p className="text-yellow-700 text-sm">
              This is a demonstration. No actual payment will be processed. 
              Click "Complete Payment" to simulate a successful purchase.
            </p>
          </div>

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              `Complete Payment - $${amount}`
            )}
          </button>

          {/* Cancel Link */}
          <button
            onClick={() => router.push(`/marketplace?shop=${shop}`)}
            className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel and Return to Marketplace
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t text-center">
          <p className="text-xs text-gray-500">
            Powered by Trifoli Theme Blocks
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  )
}
