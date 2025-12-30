import { bestWindow, rateHour, ruleDescriptions } from './rating.js';
import { HourlyWeather, RatingLabel, HourWithRating } from './types.js';

export interface UIOptions {
  windUnit: 'mph' | 'kph';
  tempUnit: 'f' | 'c';
  timezone: string;
}

export function renderRules() {
  const rules = ruleDescriptions();
  const container = document.getElementById('rule-list');
  if (!container) return;
  container.innerHTML = '';
  rules.forEach((r) => {
    const div = document.createElement('div');
    div.className = 'rule-card';
    div.innerHTML = `<strong>${r.title}</strong><div class="muted">${r.detail}</div>`;
    container.appendChild(div);
  });
}

export function renderForecast(hours: HourlyWeather[], opts: UIOptions) {
  const target = document.getElementById('forecast');
  if (!target) return;
  target.innerHTML = '';
  const rated: HourWithRating[] = hours.map((h) => ({ ...h, rating: rateHour(h) }));
  const windowResult = bestWindow(hours);
  updateStatus(rated, windowResult.window, opts);

  rated.forEach((hour) => {
    const card = document.createElement('article');
    card.className = 'card';
    const time = new Date(hour.time);
    const timeLabel = time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: opts.timezone });
    const temp = opts.tempUnit === 'f' ? `${hour.temperatureF.toFixed(0)}°F` : `${hour.temperatureC.toFixed(0)}°C`;
    const windSpeed = opts.windUnit === 'mph' ? `${hour.windSpeedMph.toFixed(0)} mph` : `${hour.windSpeedKph.toFixed(0)} kph`;
    const gust = opts.windUnit === 'mph' ? `${hour.windGustMph.toFixed(0)} mph` : `${hour.windGustKph.toFixed(0)} kph`;
    const precip = `${hour.precipitationProbability}%${hour.precipitationType ? ' • ' + hour.precipitationType : ''}`;
    const visibility = hour.visibilityMiles
      ? opts.windUnit === 'mph'
        ? `${hour.visibilityMiles.toFixed(1)} mi vis`
        : `${hour.visibilityKm?.toFixed(1)} km vis`
      : 'Visibility n/a';

    const warningIcons = hour.rating.warnings.length ? `<span class="warning">⚠ ${hour.rating.warnings.join(', ')}</span>` : '';

    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="muted">${timeLabel}</div>
          <div class="metric"><strong>${temp}</strong></div>
        </div>
        <span class="badge ${hour.rating.label.toLowerCase()}">${hour.rating.label}</span>
      </div>
      <div class="metrics">
        <span class="metric">Wind ${windSpeed}</span>
        <span class="metric">Gusts ${gust}</span>
        <span class="metric">Precip ${precip}</span>
        <span class="metric">${visibility}</span>
        ${hour.cloudCover !== undefined ? `<span class="metric">Cloud ${hour.cloudCover}%</span>` : ''}
      </div>
      ${warningIcons}
      <div class="muted" style="display:none" data-detail>
        ${hour.rating.reasons.map((r) => `<div>• ${r}</div>`).join('')}
      </div>
    `;

    card.addEventListener('click', () => {
      const detail = card.querySelector('[data-detail]') as HTMLElement;
      if (detail) {
        const showing = detail.style.display === 'block';
        detail.style.display = showing ? 'none' : 'block';
      }
    });

    target.appendChild(card);
  });
}

function updateStatus(hours: HourWithRating[], windowResult: { start: string; end: string; label: RatingLabel } | undefined, opts: UIOptions) {
  const overall = document.getElementById('overall-status');
  const best = document.getElementById('best-window');
  const detail = document.getElementById('status-detail');

  if (!overall || !best || !detail) return;

  const worst = hours.some((h) => h.rating.label === 'Bad')
    ? 'Bad'
    : hours.some((h) => h.rating.label === 'Risky')
    ? 'Risky'
    : 'Good';

  overall.textContent = worst;
  overall.className = `pill ${worst.toLowerCase()}`;

  if (windowResult) {
    const start = new Date(windowResult.start).toLocaleTimeString([], { hour: 'numeric', timeZone: opts.timezone });
    const end = new Date(windowResult.end).toLocaleTimeString([], { hour: 'numeric', timeZone: opts.timezone });
    best.textContent = `Best window: ${start} – ${end} (${windowResult.label})`;
  } else {
    best.textContent = 'Best window: --';
  }

  detail.textContent = 'Tap an hour for the why and watch wind + precip to stay safe.';
}
