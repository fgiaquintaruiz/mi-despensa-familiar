import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico (browser tab icon)
     * - files with an extension (e.g. .svg, .png, .js, .css)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.[^/]+$).*)',
  ],
};
