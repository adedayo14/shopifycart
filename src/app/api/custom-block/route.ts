import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      email, 
      shopDomain, 
      blockDescription, 
      features, 
      timeline, 
      budget,
      whatsappContact,
      whatsappNumber 
    } = body;

    // Validate required fields
    if (!name || !email || !shopDomain || !blockDescription) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create email content for logging
    const emailContent = `
New Custom Block Request

Client Details:
- Name: ${name}
- Email: ${email}
- Shop Domain: ${shopDomain}
- WhatsApp Contact: ${whatsappContact ? 'Yes' : 'No'}
${whatsappContact && whatsappNumber ? `- WhatsApp Number: ${whatsappNumber}` : ''}

Project Details:
- Block Description: ${blockDescription}
- Required Features: ${features || 'Not specified'}
- Timeline: ${timeline || 'Not specified'}
- Budget: ${budget || 'Not specified'}

Submitted: ${new Date().toISOString()}
    `;

    // Log the request for reference
    console.log('Custom Block Request:', emailContent);

    // Store in database for admin tracking
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      // Save to CustomBlockRequest table
      await prisma.customBlockRequest.create({
        data: {
          name,
          email,
          shopDomain,
          blockDescription,
          features: features || null,
          timeline: timeline || null,
          budget: budget || null,
          whatsappContact: whatsappContact || false,
          whatsappNumber: whatsappContact && whatsappNumber ? whatsappNumber : null,
          status: 'pending'
        }
      });
      
      await prisma.$disconnect();
      console.log('Custom block request saved to database successfully');
      
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Still return success since the form was submitted, just log the error
    }

    return NextResponse.json({
      success: true,
      message: 'Custom block request submitted successfully! We will contact you within 24 hours.'
    });

  } catch (error) {
    console.error('Custom block request error:', error);
    return NextResponse.json(
      { error: 'Failed to submit custom block request' },
      { status: 500 }
    );
  }
}
