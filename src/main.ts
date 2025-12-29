import { fetchForecast, geocode } from './dataService.js';
import { renderForecast, renderRules } from './ui.js';
import { HourlyWeather } from './types.js';

let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let windUnit: 'mph' | 'kph' = 'mph';
let tempUnit: 'f' | 'c' = 'f';
let lastHours: HourlyWeather[] = [];

async function requestLocation() {
  if (!('geolocation' in navigator)) {
    updateStatusText('Geolocation is not supported in this browser. Use manual search.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      await loadForecast(pos.coords.latitude, pos.coords.longitude, 'Your location');
    },
    (err) => {
      console.warn(err);
      updateStatusText('Location blocked. Please type a city or coordinates.');
    }
  );
}

async function manualSearch() {
  const input = document.getElementById('location-input') as HTMLInputElement | null;
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;
  const coords = parseLatLong(query);
  try {
    if (coords) {
      await loadForecast(coords.lat, coords.lon, `Lat ${coords.lat.toFixed(2)}, Lon ${coords.lon.toFixed(2)}`);
    } else {
      const geo = await geocode(query);
      if (!geo) {
        updateStatusText('No results for that search. Try a city name or lat,long.');
        return;
      }
      await loadForecast(geo.latitude, geo.longitude, geo.name, geo.timezone);
    }
  } catch (err) {
    console.error(err);
    updateStatusText('Unable to fetch forecast. Please try again later.');
  }
}

async function loadForecast(lat: number, lon: number, label: string, tz?: string) {
  setLoading(true);
  try {
    const forecast = await fetchForecast(lat, lon);
    timezone = tz ?? forecast.timezone;
    updateLocationLabel(label, timezone);
    lastHours = filterToday(forecast.hours, timezone);
    renderForecast(lastHours, { windUnit, tempUnit, timezone });
  } catch (err) {
    console.error(err);
    updateStatusText('Weather API failed. Try again in a minute.');
  } finally {
    setLoading(false);
  }
}

function filterToday(hours: HourlyWeather[], tz: string): HourlyWeather[] {
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  return hours.filter((h) => h.time.startsWith(today)).slice(0, 24);
}

function parseLatLong(input: string): { lat: number; lon: number } | undefined {
  const match = input.match(/(-?\d+\.\d+|\d+)\s*,\s*(-?\d+\.\d+|\d+)/);
  if (!match) return undefined;
  return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) };
}

function updateLocationLabel(label: string, tz: string) {
  const el = document.getElementById('location-label');
  if (el) {
    el.textContent = `${label} • ${tz}`;
  }
}

function updateStatusText(message: string) {
  const el = document.getElementById('status-detail');
  if (el) el.textContent = message;
}

function setLoading(loading: boolean) {
  const btn = document.getElementById('location-btn');
  if (btn) btn.textContent = loading ? 'Loading…' : 'Use my location';
}

function setupControls() {
  document.getElementById('location-btn')?.addEventListener('click', () => requestLocation());
  document.getElementById('search-btn')?.addEventListener('click', () => manualSearch());
  document.getElementById('how-btn')?.addEventListener('click', () => openModal());
  document.getElementById('close-how')?.addEventListener('click', () => closeModal());

  const windSelect = document.getElementById('wind-unit') as HTMLSelectElement | null;
  const tempSelect = document.getElementById('temp-unit') as HTMLSelectElement | null;
  windSelect?.addEventListener('change', () => {
    windUnit = windSelect.value as 'mph' | 'kph';
    refreshExisting();
  });
  tempSelect?.addEventListener('change', () => {
    tempUnit = tempSelect.value as 'f' | 'c';
    refreshExisting();
  });
}

function openModal() {
  const dialog = document.getElementById('how-modal') as HTMLDialogElement | null;
  if (dialog && !dialog.open) dialog.showModal();
}

function closeModal() {
  const dialog = document.getElementById('how-modal') as HTMLDialogElement | null;
  if (dialog && dialog.open) dialog.close();
}

function refreshExisting() {
  if (!lastHours.length) return;
  renderForecast(lastHours, { windUnit, tempUnit, timezone });
}

function init() {
  setupControls();
  renderRules();
  requestLocation();
}

document.addEventListener('DOMContentLoaded', init);
