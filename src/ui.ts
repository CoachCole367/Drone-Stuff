import { bestWindow, rateHour, ruleDescriptions } from './rating.js';
import { CalendarFilter, HourlyWeather, RatingLabel, HourWithRating } from './types.js';

export interface UIOptions {
  windUnit: 'mph' | 'kph';
  tempUnit: 'f' | 'c';
  timezone: string;
  calendarFilter: CalendarFilter;
}

export function renderRules() {
  const rules = ruleDescriptions();
  const container = document.getElementById('rule-list');
  const note = document.getElementById('rule-note');
  if (!container) return;
  container.innerHTML = '';
  rules.forEach((r) => {
    const div = document.createElement('div');
    div.className = 'rule-card';
    div.innerHTML = `<strong>${r.title}</strong><div class="muted">${r.detail}</div>`;
    container.appendChild(div);
  });

  if (note) {
    note.textContent =
      'These limits are intentionally conservative for typical recreational drones. Tune thresholds in src/config.ts to match your aircraft and comfort level.';
  }
}

export function renderForecast(hours: HourlyWeather[], opts: UIOptions) {
  const target = document.getElementById('forecast');
  if (!target) return;
  target.innerHTML = '';
  const rated: HourWithRating[] = hours.map((h) => ({ ...h, rating: rateHour(h) }));
  const windowResult = bestWindow(hours);
  updateStatus(rated, windowResult.window, opts);
  renderCalendar(rated, opts);

  rated.forEach((hour) => {
    const card = document.createElement('article');
    card.className = 'card';
    const time = new Date(hour.time);
    const timeLabel = time.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: opts.timezone,
    });
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
    const start = new Date(windowResult.start).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      timeZone: opts.timezone,
    });
    const end = new Date(windowResult.end).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      timeZone: opts.timezone,
    });
    best.textContent = `Best window: ${start} – ${end} (${windowResult.label})`;
  } else {
    best.textContent = 'Best window: --';
  }

  detail.textContent = 'Tap an hour for the why and watch wind + precip to stay safe.';
}

function renderCalendar(hours: HourWithRating[], opts: UIOptions) {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;

  const summaries = summarizeByDay(hours, opts.timezone, opts.windUnit);
  const filtered = opts.calendarFilter === 'all' ? summaries : summaries.filter((s) => s.label === opts.calendarFilter);
  grid.innerHTML = '';

  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No days match that filter yet.';
    grid.appendChild(empty);
    return;
  }

  filtered.forEach((day) => {
    const card = document.createElement('article');
    card.className = 'day-card';
    const dateLabel = new Date(day.displayDate).toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: opts.timezone,
    });

    const risks = day.reasons.length ? day.reasons.slice(0, 3).join('; ') : 'No notable risks';
    const precip = `${day.maxPrecip}% chance`;

    card.innerHTML = `
      <div class="day-heading">
        <div>
          <div class="muted">${dateLabel}</div>
          <div class="day-title">${day.dayName}</div>
        </div>
        <span class="badge ${day.label.toLowerCase()}">${day.label}</span>
      </div>
      <div class="metrics">
        <span class="metric">Max wind ${day.maxWind}</span>
        <span class="metric">Max gust ${day.maxGust}</span>
        <span class="metric">Precip ${precip}</span>
      </div>
      <div class="muted">${risks}</div>
    `;

    grid.appendChild(card);
  });
}

function summarizeByDay(hours: HourWithRating[], tz: string, windUnit: 'mph' | 'kph') {
  const dayMap = new Map<string, HourWithRating[]>();
  hours.forEach((h) => {
    const key = toDateKey(h.time, tz);
    const current = dayMap.get(key) ?? [];
    current.push(h);
    dayMap.set(key, current);
  });

  return Array.from(dayMap.entries()).map(([dateKey, list]) => {
    const label = worstLabel(list.map((h) => h.rating.label));
    const reasons = Array.from(new Set(list.filter((h) => h.rating.label === label).flatMap((h) => h.rating.reasons)));
    const maxWindVal = Math.max(...list.map((h) => (windUnit === 'mph' ? h.windSpeedMph : h.windSpeedKph)));
    const maxGustVal = Math.max(...list.map((h) => (windUnit === 'mph' ? h.windGustMph : h.windGustKph)));
    const maxPrecip = Math.max(...list.map((h) => h.precipitationProbability));
    const anchorDate = list[0]?.time ?? `${dateKey}T12:00:00`;

    return {
      dateKey,
      dayName: new Date(anchorDate).toLocaleDateString([], { weekday: 'long', timeZone: tz }),
      displayDate: anchorDate,
      label,
      reasons,
      maxWind: `${maxWindVal.toFixed(0)} ${windUnit}`,
      maxGust: `${maxGustVal.toFixed(0)} ${windUnit}`,
      maxPrecip,
    };
  });
}

function worstLabel(labels: RatingLabel[]): RatingLabel {
  if (labels.includes('Bad')) return 'Bad';
  if (labels.includes('Risky')) return 'Risky';
  return 'Good';
}

function toDateKey(dateStr: string, tz: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: tz });
}
