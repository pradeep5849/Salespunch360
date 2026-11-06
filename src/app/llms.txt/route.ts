import { publicMarkdown } from '@/lib/public-site/discovery';
export function GET() {
  return new Response(publicMarkdown(),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
