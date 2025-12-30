import { cacheDurationMs } from './config.js';
import { HourlyWeather } from './types.js';

interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
  timezone: string;
}

interface ForecastResponse {
  hourly: Record<string, number[]> & { time: string[] };
  timezone: string;
}

const cache = new Map<string, { timestamp: number; data: HourlyWeather[]; name: string; timezone: string }>();

export async function geocode(query: string): Promise<GeoResult | undefined> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding failed');
  const json = await res.json();
  if (!json.results || json.results.length === 0) return undefined;
  const r = json.results[0];
  return { latitude: r.latitude, longitude: r.longitude, name: `${r.name}, ${r.country_code}`, timezone: r.timezone };
}

export async function fetchForecast(latitude: number, longitude: number): Promise<{ hours: HourlyWeather[]; name: string; timezone: string }> {
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.timestamp < cacheDurationMs) {
    return { hours: cached.data, name: cached.name, timezone: cached.timezone };
  }

  const hourlyParams = [
    'temperature_2m',
    'precipitation_probability',
    'precipitation',
    'weathercode',
    'windspeed_10m',
    'windgusts_10m',
    'cloudcover',
    'visibility',
  ];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=${hourlyParams.join(',')}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Forecast request failed');
  const json: ForecastResponse = await res.json();

  const hours: HourlyWeather[] = json.hourly.time.map((t, idx) => {
    const tempC = json.hourly.temperature_2m[idx];
    const precipProb = json.hourly.precipitation_probability[idx];
    const precip = json.hourly.precipitation[idx];
    const windKph = json.hourly.windspeed_10m[idx];
    const gustKph = json.hourly.windgusts_10m[idx];
    const visibilityMeters = json.hourly.visibility?.[idx];
    const weatherCode = json.hourly.weathercode?.[idx];
    const precipitationType = describeWeatherCode(weatherCode, precip);

    return {
      time: t,
      temperatureC: tempC,
      temperatureF: cToF(tempC),
      windSpeedKph: windKph,
      windSpeedMph: kphToMph(windKph),
      windGustKph: gustKph,
      windGustMph: kphToMph(gustKph),
      precipitationProbability: precipProb,
      precipitationMm: precip,
      precipitationType,
      cloudCover: json.hourly.cloudcover?.[idx],
      visibilityKm: typeof visibilityMeters === 'number' ? visibilityMeters / 1000 : undefined,
      visibilityMiles: typeof visibilityMeters === 'number' ? metersToMiles(visibilityMeters) : undefined,
      thunder: weatherCode ? isThunder(weatherCode) : false,
    };
  });

  cache.set(key, { timestamp: now, data: hours, name: `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`, timezone: json.timezone });
  return { hours, name: `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`, timezone: json.timezone };
}

function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

function kphToMph(kph: number): number {
  return kph * 0.621371;
}

function metersToMiles(m: number): number {
  return m / 1609.34;
}

function isThunder(code: number): boolean {
  return [95, 96, 99].includes(code);
}

function describeWeatherCode(code?: number, precip?: number): string | undefined {
  if (code === undefined || code === null) return precip && precip > 0 ? 'Precipitation' : undefined;
  const mapping: Record<number, string> = {
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Heavy freezing rain',
    71: 'Snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Rain showers',
    81: 'Rain showers',
    82: 'Heavy rain showers',
    85: 'Snow showers',
    86: 'Snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with hail',
  };
  return mapping[code];
}
