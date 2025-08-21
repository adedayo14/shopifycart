import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const blockDescription = formData.get('blockDescription') as string
    const features = formData.get('features') as string
    const websiteLink = formData.get('websiteLink') as string
    const shopDomain = formData.get('shopDomain') as string
    const image = formData.get('image') as File | null

    // Validate required fields
    if (!name || !email || !blockDescription) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and block description are required' },
        { status: 400 }
      )
    }

    let imagePath = null
    
    // Handle image upload if provided
    if (image && image.size > 0) {
      try {
        const bytes = await image.arrayBuffer()
        const buffer = Buffer.from(bytes)
        
        // Create unique filename
        const timestamp = Date.now()
        const extension = image.name.split('.').pop() || 'jpg'
        const filename = `suggestion-${timestamp}.${extension}`
        
        // Create uploads directory if it doesn't exist
        const uploadDir = join(process.cwd(), 'public/uploads/suggestions')
        await mkdir(uploadDir, { recursive: true })
        
        const fullPath = join(uploadDir, filename)
        await writeFile(fullPath, new Uint8Array(buffer))
        
        imagePath = `/uploads/suggestions/${filename}` // Store relative path for serving
      } catch (uploadError) {
        console.error('Failed to upload image:', uploadError)
        imagePath = null
      }
    }

    // For now, let's save to the custom block request table since BlockSuggestion doesn't exist yet
    // We'll add a marker to distinguish suggestions from custom requests
    const suggestion = await prisma.customBlockRequest.create({
      data: {
        name,
        email,
        shopDomain,
        blockDescription: `[SUGGESTION] ${blockDescription}${imagePath ? ` [Image: ${imagePath}]` : ''}`,
        features: features || null,
        timeline: websiteLink ? `Website: ${websiteLink}` : null,
        budget: 'Free Suggestion',
        whatsappContact: false,
        whatsappNumber: null,
        status: 'pending'
      }
    })

    return NextResponse.json({
      success: true,
      data: { id: suggestion.id }
    })

  } catch (error) {
    console.error('Suggestion form error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to submit suggestion' },
      { status: 500 }
    )
  }
}
