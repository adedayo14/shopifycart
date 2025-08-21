// Shopify Billing API for Next.js
import { GraphQLClient } from '@shopify/shopify-api';

// Add this constant at the top
const IS_TEST_BILLING = process.env.SHOPIFY_BILLING_TEST_MODE === 'true';

// Create subscription using Shopify GraphQL API
export async function createSubscription(client: GraphQLClient, options: {
  name: string;
  returnUrl?: string;
  test?: boolean;
  planType?: string;
}) {
  const { name, returnUrl, test = IS_TEST_BILLING, planType } = options;
  
  // Set pricing based on plan type
  let price = 14.99; // Default monthly
  if (planType === 'annual') {
    price = 99.00;
  }
  
  const mutation = `
    mutation appSubscriptionCreate($name: String!, $returnUrl: URL!, $test: Boolean!, $lineItems: [AppSubscriptionLineItemInput!]!) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        test: $test
        lineItems: $lineItems
      ) {
        appSubscription {
          id
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    name,
    returnUrl: returnUrl || `${process.env.SHOPIFY_APP_URL}/billing/confirm?plan=${planType}&subscription_id=`,
    test,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount: price, currencyCode: "USD" }
          }
        }
      }
    ]
  };

  console.log('Creating subscription with variables:', variables);

  try {
    const response = await client.request(mutation, variables);
    console.log('Shopify subscription response:', response);
    return response;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
}

// Create one-time purchase using Shopify GraphQL API
export async function createOneTimePurchase(shop: string, accessToken: string, amount: number, description: string) {
  console.log('=== CREATE ONE TIME PURCHASE DEBUG ===');
  console.log('Received shop parameter:', shop);
  console.log('Shop parameter type:', typeof shop);
  console.log('Shop parameter length:', shop?.length);
  console.log('Shop parameter includes comma:', shop?.includes(','));
  console.log('Shop parameter includes myshopify.com:', shop?.includes('myshopify.com'));
  console.log('Shop parameter JSON:', JSON.stringify(shop));
  console.log('Shop parameter split by comma:', shop?.split(','));
  console.log('Shop parameter trim:', shop?.trim());
  
  // Ensure shop is a clean domain (no .myshopify.com)
  let shopDomain = shop;
  if (shop.includes('.myshopify.com')) {
    shopDomain = shop.replace('.myshopify.com', '');
  }
  
  console.log('Creating one-time purchase:', { 
    originalShop: shop,
    shopDomain, 
    amount, 
    description,
    accessTokenLength: accessToken?.length,
    accessTokenPrefix: accessToken?.substring(0, 10) + '...'
  });
  
  const mutation = `
    mutation appPurchaseOneTimeCreate($price: MoneyInput!, $name: String!, $test: Boolean) {
      appPurchaseOneTimeCreate(price: $price, name: $name, test: $test) {
        appPurchaseOneTime {
          id
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    price: { amount, currencyCode: 'USD' },
    name: description,
    test: process.env.SHOPIFY_BILLING_TEST_MODE === 'true'
  };

  const url = `https://${shopDomain}.myshopify.com/admin/api/2023-10/graphql.json`;
  console.log('Making request to:', url);
  console.log('Request variables:', variables);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query: mutation, variables })
  });

  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response body:', errorText);
    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
  }

  const result = await response.json();
  console.log('Shopify billing response:', result);
  
  return result.data;
}

// Get subscription status
export async function getSubscriptionStatus(client: GraphQLClient, subscriptionId: string) {
  try {
    const query = `
      query getSubscription($id: ID!) {
        node(id: $id) {
          ... on AppSubscription {
            id
            status
            currentPeriodEnd
            test
          }
        }
      }
    `;

    const response = await client.query({
      data: {
        query,
        variables: { id: subscriptionId }
      }
    });

    const result = response.body as any;
    return result.data?.node;
  } catch (error) {
    console.error('Error getting subscription status:', error);
    throw error;
  }
}

// Cancel subscription
export async function cancelSubscription(client: GraphQLClient, subscriptionId: string) {
  try {
    const mutation = `
      mutation appSubscriptionCancel($id: ID!) {
        appSubscriptionCancel(id: $id) {
          appSubscription {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await client.query({
      data: {
        query: mutation,
        variables: { id: subscriptionId }
      }
    });

    const result = response.body as any;
    
    if (result.data?.appSubscriptionCancel?.userErrors?.length > 0) {
      const errors = result.data.appSubscriptionCancel.userErrors;
      throw new Error(`Subscription cancellation failed: ${errors.map((e: any) => e.message).join(', ')}`);
    }

    return result.data?.appSubscriptionCancel?.appSubscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}
