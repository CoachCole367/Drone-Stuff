# Drone-Stuff

Is it safe to fly my drone today? A lightweight, browser-only app that checks hourly weather to suggest safe flying windows.

## Running

1. Build TypeScript: `npm run build` (uses the bundled TypeScript compiler).
2. Open `index.html` in a browser (no dev server required).

The app will request geolocation on load and falls back to manual search (city/state or `lat,long`).

## Features

- Hourly forecast from Open-Meteo (winds, gusts, precip, temp, visibility, cloud cover, thunder) showing the next 24 hours from right now.
- Rating engine with configurable thresholds (see `src/config.ts`).
- "How we rate" modal explaining the rules.
- Best 1–3 hour flying window suggestion.
- Unit toggles for wind (mph/kph) and temperature (°F/°C).
- Graceful error messaging and 10-minute in-memory caching of forecasts.
