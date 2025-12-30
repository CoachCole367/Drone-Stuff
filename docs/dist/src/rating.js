import { thresholds } from './config.js';
export function rateHour(hour) {
    const reasons = [];
    const warnings = [];
    let label = 'Good';
    const windBad = hour.windSpeedMph > thresholds.windRisky || hour.windGustMph > thresholds.gustRisky;
    const windRisky = hour.windSpeedMph >= thresholds.windGood || hour.windGustMph >= thresholds.gustGood;
    if (windBad) {
        label = 'Bad';
        reasons.push(`Gusts ${hour.windGustMph.toFixed(0)} mph or wind ${hour.windSpeedMph.toFixed(0)} mph exceed limits`);
        warnings.push('Strong winds');
    }
    else if (windRisky) {
        label = maxLabel(label, 'Risky');
        reasons.push(`Wind ${hour.windSpeedMph.toFixed(0)} mph / gusts ${hour.windGustMph.toFixed(0)} mph are elevated`);
        warnings.push('Breezy');
    }
    if (hour.thunder) {
        label = 'Bad';
        reasons.push('Thunderstorm reported in forecast');
        warnings.push('Lightning risk');
    }
    if (hour.precipitationType) {
        const lower = hour.precipitationType.toLowerCase();
        const heavy = hour.precipitationMm > 2.5;
        if (['snow', 'freezing rain', 'ice', 'hail'].some((t) => lower.includes(t)) || heavy) {
            label = 'Bad';
            reasons.push(`Bad precipitation: ${hour.precipitationType}${heavy ? ' (heavy)' : ''}`);
            warnings.push('Icing or heavy precip');
        }
        else if (['rain', 'drizzle', 'shower'].some((t) => lower.includes(t))) {
            label = maxLabel(label, 'Risky');
            reasons.push(`Wet conditions: ${hour.precipitationType}`);
            warnings.push('Moisture');
        }
    }
    if (hour.precipitationProbability >= thresholds.precipRiskyProbability) {
        label = maxLabel(label, 'Risky');
        reasons.push(`Precipitation chance ${hour.precipitationProbability}%`);
        warnings.push('Rain risk');
    }
    if (typeof hour.visibilityMiles === 'number') {
        if (hour.visibilityMiles < thresholds.visibilityBad) {
            label = 'Bad';
            reasons.push(`Visibility only ${hour.visibilityMiles.toFixed(1)} mi`);
            warnings.push('Low visibility');
        }
        else if (hour.visibilityMiles < thresholds.visibilityRisky) {
            label = maxLabel(label, 'Risky');
            reasons.push(`Visibility ${hour.visibilityMiles.toFixed(1)} mi`);
            warnings.push('Marginal visibility');
        }
    }
    if (hour.temperatureF < thresholds.tempBadF) {
        label = 'Bad';
        reasons.push(`Very cold (${hour.temperatureF.toFixed(0)}°F)`);
        warnings.push('Battery & icing risk');
    }
    else if (hour.temperatureF < thresholds.tempRiskyF) {
        label = maxLabel(label, 'Risky');
        reasons.push(`Cold (${hour.temperatureF.toFixed(0)}°F)`);
        warnings.push('Battery drain risk');
    }
    if (reasons.length === 0) {
        reasons.push('All key weather factors within conservative limits');
    }
    return { label, reasons, warnings };
}
export function bestWindow(hours) {
    const rated = hours.map((h) => ({ hour: h, rating: rateHour(h) }));
    let bestScore = Number.POSITIVE_INFINITY;
    let best;
    for (let i = 0; i < rated.length; i++) {
        for (let len = 1; len <= 3 && i + len <= rated.length; len++) {
            const slice = rated.slice(i, i + len);
            const labels = slice.map((r) => r.rating.label);
            const worstLabel = labels.includes('Bad') ? 'Bad' : labels.includes('Risky') ? 'Risky' : 'Good';
            const avgWind = slice.reduce((sum, r) => sum + r.hour.windSpeedMph + r.hour.windGustMph * 0.5, 0) / slice.length;
            const score = (worstLabel === 'Bad' ? 100 : worstLabel === 'Risky' ? 50 : 0) + avgWind;
            if (score < bestScore) {
                bestScore = score;
                best = { start: slice[0].hour.time, end: slice[slice.length - 1].hour.time, label: worstLabel };
            }
        }
    }
    return { window: best };
}
export function ruleDescriptions() {
    return [
        { title: 'Wind & gusts', detail: `Good < ${thresholds.windGood} mph wind and < ${thresholds.gustGood} mph gusts. Risky ${thresholds.windGood}–${thresholds.windRisky} mph or gusts ${thresholds.gustGood}–${thresholds.gustRisky} mph. Bad above that.` },
        { title: 'Precipitation', detail: 'Bad for thunderstorms, snow, freezing rain, heavy rain. Risky for light rain/drizzle or precip chance ≥ 40%.' },
        { title: 'Visibility', detail: 'Bad below 3 miles, risky 3–5 miles. Ignored if not provided by the API.' },
        { title: 'Temperature', detail: 'Risky below 14°F (-10°C). Bad below 0°F (-18°C) or with icing risk.' },
        { title: 'Why these numbers', detail: 'They follow conservative VLOS drone practices: avoid gusts, moisture, low visibility, and extreme cold. Adjust thresholds if your aircraft and experience support different limits.' },
        { title: 'Final label', detail: 'Any Bad trigger → Bad. Else if any Risky trigger → Risky. Otherwise Good.' },
    ];
}
function maxLabel(a, b) {
    const order = { Good: 0, Risky: 1, Bad: 2 };
    return order[a] >= order[b] ? a : b;
}
