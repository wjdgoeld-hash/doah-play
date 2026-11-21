# Doah Play v0.1

A private, ad-free, Korean-first toddler play application. Runs as a progressive web app (PWA) on iPad and Android.

## Features
- Finger painting with seven colors and erase
- Picture matching with 12 animal icons
- 20 bilingual picture-word cards with Korean device text-to-speech
- Three simple original stories (nine illustrated emoji pages), read-aloud
- Parent gate (simple arithmetic) and per-session time limit
- Offline caching through service worker (requires first load over HTTPS)

## Deploy without a computer
1. Create a repository on GitHub (private recommended during development).
2. Upload the project files, keeping `index.html`, `sw.js`, `manifest.webmanifest`, and `icon.svg` in the same directory.
3. For GitHub Pages, a public repository can publish from Settings > Pages > Deploy from branch > main / root. If the repo is private, check Pages availability for the account plan or use another static HTTPS host.
4. Open the resulting Pages URL in Safari on iPad > Share > Add to Home Screen, or Chrome on Android > Install app.
5. Open once online to cache offline files; check offline behavior by switching on airplane mode.

## Technical notes
- Plain HTML/CSS/JavaScript, no build tools; intentionally minimal to allow editing on mobile devices.
- SVG app icon support depends on platform: PNG icon fallback is advisable for broad iOS PWA compatibility.
- Speech synthesis uses available device voices. Korean pronunciation depends on `ko-KR` voice installation and may be unavailable offline.
- Time limit is a soft in-app guard, not OS-level parental controls. The parent gate is intentionally lightweight, not security-grade.
- `localStorage` saves only the configured session duration; no usage analytics or remote user data collection.
- APK is **not** included. To produce a standalone Android APK later, integrate Capacitor and use Android CI with app signing; unsigned debug APKs are for testing only.

This is an early prototype, not a clinically validated educational product.
