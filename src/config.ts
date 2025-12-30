import { Thresholds } from './types.js';

export const thresholds: Thresholds = {
  windGood: 12,
  windRisky: 18,
  gustGood: 18,
  gustRisky: 25,
  precipRiskyProbability: 40,
  visibilityRisky: 5,
  visibilityBad: 3,
  tempRiskyF: 14,
  tempBadF: 0,
};

export const cacheDurationMs = 10 * 60 * 1000;
