import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** Web-only HTML shell: makes Add-to-Home-Screen open full screen like an app. */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Wembley Central Masjid</title>
        <meta name="theme-color" content="#159778" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="WCM" />
        {/* Supabase magic-link safety net: if an auth token lands on the app
            instead of /admin/ (redirect quirks), forward it before React loads. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if((location.hash.indexOf('access_token')>-1||location.search.indexOf('code=')>-1)&&location.pathname.indexOf('/admin')===-1){location.replace(location.pathname.replace(/\\/?$/,'/admin/')+location.search+location.hash);}",
          }}
        />
        <ScrollViewStyleReset />
        {/* Desktop web: present the app in a phone-sized frame (like the
            prototype's .phone-frame) instead of stretching full width. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media (min-width: 500px) {
                body { background: #e9eaee; }
                #root {
                  max-width: 390px;
                  height: 96vh;
                  margin: 2vh auto;
                  overflow: hidden;
                  border-radius: 24px;
                  box-shadow: 0 12px 40px rgba(0,0,0,0.25);
                  border: 1px solid #d5d5d5;
                }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
