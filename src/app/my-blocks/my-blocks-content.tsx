'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import AutoRefreshBlocks from '../../components/AutoRefreshBlocks'

interface PurchasedBlock {
  id: string
  blockId: string
  blockName: string
  price: number
  status: string
  purchasedAt: string
}

export default function MyBlocksPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [purchasedBlocks, setPurchasedBlocks] = useState<PurchasedBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const shop = searchParams.get('shop')

  const handleBrowseMoreBlocks = () => {
    // Use client-side navigation instead of full page reload
    if (shop) {
      router.push(`/?shop=${encodeURIComponent(shop)}`)
    } else {
      router.push('/')
    }
  }

  const fetchPurchasedBlocks = async () => {
    try {
      console.log('Fetching purchased blocks for shop:', shop)
      
      if (!shop) {
        setError('No shop parameter provided')
        setLoading(false)
        return
      }
      
      // Get session token for authentication
      const sessionToken = new URLSearchParams(window.location.search).get('id_token') ||
                           localStorage.getItem('sessionToken');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Shopify-Shop-Domain': shop
      };
      
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(`/api/my-blocks?shop=${encodeURIComponent(shop)}`, {
        method: 'GET',
        headers
      })

      console.log('Response status:', response.status)
      
      const data = await response.json()
      console.log('Response data:', data)

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`)
      }

      if (data.success) {
        setPurchasedBlocks(data.blocks || [])
      } else {
        throw new Error(data.error || 'Failed to fetch purchased blocks')
      }
    } catch (error) {
      console.error('Error fetching purchased blocks:', error)
      setError(error instanceof Error ? error.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPurchasedBlocks()
  }, [shop])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Blocks</h3>
              <p className="text-red-600 mb-6">{error}</p>
              <button 
                onClick={fetchPurchasedBlocks}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mr-4"
              >
                Try Again
              </button>
              <button 
                onClick={() => window.location.href = '/'} 
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Go to Marketplace
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Auto-refresh blocks in the background for better UX */}
      {shop && <AutoRefreshBlocks shop={shop} />}
      
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">My Blocks</h1>
            <p className="text-gray-600">
              Manage your purchased theme blocks for <span className="font-medium">{shop}</span>
            </p>
          </div>

          {purchasedBlocks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No blocks purchased yet</h3>
              <p className="text-gray-500 mb-6">
                Browse our marketplace to discover amazing theme blocks for your store.
              </p>
              <a 
                href={`/?shop=${encodeURIComponent(shop || '')}`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse Marketplace
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-500 mb-4">
                {purchasedBlocks.length} block{purchasedBlocks.length !== 1 ? 's' : ''} purchased
              </div>
              
              {purchasedBlocks.map((block) => (
                <div key={block.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-gray-900">{block.blockName}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          block.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {block.status === 'completed' ? '✓ Installed' : 'Pending'}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        Block ID: {block.blockId}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        Purchased: {new Date(block.purchasedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        {block.price === 0 ? 'Free' : `$${block.price}`}
                      </div>
                      {block.status === 'completed' && (
                        <div className="mt-2">
                          <button 
                            onClick={() => window.open(`https://${shop}/admin/themes/current/editor`, '_blank')}
                            className="text-sm bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800"
                          >
                            Use in Theme Editor
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">
                      Need more blocks? Browse our marketplace for additional options.
                    </p>
                  </div>
                  <button 
                    onClick={handleBrowseMoreBlocks}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Browse More Blocks
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}