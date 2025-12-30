export type RatingLabel = 'Good' | 'Risky' | 'Bad';

export interface Thresholds {
  windGood: number;
  windRisky: number;
  gustGood: number;
  gustRisky: number;
  precipRiskyProbability: number;
  visibilityRisky: number;
  visibilityBad: number;
  tempRiskyF: number;
  tempBadF: number;
}

export interface HourlyWeather {
  time: string; // ISO string
  temperatureF: number;
  temperatureC: number;
  windSpeedMph: number;
  windSpeedKph: number;
  windGustMph: number;
  windGustKph: number;
  precipitationProbability: number;
  precipitationMm: number;
  precipitationType?: string;
  visibilityMiles?: number;
  visibilityKm?: number;
  cloudCover?: number;
  thunder?: boolean;
}

export interface HourlyRatingResult {
  label: RatingLabel;
  reasons: string[];
  warnings: string[];
}

export interface HourWithRating extends HourlyWeather {
  rating: HourlyRatingResult;
}

export interface BestWindow {
  start: string;
  end: string;
  label: RatingLabel;
}
