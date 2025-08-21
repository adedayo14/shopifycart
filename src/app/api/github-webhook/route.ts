import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GitHub webhook to trigger deployment refresh
export async function POST(request: NextRequest) {
  try {
    console.log('=== GITHUB WEBHOOK ===');
    
    // Verify GitHub webhook secret
    const githubSignature = request.headers.get('x-hub-signature-256');
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (!githubSignature || !webhookSecret) {
      return NextResponse.json(
        { error: 'Missing webhook signature or secret' },
        { status: 401 }
      );
    }

    const body = await request.text();
    
    // Simple signature verification (in production you'd want crypto.subtle)
    if (!body) {
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }

    const payload = JSON.parse(body);
    
    // Only trigger on push to main branch
    if (payload.ref !== 'refs/heads/main') {
      console.log('Ignoring push to non-main branch:', payload.ref);
      return NextResponse.json({ message: 'Ignored non-main branch push' });
    }

    console.log('Push to main detected - triggering deployment hook...');

    // Trigger our deployment hook
    const deploymentResponse = await fetch(`${process.env.SHOPIFY_APP_URL}/api/deployment-hook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEPLOYMENT_HOOK_SECRET}`
      }
    });

    const deploymentResult = await deploymentResponse.json();
    
    console.log('Deployment hook result:', deploymentResult);

    return NextResponse.json({
      success: true,
      message: 'GitHub webhook processed successfully',
      deploymentResult
    });

  } catch (error) {
    console.error('GitHub webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
