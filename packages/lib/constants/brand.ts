import { env } from '../utils/env';

export const APP_BRANDS = ['documenso', 'aushail', 'urbanstorm', 'assessdirect'] as const;

export type TAppBrand = (typeof APP_BRANDS)[number];

type BrandIconLink = {
  rel: string;
  href: string;
  sizes?: string;
  type?: string;
};

type BrandConfig = {
  id: TAppBrand;
  productName: string;
  assetPath: string;
  manifestPath: string;
  logoPath?: string;
  logoIconPath?: string;
  icons: BrandIconLink[];
};

const BRAND_CONFIGS: Record<TAppBrand, BrandConfig> = {
  documenso: {
    id: 'documenso',
    productName: 'Documenso',
    assetPath: '/branding/documenso',
    manifestPath: '/branding/documenso/site.webmanifest',
    logoPath: '/branding/documenso/apple-touch-icon.png',
    logoIconPath: '/branding/documenso/apple-touch-icon.png',
    icons: [
      { rel: 'icon', href: 'favicon.ico', sizes: 'any' },
      { rel: 'icon', href: 'favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { rel: 'icon', href: 'favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { rel: 'apple-touch-icon', href: 'apple-touch-icon.png', sizes: '180x180' },
    ],
  },
  aushail: {
    id: 'aushail',
    productName: 'eSign AusHail',
    assetPath: '/branding/aushail',
    manifestPath: '/branding/aushail/site.webmanifest',
    logoPath: '/branding/aushail/favicon.svg',
    logoIconPath: '/branding/aushail/favicon.svg',
    icons: [
      { rel: 'icon', href: 'favicon.ico', sizes: 'any' },
      { rel: 'icon', href: 'favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: 'favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { rel: 'apple-touch-icon', href: 'apple-touch-icon.png', sizes: '180x180' },
    ],
  },
  urbanstorm: {
    id: 'urbanstorm',
    productName: 'eSign UrbanStorm',
    assetPath: '/branding/urbanstorm',
    manifestPath: '/branding/urbanstorm/site.webmanifest',
    logoPath: '/branding/urbanstorm/favicon.svg',
    logoIconPath: '/branding/urbanstorm/favicon.svg',
    icons: [
      { rel: 'icon', href: 'favicon.ico', sizes: 'any' },
      { rel: 'icon', href: 'favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: 'favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { rel: 'apple-touch-icon', href: 'apple-touch-icon.png', sizes: '180x180' },
    ],
  },
  assessdirect: {
    id: 'assessdirect',
    productName: 'eSign AssessDirect',
    assetPath: '/branding/assessdirect',
    manifestPath: '/branding/assessdirect/site.webmanifest',
    logoPath: '/branding/assessdirect/favicon.svg',
    logoIconPath: '/branding/assessdirect/favicon.svg',
    icons: [
      { rel: 'icon', href: 'favicon.ico', sizes: 'any' },
      { rel: 'icon', href: 'favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: 'favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { rel: 'apple-touch-icon', href: 'apple-touch-icon.png', sizes: '180x180' },
    ],
  },
};

export const getAppBrand = (): TAppBrand => {
  const value = env('NEXT_PUBLIC_APP_BRAND');

  if (value === 'aushail' || value === 'urbanstorm' || value === 'assessdirect') {
    return value;
  }

  return 'documenso';
};

export const getAppBrandConfig = (): BrandConfig => {
  return BRAND_CONFIGS[getAppBrand()];
};

export const getAppBrandIconLinks = () => {
  const { assetPath, icons } = getAppBrandConfig();

  return icons.map((icon) => ({
    rel: icon.rel,
    href: `${assetPath}/${icon.href}`,
    ...(icon.sizes ? { sizes: icon.sizes } : {}),
    ...(icon.type ? { type: icon.type } : {}),
  }));
};
