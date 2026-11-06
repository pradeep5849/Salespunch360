import { publicOrigin } from '@/lib/public-site/discovery';
export function GET() {
  return new Response(`User-agent: *\nContent-Signal: search=yes, ai-input=yes\nAllow: /\nDisallow: /workspace/\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${publicOrigin}/sitemap.xml\nHost: ${publicOrigin}\n`,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
