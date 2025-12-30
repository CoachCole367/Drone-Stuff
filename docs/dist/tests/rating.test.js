import { rateHour, bestWindow } from '../src/rating.js';
function buildHour(overrides) {
    return {
        time: overrides.time,
        temperatureC: overrides.temperatureC ?? 15,
        temperatureF: overrides.temperatureF ?? 59,
        windSpeedKph: overrides.windSpeedKph ?? 10,
        windSpeedMph: overrides.windSpeedMph ?? 6,
        windGustKph: overrides.windGustKph ?? 15,
        windGustMph: overrides.windGustMph ?? 9,
        precipitationProbability: overrides.precipitationProbability ?? 10,
        precipitationMm: overrides.precipitationMm ?? 0,
        precipitationType: overrides.precipitationType,
        visibilityKm: overrides.visibilityKm ?? 10,
        visibilityMiles: overrides.visibilityMiles ?? 6,
        cloudCover: overrides.cloudCover ?? 20,
        thunder: overrides.thunder ?? false,
    };
}
function assert(label, cond) {
    if (!cond)
        throw new Error(`Assertion failed: ${label}`);
}
const baseTime = '2025-01-01T12:00:00Z';
const goodHour = buildHour({ time: baseTime });
const riskyWind = buildHour({ time: baseTime, windSpeedMph: 15, windGustMph: 20 });
const badGust = buildHour({ time: baseTime, windGustMph: 30 });
const thunder = buildHour({ time: baseTime, thunder: true });
const cold = buildHour({ time: baseTime, temperatureF: 5 });
const precipChance = buildHour({ time: baseTime, precipitationProbability: 60 });
const lowVis = buildHour({ time: baseTime, visibilityMiles: 2 });
const resultGood = rateHour(goodHour);
assert('Good hour label', resultGood.label === 'Good');
const resultRisky = rateHour(riskyWind);
assert('Risky wind', resultRisky.label === 'Risky');
const resultBadGust = rateHour(badGust);
assert('Bad gust', resultBadGust.label === 'Bad');
const resultThunder = rateHour(thunder);
assert('Thunder bad', resultThunder.label === 'Bad');
const resultCold = rateHour(cold);
assert('Cold risky/bad', resultCold.label !== 'Good');
const resultPrecip = rateHour(precipChance);
assert('Precip risky', resultPrecip.label === 'Risky');
const resultVis = rateHour(lowVis);
assert('Low visibility bad', resultVis.label === 'Bad');
const hours = [goodHour, riskyWind, badGust].map((h, idx) => ({ ...h, time: `2025-01-01T0${idx}:00:00Z` }));
const window = bestWindow(hours).window;
assert('Best window exists', !!window);
console.log('All rating tests passed');
