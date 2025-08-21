import { useState } from 'react';

export default function RefreshBlocksButton({ shop }: { shop: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const refreshBlocks = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch(`/api/manual-install-blocks?shop=${shop}`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setMessage('✅ Blocks refreshed! Check your theme editor.');
      } else {
        setMessage('❌ Failed to refresh blocks: ' + result.error);
      }
    } catch (error) {
      setMessage('❌ Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold text-blue-900 mb-2">
        Refresh Purchased Blocks
      </h3>
      <p className="text-blue-700 mb-3">
        If your purchased blocks aren't showing in the theme editor, click this button to refresh them.
      </p>
      <button
        onClick={refreshBlocks}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
      >
        {loading ? 'Refreshing...' : 'Refresh Blocks'}
      </button>
      {message && (
        <p className="mt-2 text-sm text-blue-800">{message}</p>
      )}
    </div>
  );
}
