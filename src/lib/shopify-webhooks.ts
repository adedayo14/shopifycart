// Shopify Webhook Registration
export async function registerWebhooks(shop: string, accessToken: string) {
  console.log('Registering webhooks for shop:', shop);
  
  const webhooks = [
    // Billing webhooks
    {
      topic: 'app_subscriptions/update',
      address: 'https://shopifyapp-weld.vercel.app/api/webhooks/shopify',
      format: 'json'
    },
    {
      topic: 'app_purchases_one_time/update',
      address: 'https://shopifyapp-weld.vercel.app/api/webhooks/shopify',
      format: 'json'
    },
    // Compliance webhooks (GDPR requirements)
    {
      topic: 'customers/data_request',
      address: 'https://shopifyapp-weld.vercel.app/api/webhooks/shopify',
      format: 'json'
    },
    {
      topic: 'customers/redact',
      address: 'https://shopifyapp-weld.vercel.app/api/webhooks/shopify',
      format: 'json'
    },
    {
      topic: 'shop/redact',
      address: 'https://shopifyapp-weld.vercel.app/api/webhooks/shopify',
      format: 'json'
    }
  ];

  const results = [];

  for (const webhook of webhooks) {
    try {
      console.log(`Registering webhook: ${webhook.topic}`);
      
      const response = await fetch(`https://${shop}/admin/api/2023-10/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ webhook })
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ Webhook registered: ${webhook.topic}`);
        results.push({ topic: webhook.topic, success: true, id: result.webhook?.id });
      } else {
        console.error(`❌ Failed to register webhook: ${webhook.topic}`, result);
        results.push({ topic: webhook.topic, success: false, error: result });
      }
    } catch (error) {
      console.error(`Error registering webhook ${webhook.topic}:`, error);
      results.push({ topic: webhook.topic, success: false, error: error.message });
    }
  }

  console.log('Webhook registration complete:', results);
  return results;
}

// List existing webhooks
export async function listWebhooks(shop: string, accessToken: string) {
  try {
    const response = await fetch(`https://${shop}/admin/api/2023-10/webhooks.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Existing webhooks:', data.webhooks);
      return data.webhooks;
    } else {
      console.error('Failed to list webhooks:', response.status);
      return [];
    }
  } catch (error) {
    console.error('Error listing webhooks:', error);
    return [];
  }
}

// Delete webhook
export async function deleteWebhook(shop: string, accessToken: string, webhookId: string) {
  try {
    const response = await fetch(`https://${shop}/admin/api/2023-10/webhooks/${webhookId}.json`, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': accessToken,
      }
    });

    if (response.ok) {
      console.log(`✅ Webhook deleted: ${webhookId}`);
      return true;
    } else {
      console.error(`❌ Failed to delete webhook: ${webhookId}`);
      return false;
    }
  } catch (error) {
    console.error(`Error deleting webhook ${webhookId}:`, error);
    return false;
  }
} 