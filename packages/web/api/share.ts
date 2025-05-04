/**
 * Edge function: create + fetch gradient slugs.
 * Works on Cloudflare Workers, Vercel Edge Functions, Netlify Edge.
 *
 *  ➜  Bind a KV store and expose it on globalThis.KV      (Cloudflare: `bindings`)
 *  ➜  Set ENV `KV_PREFIX`, so keys are `${KV_PREFIX}:${slug}`
 */

import { nanoid } from 'nanoid';
import { Gradient } from '@gradient-tool/core';
import { kv } from '@vercel/kv'; // Import the Vercel KV client

type Json<T> = Response & { json(): Promise<T> };

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

/** Generic JSON response helper */
function json(obj: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

/** Main request handler */
export default async function handler(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);

  // POST /api/share -> Create gradient and return slug
  if (req.method === 'POST') {
    // No need to check KV availability here; SDK methods handle it.
    // Catch errors during kv.set/kv.get operations instead.
    try {
      const payload = (await req.json()) as Gradient;
      // Basic validation
      if (!payload?.stops?.length || !Array.isArray(payload.stops)) {
        return json({ error: 'Invalid gradient data' }, 400);
      }
      const slug = await createSlug(payload);
      return json({ slug }); // Successfully created
    } catch (error: any) { // Catch specific errors if needed
       if (error.message?.includes('Slug collision')) {
           return json({ error: 'Failed to generate unique ID, please try again' }, 500);
       } 
       console.error('Error creating share link:', error);
       return json({ error: 'Could not create share link' }, 500);
    }
  }

  // GET /api/share?slug=... or potentially /api/share/:slug depending on routing
  if (req.method === 'GET') {
    // No need to check KV availability here
    
    // Extract slug - prefer query param for simplicity with standard fetch
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');

    if (!slug) {
      return json({ error: 'Missing slug parameter' }, 400);
    }

    try {
      // Use Vercel KV client to get the data
      const raw = await kv.get<string>(slug); // Specify type if known (stringified JSON)
      if (raw === null) { // kv.get returns null if not found
        return json({ error: 'Gradient not found' }, 404);
      }
      // Parse the stored JSON string
      const gradient = JSON.parse(raw) as Gradient;
      // Return the gradient data with caching headers
      return json(gradient, 200, {
        'Cache-Control': 'public, max-age=31536000, immutable' // Cache for 1 year
      });
    } catch (error) {
        console.error('Error fetching share link:', error);
        // Don't expose detailed errors
        return json({ error: 'Could not retrieve gradient'}, 500);
    }
  }

  // Fallback for unsupported methods
  return json({ error: 'Method Not Allowed'}, 405, { 'Allow': 'GET, POST' });
}

// Vercel specific config (optional, can be in vercel.json)
// export const config = {
//   runtime: 'edge',
// }; 