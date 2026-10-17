# Android

An APK could not be built in the build environment (Android SDK downloads blocked). The client in `client/` is an installable PWA.

1. Run the server on a machine you control (`npm start`), or host it behind HTTPS. Set `HOST=0.0.0.0` only behind HTTPS and set `ALLOWED_ORIGIN` if the client is served from a different origin.
2. On the phone open the server URL in Chrome, choose Add to Home screen.
3. In Settings enter the server URL (blank if same origin) and the `APP_TOKEN`. The token is kept in the browser only.

A Capacitor wrapper pointing at `client/` is possible but untested. API responses are never cached by the service worker, so technical content is never served from cache.
