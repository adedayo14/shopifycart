import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
  try {
    // Check if blocks already exist
    const existingBlocks = await prisma.block.findMany();
    if (existingBlocks.length > 0) {
      return NextResponse.json({ 
        message: 'Blocks already exist',
        count: existingBlocks.length,
        blocks: existingBlocks.map(b => ({ id: b.id, name: b.name, price: b.price }))
      });
    }

    // Create sample blocks
    const blocks = await prisma.block.createMany({
      data: [
        {
          id: 'product-showcase',
          name: 'Product Showcase',
          description: 'Beautiful product display with hover effects',
          price: 29.99,
          category: 'product',
          previewImage: '/images/product-showcase.jpg',
          tags: ['product', 'showcase', 'hover'],
          isActive: true
        },
        {
          id: 'testimonial-slider',
          name: 'Testimonial Slider',
          description: 'Customer testimonials with smooth transitions',
          price: 24.99,
          category: 'social-proof',
          previewImage: '/images/testimonial-slider.jpg',
          tags: ['testimonial', 'slider', 'social-proof'],
          isActive: true
        },
        {
          id: 'hero-banner',
          name: 'Hero Banner',
          description: 'Eye-catching hero section with call-to-action',
          price: 34.99,
          category: 'hero',
          previewImage: '/images/hero-banner.jpg',
          tags: ['hero', 'banner', 'cta'],
          isActive: true
        },
        {
          id: 'feature-grid',
          name: 'Feature Grid',
          description: 'Highlight key features in a responsive grid',
          price: 19.99,
          category: 'content',
          previewImage: '/images/feature-grid.jpg',
          tags: ['features', 'grid', 'responsive'],
          isActive: true
        }
      ]
    });

    return NextResponse.json({
      success: true,
      message: 'Blocks seeded successfully',
      count: blocks.count
    });

  } catch (error) {
    console.error('Seed blocks error:', error);
    return NextResponse.json({ 
      error: 'Failed to seed blocks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}