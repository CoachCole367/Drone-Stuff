import { fetchForecast, geocode } from './dataService.js';
import { renderForecast, renderRules } from './ui.js';
import { CalendarFilter, HourlyWeather } from './types.js';

let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let windUnit: 'mph' | 'kph' = 'mph';
let tempUnit: 'f' | 'c' = 'f';
let viewMode: '24h' | '72h' | 'weekly' = '24h';
let calendarFilter: CalendarFilter = 'all';
let allHours: HourlyWeather[] = [];
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
    const resolvedTz = forecast.timezone;
    timezone = resolvedTz;
    updateLocationLabel(label, resolvedTz);
    allHours = forecast.hours;
    lastHours = filterByView(forecast.hours, resolvedTz, viewMode);
    renderForecast(lastHours, { windUnit, tempUnit, timezone: resolvedTz, calendarFilter });
    updateStatusText(statusCopyForMode(viewMode));
  } catch (err) {
    console.error(err);
    updateStatusText('Weather API failed. Try again in a minute.');
  } finally {
    setLoading(false);
  }
}

function filterByView(hours: HourlyWeather[], tz: string, mode: typeof viewMode): HourlyWeather[] {
  const nowKey = formatHourKey(new Date(), tz);
  const startIdx = hours.findIndex((h) => h.time >= nowKey);
  const begin = startIdx >= 0 ? startIdx : 0;

  if (mode === '72h') {
    return sampleRange(hours, begin, 72, 4);
  }

  if (mode === 'weekly') {
    const targetHours = ['T08:00', 'T20:00'];
    const filtered = hours.filter((h) => h.time >= nowKey && targetHours.some((t) => h.time.includes(t)));
    return filtered.slice(0, 14);
  }

  return sampleRange(hours, begin, 24, 1);
}

function sampleRange(hours: HourlyWeather[], startIdx: number, totalHours: number, stepHours: number): HourlyWeather[] {
  const result: HourlyWeather[] = [];
  const maxIdx = hours.length;
  for (let offset = 0; offset < totalHours; offset += stepHours) {
    const idx = startIdx + offset;
    if (idx >= maxIdx) break;
    result.push(hours[idx]);
  }
  return result;
}

function formatHourKey(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  return `${year}-${month}-${day}T${hour}:00`;
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

function statusCopyForMode(mode: typeof viewMode): string {
  if (mode === '72h') return 'Showing the next 72 hours (every 4 hours) from the current local time.';
  if (mode === 'weekly') return 'Showing 8 AM and 8 PM snapshots for the upcoming week.';
  return 'Showing the next 24 hours from the current local time.';
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
  const viewSelect = document.getElementById('view-mode') as HTMLSelectElement | null;
  windSelect?.addEventListener('change', () => {
    windUnit = windSelect.value as 'mph' | 'kph';
    refreshExisting();
  });
  tempSelect?.addEventListener('change', () => {
    tempUnit = tempSelect.value as 'f' | 'c';
    refreshExisting();
  });
  viewSelect?.addEventListener('change', () => {
    viewMode = viewSelect.value as typeof viewMode;
    refreshExisting();
    updateStatusText(statusCopyForMode(viewMode));
  });

  document.querySelectorAll('[data-calendar-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = (btn as HTMLElement).dataset.calendarFilter as CalendarFilter | undefined;
      if (!value) return;
      calendarFilter = value;
      updateCalendarFilterUI(value);
      refreshExisting();
    });
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
  const filtered = filterByView(allHours.length ? allHours : lastHours, timezone, viewMode);
  lastHours = filtered;
  renderForecast(lastHours, { windUnit, tempUnit, timezone, calendarFilter });
}

function updateCalendarFilterUI(selected: CalendarFilter) {
  document.querySelectorAll('[data-calendar-filter]').forEach((btn) => {
    const value = (btn as HTMLElement).dataset.calendarFilter as CalendarFilter | undefined;
    if (!value) return;
    if (value === selected) {
      btn.classList.add('chip-active');
    } else {
      btn.classList.remove('chip-active');
    }
  });
}

function init() {
  setupControls();
  renderRules();
  updateCalendarFilterUI(calendarFilter);
  requestLocation();
}

document.addEventListener('DOMContentLoaded', init);
