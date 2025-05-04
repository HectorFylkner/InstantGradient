/**
 * Edge function: create + fetch gradient slugs.
 * Works on Cloudflare Workers, Vercel Edge Functions, Netlify Edge.
 *
 *  ➜  Bind a KV store and expose it on globalThis.KV      (Cloudflare: `bindings`)
 *  ➜  Set ENV `KV_PREFIX`, so keys are `${KV_PREFIX}:${slug}`
 */

import { nanoid } from 'nanoid';
import type { Gradient } from '@gradient-tool/core';
import { kv } from '@vercel/kv'; // Import the Vercel KV client

/** Generates a unique slug and stores the gradient data. Retries on collision. */
async function createSlug(data: Gradient): Promise<string> {
  // No need to check for KV availability explicitly, SDK handles it
  for (let i = 0; i < 3; i++) {
    // Generate web-friendly 6-char ID
    const slug = nanoid(6).replace(/[-_]/g, '');
    // Check if slug already exists using Vercel KV client
    // kv.get returns the value directly, or null if not found.
    if ((await kv.get(slug)) === null) {
      // Store the gradient JSON stringified using Vercel KV client
      // Vercel KV automatically stringifies objects, but explicit is safer
      await kv.set(slug, JSON.stringify(data));
      return slug;
    }
    // If exists, loop will retry
  }
  // Failed after retries
  throw new Error('Slug collision after multiple attempts');
}

/** Main request handler */
export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // POST /api/share -> Create gradient and return slug
  if (req.method === 'POST') {
    // No need to check KV availability here; SDK methods handle it.
    // Catch errors during kv.set/kv.get operations instead.
    try {
      const payload = (await req.json()) as Gradient;
      // Basic validation
      if (!payload?.stops?.length || !Array.isArray(payload.stops)) {
        return new Response('Invalid gradient data', { status: 400 });
      }
      const slug = await createSlug(payload);
      return Response.json({ slug }); // Use standard Response.json()
    } catch (error: unknown) {
       // Type guard for Error object
       let errorMessage = 'Could not create share link';
       if (error instanceof Error && error.message?.includes('Slug collision')) {
           errorMessage = 'Failed to generate unique ID, please try again';
           return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
       }
       console.error('Error creating share link:', error);
       return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
    }
  }

  // GET /api/share?slug=... or potentially /api/share/:slug depending on routing
  if (req.method === 'GET') {
    // No need to check KV availability here
    
    // Extract slug - prefer query param for simplicity with standard fetch
    const slug = url.searchParams.get('slug');

    if (!slug) {
      return new Response('Missing slug parameter', { status: 400 });
    }

    try {
      // Use Vercel KV client to get the data
      const raw = await kv.get<string>(slug); // Specify type if known (stringified JSON)
      if (raw === null) { // kv.get returns null if not found
        return new Response('Gradient not found', { status: 404 });
      }
      // Parse the stored JSON string
      const gradient = JSON.parse(raw) as Gradient;
      // Return the gradient data with caching headers
      return Response.json(gradient, {
        status: 200,
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } // Cache for 1 year
      });
    } catch (error) {
        console.error('Error fetching share link:', error);
        // Don't expose detailed errors
        return new Response(JSON.stringify({ error: 'Could not retrieve gradient' }), { status: 500 });
    }
  }

  // Fallback for unsupported methods
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { 'Allow': 'GET, POST' }
  });
}

// Vercel specific config (optional, can be in vercel.json)
// export const config = {
//   runtime: 'edge',
// }; 