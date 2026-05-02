import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/passenger/', '/driver/', '/api/', '/sso-callback/'],
    },
    sitemap: 'https://motaxi.dev/sitemap.xml',
  };
}
