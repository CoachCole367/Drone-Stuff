import { fetchForecast, geocode } from './dataService.js';
import { renderForecast, renderRules } from './ui.js';
let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let windUnit = 'mph';
let tempUnit = 'f';
let viewMode = '24h';
let calendarFilter = 'all';
let allHours = [];
let lastHours = [];
async function requestLocation() {
    if (!('geolocation' in navigator)) {
        updateStatusText('Geolocation is not supported in this browser. Use manual search.');
        return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
        await loadForecast(pos.coords.latitude, pos.coords.longitude, 'Your location');
    }, (err) => {
        console.warn(err);
        updateStatusText('Location blocked. Please type a city or coordinates.');
    });
}
async function manualSearch() {
    const input = document.getElementById('location-input');
    if (!input)
        return;
    const query = input.value.trim();
    if (!query)
        return;
    const coords = parseLatLong(query);
    try {
        if (coords) {
            await loadForecast(coords.lat, coords.lon, `Lat ${coords.lat.toFixed(2)}, Lon ${coords.lon.toFixed(2)}`);
        }
        else {
            const geo = await geocode(query);
            if (!geo) {
                updateStatusText('No results for that search. Try a city name or lat,long.');
                return;
            }
            await loadForecast(geo.latitude, geo.longitude, geo.name, geo.timezone);
        }
    }
    catch (err) {
        console.error(err);
        updateStatusText('Unable to fetch forecast. Please try again later.');
    }
}
async function loadForecast(lat, lon, label, tz) {
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
    }
    catch (err) {
        console.error(err);
        updateStatusText('Weather API failed. Try again in a minute.');
    }
    finally {
        setLoading(false);
    }
}
function filterByView(hours, tz, mode) {
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
function sampleRange(hours, startIdx, totalHours, stepHours) {
    const result = [];
    const maxIdx = hours.length;
    for (let offset = 0; offset < totalHours; offset += stepHours) {
        const idx = startIdx + offset;
        if (idx >= maxIdx)
            break;
        result.push(hours[idx]);
    }
    return result;
}
function formatHourKey(date, tz) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    return `${year}-${month}-${day}T${hour}:00`;
}
function parseLatLong(input) {
    const match = input.match(/(-?\d+\.\d+|\d+)\s*,\s*(-?\d+\.\d+|\d+)/);
    if (!match)
        return undefined;
    return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) };
}
function updateLocationLabel(label, tz) {
    const el = document.getElementById('location-label');
    if (el) {
        el.textContent = `${label} • ${tz}`;
    }
}
function statusCopyForMode(mode) {
    if (mode === '72h')
        return 'Showing the next 72 hours (every 4 hours) from the current local time.';
    if (mode === 'weekly')
        return 'Showing 8 AM and 8 PM snapshots for the upcoming week.';
    return 'Showing the next 24 hours from the current local time.';
}
function updateStatusText(message) {
    const el = document.getElementById('status-detail');
    if (el)
        el.textContent = message;
}
function setLoading(loading) {
    const btn = document.getElementById('location-btn');
    if (btn)
        btn.textContent = loading ? 'Loading…' : 'Use my location';
}
function setupControls() {
    document.getElementById('location-btn')?.addEventListener('click', () => requestLocation());
    document.getElementById('search-btn')?.addEventListener('click', () => manualSearch());
    document.getElementById('how-btn')?.addEventListener('click', () => openModal());
    document.getElementById('close-how')?.addEventListener('click', () => closeModal());
    const windSelect = document.getElementById('wind-unit');
    const tempSelect = document.getElementById('temp-unit');
    const viewSelect = document.getElementById('view-mode');
    loadUnitPreferences(windSelect, tempSelect);
    windSelect?.addEventListener('change', () => {
        windUnit = windSelect.value;
        persistUnitPreferences();
        refreshExisting();
    });
    tempSelect?.addEventListener('change', () => {
        tempUnit = tempSelect.value;
        persistUnitPreferences();
        refreshExisting();
    });
    viewSelect?.addEventListener('change', () => {
        viewMode = viewSelect.value;
        refreshExisting();
        updateStatusText(statusCopyForMode(viewMode));
    });
    document.querySelectorAll('[data-calendar-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.calendarFilter;
            if (!value)
                return;
            calendarFilter = value;
            updateCalendarFilterUI(value);
            refreshExisting();
        });
    });
}
function openModal() {
    const dialog = document.getElementById('how-modal');
    if (dialog && !dialog.open)
        dialog.showModal();
}
function closeModal() {
    const dialog = document.getElementById('how-modal');
    if (dialog && dialog.open)
        dialog.close();
}
function refreshExisting() {
    if (!lastHours.length)
        return;
    const filtered = filterByView(allHours.length ? allHours : lastHours, timezone, viewMode);
    lastHours = filtered;
    renderForecast(lastHours, { windUnit, tempUnit, timezone, calendarFilter });
}
function updateCalendarFilterUI(selected) {
    document.querySelectorAll('[data-calendar-filter]').forEach((btn) => {
        const value = btn.dataset.calendarFilter;
        if (!value)
            return;
        if (value === selected) {
            btn.classList.add('chip-active');
        }
        else {
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
function persistUnitPreferences() {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.setItem('windUnit', windUnit);
        localStorage.setItem('tempUnit', tempUnit);
    }
    catch (err) {
        console.warn('Unable to store preferences', err);
    }
}
function loadUnitPreferences(windSelect, tempSelect) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        const savedWind = localStorage.getItem('windUnit');
        const savedTemp = localStorage.getItem('tempUnit');
        if (savedWind === 'mph' || savedWind === 'kph') {
            windUnit = savedWind;
            if (windSelect)
                windSelect.value = savedWind;
        }
        if (savedTemp === 'f' || savedTemp === 'c') {
            tempUnit = savedTemp;
            if (tempSelect)
                tempSelect.value = savedTemp;
        }
    }
    catch (err) {
        console.warn('Unable to load preferences', err);
    }
}
