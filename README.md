# Commute

Compare driving, transit, and drive+transit (GO) routes between two locations using Google Maps.

## Setup

1. Create a [Google Cloud project](https://console.cloud.google.com/) and enable:
   - Maps JavaScript API
   - Places API
   - Directions API (Legacy)

2. Create an API key and restrict it to HTTP referrers (e.g. `localhost:*`, your production domain).

3. Copy `.env.example` to `.env` and add your key:
   ```bash
   cp .env.example .env
   # Edit .env and set VITE_GOOGLE_MAPS_API_KEY=your_key
   ```

4. Install and run:
   ```bash
   npm install
   npm run dev
   ```

## Usage

1. Enter an origin (e.g. home address) in the first field.
2. Enter a destination (e.g. office) in the second field.
3. Click **Calculate** to compare driving and transit times.
4. Click a result card to show that route on the map.
