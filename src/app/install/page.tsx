'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface Block {
  id: string
  name: string
  description: string
  category: string
  price: number
  isPremium: boolean
  isActive: boolean
  previewUrl?: string
}

function InstallContent() {
  const [loading, setLoading] = useState(true)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [installedBlocks, setInstalledBlocks] = useState<Set<string>>(new Set())
  
  const searchParams = useSearchParams()
  const shopDomain = searchParams.get('shop')

  // Load blocks from API
  useEffect(() => {
    const fetchBlocks = async () => {
      try {
        const response = await fetch(`/api/blocks?category=${selectedCategory}`)
        if (response.ok) {
          const data = await response.json()
          setBlocks(data.blocks)
        }
      } catch (error) {
        console.error('Error fetching blocks:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBlocks()
  }, [selectedCategory])

  // Load installed blocks from localStorage
  useEffect(() => {
    if (shopDomain) {
      const installedKey = `installed_blocks_${shopDomain}`
      const stored = localStorage.getItem(installedKey)
      if (stored) {
        setInstalledBlocks(new Set(JSON.parse(stored)))
      }
    }
  }, [shopDomain])

  const handleInstall = async (blockId: string) => {
    // Check if already installed
    if (installedBlocks.has(blockId)) {
      alert('✅ This block is already installed in your theme!\n\nGo to Online Store → Themes → Customize to use it.')
      return
    }

    try {
      const response = await fetch('/api/shopify-install', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': shopDomain || 'demo-shop.myshopify.com'
        },
        body: JSON.stringify({ blockId, shopDomain })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Mark as installed
        const newInstalled = new Set(installedBlocks)
        newInstalled.add(blockId)
        setInstalledBlocks(newInstalled)
        
        // Save to localStorage
        if (shopDomain) {
          const installedKey = `installed_blocks_${shopDomain}`
          localStorage.setItem(installedKey, JSON.stringify(Array.from(newInstalled)))
        }

        alert(`✅ ${data.message}\n\n📍 Next steps:\n1. Go to Online Store → Themes\n2. Click "Customize" on your active theme\n3. Add a section and look for "${data.installationDetails?.blockName}"`)
        
        // Optionally redirect to Shopify theme editor
        if (data.themeEditorUrl) {
          window.open(data.themeEditorUrl, '_top')
        }
      } else {
        alert(`❌ ${data.error || 'Failed to install block'}`)
      }
    } catch (error) {
      console.error('Error installing block:', error)
      alert('❌ Installation failed. Please try again.')
    }
  }

  const isBlockInstalled = (blockId: string) => {
    return installedBlocks.has(blockId)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading blocks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Trifoli Block Manager
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Install premium theme blocks to enhance your Shopify store
          </p>
          {shopDomain && (
            <p className="text-sm text-gray-500 mt-2">
              Store: {shopDomain}
            </p>
          )}
        </div>

        {/* Installation Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                How block installation works
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Blocks are installed directly to your theme. After installation, go to your theme editor 
                  (Online Store → Themes → Customize) to add and configure the blocks in your store.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {['all', 'Product Display', 'Marketing', 'Content', 'Layout'].map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-blue-50'
              }`}
            >
              {category === 'all' ? 'All Categories' : category}
            </button>
          ))}
        </div>

        {/* Blocks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blocks.map((block) => (
            <div key={block.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {block.name}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">
                      {block.description}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    block.isPremium ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {block.category}
                  </span>
                  <span className="font-semibold text-lg">
                    {block.isPremium ? `$${block.price}` : 'Free'}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {isBlockInstalled(block.id) ? (
                    <div className="space-y-2">
                      <button 
                        className="w-full bg-gray-400 text-white font-medium py-3 px-4 rounded-lg cursor-not-allowed"
                        disabled
                      >
                        ✅ Installed
                      </button>
                      <p className="text-xs text-gray-500 text-center">
                        Available in your theme editor
                      </p>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleInstall(block.id)}
                      className="w-full bg-green-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Install to Theme
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {blocks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No blocks found in this category.</p>
          </div>
        )}

        {/* Theme Editor Link */}
        {shopDomain && (
          <div className="mt-12 text-center">
            <a
              href={`https://${shopDomain.replace('.myshopify.com', '')}.myshopify.com/admin/themes/current/editor`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Open Theme Editor
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Install() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <InstallContent />
    </Suspense>
  )
}
