import backgroundPattern from '@documenso/assets/images/background-pattern.png';
import { Link, Outlet } from 'react-router';

import { BrandingLogo } from '~/components/general/branding-logo';

export default function Layout() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12 md:p-12 lg:p-24">
      <div className="absolute top-6 left-6 md:top-12 md:left-12">
        <Link to="/">
          <BrandingLogo className="h-7 w-auto" />
        </Link>
      </div>

      <div>
        <div className="absolute -inset-[min(600px,max(400px,60vw))] -z-[1] flex items-center justify-center opacity-70">
          <img
            src={backgroundPattern}
            alt="background pattern"
            className="dark:brightness-95 dark:contrast-[70%] dark:invert dark:sepia"
            style={{
              mask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
              WebkitMask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
            }}
          />
        </div>

        <div className="relative w-full">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
