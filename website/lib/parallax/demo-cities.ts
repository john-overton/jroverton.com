export interface DemoCity {
  name: string;
  state: string;
  centerLat: number;
  centerLon: number;
}

/**
 * 15 US cities (population 100k+) with diverse geographic regions.
 * Center coordinates are approximate downtown / city center points.
 */
export const DEMO_CITIES: DemoCity[] = [
  { name: 'Columbus', state: 'OH', centerLat: 39.9612, centerLon: -82.9988 },
  { name: 'Charlotte', state: 'NC', centerLat: 35.2271, centerLon: -80.8431 },
  { name: 'Tucson', state: 'AZ', centerLat: 32.2226, centerLon: -110.9747 },
  { name: 'Richmond', state: 'VA', centerLat: 37.5407, centerLon: -77.4360 },
  { name: 'Boise', state: 'ID', centerLat: 43.6150, centerLon: -116.2023 },
  { name: 'Albuquerque', state: 'NM', centerLat: 35.0844, centerLon: -106.6504 },
  { name: 'Omaha', state: 'NE', centerLat: 41.2565, centerLon: -95.9345 },
  { name: 'Knoxville', state: 'TN', centerLat: 35.9606, centerLon: -83.9207 },
  { name: 'Spokane', state: 'WA', centerLat: 47.6588, centerLon: -117.4260 },
  { name: 'Des Moines', state: 'IA', centerLat: 41.5868, centerLon: -93.6250 },
  { name: 'Reno', state: 'NV', centerLat: 39.5296, centerLon: -119.8138 },
  { name: 'Chattanooga', state: 'TN', centerLat: 35.0456, centerLon: -85.3097 },
  { name: 'Fort Wayne', state: 'IN', centerLat: 41.0793, centerLon: -85.1394 },
  { name: 'Shreveport', state: 'LA', centerLat: 32.5252, centerLon: -93.7502 },
  { name: 'Tallahassee', state: 'FL', centerLat: 30.4383, centerLon: -84.2807 },
];
