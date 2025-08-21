'use client'

import { useState, useEffect } from 'react'

interface Subscription {
  id: string
  shop: string
  planType: string
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  createdAt: string
}

interface CustomBlockRequest {
  id: string
  name: string
  email: string
  shopDomain: string
  blockDescription: string
  features: string | null
  timeline: string | null
  budget: string | null
  whatsappContact: boolean
  whatsappNumber: string | null
  status: string
  createdAt: string
}

interface StoreOwner {
  name: string
  email: string
  shopDomain: string
}

interface AdminStats {
  totalPurchases: number
  totalRevenue: number
  activeSubscriptions: number
  uniqueShops: number
  storeOwners: StoreOwner[]
  recentSubscriptions: Subscription[]
  customBlockRequests: CustomBlockRequest[]
}

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === 'Adedayo01') {
      setAuthenticated(true)
      setError('')
      fetchAdminData()
    } else {
      setError('Invalid password')
    }
  }

  const fetchAdminData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${password}`
        }
      })
      const data = await response.json()
      if (data.success) {
        setStats(data.data)
      } else {
        setError('Failed to load admin data')
      }
    } catch (error) {
      console.error('Error fetching admin data:', error)
      setError('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const triggerDeploymentHook = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/deployment-hook', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer super-secret-deployment-key-2024`
        }
      })
      const data = await response.json()
      if (data.success) {
        alert(`Deployment hook successful! ${data.stats.successCount} subscribers updated with ${data.stats.blocksInstalled} blocks.`)
      } else {
        setError('Failed to trigger deployment hook: ' + data.error)
      }
    } catch (error) {
      console.error('Error triggering deployment hook:', error)
      setError('Failed to trigger deployment hook')
    } finally {
      setLoading(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Admin Access</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                aria-label="Admin password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
            <button
              type="submit"
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex gap-3">
            <button
              onClick={triggerDeploymentHook}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Refresh All Subscribers'}
            </button>
            <button
              onClick={() => {
                setAuthenticated(false)
                setPassword('')
                setStats(null)
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {stats && (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Purchases</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPurchases}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
                <p className="text-2xl font-bold text-green-600">${stats.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Active Subscriptions</h3>
                <p className="text-2xl font-bold text-blue-600">{stats.activeSubscriptions}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Unique Shops</h3>
                <p className="text-2xl font-bold text-purple-600">{stats.uniqueShops}</p>
              </div>
            </div>

            {/* Store Owners Table */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Store Owners</h2>
                <p className="text-gray-600 text-sm">Shop owners with active purchases or subscriptions</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.storeOwners.map((owner, index) => {
                      // Find if this shop has an active subscription
                      const hasActiveSubscription = stats.recentSubscriptions.some((sub: any) => 
                        sub.shop === owner.shopDomain && sub.status === 'active'
                      )
                      
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{owner.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{owner.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{owner.shopDomain.replace('.myshopify.com', '')}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              hasActiveSubscription 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {hasActiveSubscription ? 'Subscriber' : 'Customer'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Subscriptions */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Recent Subscriptions</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.recentSubscriptions.map((subscription) => (
                      <tr key={subscription.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {subscription.shop.replace('.myshopify.com', '')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                          {subscription.planType.replace('-', ' ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            subscription.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : subscription.status === 'cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {subscription.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(subscription.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Custom Block Requests */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Custom Block Requests</h2>
                <p className="text-gray-600 text-sm">Messages from users requesting custom blocks</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shop</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stats.customBlockRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{request.name}</div>
                          <div className="text-sm text-gray-500">{request.email}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{request.shopDomain.replace('.myshopify.com', '')}</td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate" title={request.blockDescription}>
                            {request.blockDescription}
                          </div>
                          {request.features && (
                            <div className="text-xs text-gray-500 max-w-xs truncate" title={request.features}>
                              Features: {request.features}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{request.budget || 'Not specified'}</td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">Email</div>
                          {request.whatsappContact && (
                            <div className="text-xs text-green-600 font-medium">
                              WhatsApp: {request.whatsappNumber || 'Yes'}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!stats && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Click refresh to load admin data</p>
            <button
              onClick={fetchAdminData}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
