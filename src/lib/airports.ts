// Major airports, curated by hand: the busiest, and each region's main hub, one per
// city. A trip's code is its destination's nearest one; the Live board follows them
// too. name is short enough for a card at 390px. Positions to 3 decimals (about 100 m).

export type Airport = { code: string; name: string; latitude: number; longitude: number };

export const AIRPORTS: Airport[] = [
  // Europe
  { code: "LHR", name: "London Heathrow", latitude: 51.47, longitude: -0.454 },
  { code: "MAN", name: "Manchester", latitude: 53.354, longitude: -2.275 },
  { code: "EDI", name: "Edinburgh", latitude: 55.95, longitude: -3.373 },
  { code: "DUB", name: "Dublin", latitude: 53.421, longitude: -6.27 },
  { code: "CDG", name: "Paris–Charles de Gaulle", latitude: 49.01, longitude: 2.548 },
  { code: "NCE", name: "Nice Côte d’Azur", latitude: 43.658, longitude: 7.216 },
  { code: "LYS", name: "Lyon–Saint-Exupéry", latitude: 45.726, longitude: 5.091 },
  { code: "AMS", name: "Amsterdam Schiphol", latitude: 52.31, longitude: 4.768 },
  { code: "BRU", name: "Brussels", latitude: 50.901, longitude: 4.484 },
  { code: "FRA", name: "Frankfurt", latitude: 50.034, longitude: 8.562 },
  { code: "MUC", name: "Munich", latitude: 48.354, longitude: 11.786 },
  { code: "BER", name: "Berlin Brandenburg", latitude: 52.362, longitude: 13.501 },
  { code: "HAM", name: "Hamburg", latitude: 53.63, longitude: 9.988 },
  { code: "DUS", name: "Düsseldorf", latitude: 51.289, longitude: 6.767 },
  { code: "ZRH", name: "Zurich", latitude: 47.458, longitude: 8.555 },
  { code: "GVA", name: "Geneva", latitude: 46.238, longitude: 6.109 },
  { code: "VIE", name: "Vienna", latitude: 48.11, longitude: 16.57 },
  { code: "MAD", name: "Madrid–Barajas", latitude: 40.472, longitude: -3.561 },
  { code: "BCN", name: "Barcelona–El Prat", latitude: 41.297, longitude: 2.078 },
  { code: "AGP", name: "Málaga", latitude: 36.675, longitude: -4.499 },
  { code: "SVQ", name: "Seville", latitude: 37.418, longitude: -5.893 },
  { code: "VLC", name: "Valencia", latitude: 39.489, longitude: -0.482 },
  { code: "PMI", name: "Palma de Mallorca", latitude: 39.552, longitude: 2.739 },
  { code: "LPA", name: "Gran Canaria", latitude: 27.932, longitude: -15.387 },
  { code: "TFS", name: "Tenerife South", latitude: 28.044, longitude: -16.572 },
  { code: "LIS", name: "Lisbon", latitude: 38.774, longitude: -9.134 },
  { code: "OPO", name: "Porto", latitude: 41.248, longitude: -8.681 },
  { code: "FCO", name: "Rome Fiumicino", latitude: 41.8, longitude: 12.239 },
  { code: "MXP", name: "Milan Malpensa", latitude: 45.63, longitude: 8.723 },
  { code: "VCE", name: "Venice Marco Polo", latitude: 45.505, longitude: 12.352 },
  { code: "NAP", name: "Naples", latitude: 40.886, longitude: 14.291 },
  { code: "ATH", name: "Athens", latitude: 37.936, longitude: 23.947 },
  { code: "IST", name: "Istanbul", latitude: 41.262, longitude: 28.742 },
  { code: "CPH", name: "Copenhagen", latitude: 55.618, longitude: 12.656 },
  { code: "ARN", name: "Stockholm Arlanda", latitude: 59.65, longitude: 17.919 },
  { code: "OSL", name: "Oslo", latitude: 60.194, longitude: 11.1 },
  { code: "HEL", name: "Helsinki", latitude: 60.317, longitude: 24.963 },
  { code: "KEF", name: "Reykjavík–Keflavík", latitude: 63.985, longitude: -22.606 },
  { code: "WAW", name: "Warsaw Chopin", latitude: 52.166, longitude: 20.967 },
  { code: "PRG", name: "Prague", latitude: 50.101, longitude: 14.26 },
  { code: "BUD", name: "Budapest", latitude: 47.437, longitude: 19.256 },
  { code: "OTP", name: "Bucharest", latitude: 44.571, longitude: 26.085 },
  // Middle East and Africa
  { code: "DXB", name: "Dubai", latitude: 25.253, longitude: 55.364 },
  { code: "DOH", name: "Doha Hamad", latitude: 25.273, longitude: 51.608 },
  { code: "TLV", name: "Tel Aviv Ben Gurion", latitude: 32.011, longitude: 34.887 },
  { code: "AMM", name: "Amman", latitude: 31.723, longitude: 35.993 },
  { code: "RUH", name: "Riyadh", latitude: 24.958, longitude: 46.699 },
  { code: "CAI", name: "Cairo", latitude: 30.122, longitude: 31.406 },
  { code: "CMN", name: "Casablanca", latitude: 33.367, longitude: -7.59 },
  { code: "RAK", name: "Marrakesh", latitude: 31.607, longitude: -8.036 },
  { code: "TUN", name: "Tunis–Carthage", latitude: 36.851, longitude: 10.227 },
  { code: "LOS", name: "Lagos", latitude: 6.577, longitude: 3.321 },
  { code: "ACC", name: "Accra", latitude: 5.605, longitude: -0.167 },
  { code: "ADD", name: "Addis Ababa", latitude: 8.978, longitude: 38.799 },
  { code: "NBO", name: "Nairobi", latitude: -1.319, longitude: 36.928 },
  { code: "JNB", name: "Johannesburg", latitude: -26.134, longitude: 28.242 },
  { code: "CPT", name: "Cape Town", latitude: -33.965, longitude: 18.602 },
  { code: "MRU", name: "Mauritius", latitude: -20.43, longitude: 57.683 },
  // Asia
  { code: "HND", name: "Tokyo Haneda", latitude: 35.552, longitude: 139.78 },
  { code: "KIX", name: "Osaka Kansai", latitude: 34.427, longitude: 135.244 },
  { code: "ICN", name: "Seoul Incheon", latitude: 37.46, longitude: 126.441 },
  { code: "PEK", name: "Beijing Capital", latitude: 40.08, longitude: 116.585 },
  { code: "PVG", name: "Shanghai Pudong", latitude: 31.143, longitude: 121.805 },
  { code: "CAN", name: "Guangzhou", latitude: 23.392, longitude: 113.299 },
  { code: "HKG", name: "Hong Kong", latitude: 22.308, longitude: 113.918 },
  { code: "TPE", name: "Taipei Taoyuan", latitude: 25.08, longitude: 121.233 },
  { code: "MNL", name: "Manila", latitude: 14.509, longitude: 121.02 },
  { code: "SIN", name: "Singapore Changi", latitude: 1.364, longitude: 103.991 },
  { code: "KUL", name: "Kuala Lumpur", latitude: 2.746, longitude: 101.71 },
  { code: "BKK", name: "Bangkok Suvarnabhumi", latitude: 13.69, longitude: 100.75 },
  { code: "HKT", name: "Phuket", latitude: 8.113, longitude: 98.317 },
  { code: "SGN", name: "Ho Chi Minh City", latitude: 10.819, longitude: 106.652 },
  { code: "HAN", name: "Hanoi", latitude: 21.221, longitude: 105.807 },
  { code: "CGK", name: "Jakarta", latitude: -6.126, longitude: 106.656 },
  { code: "DPS", name: "Bali", latitude: -8.748, longitude: 115.167 },
  { code: "DEL", name: "Delhi", latitude: 28.556, longitude: 77.1 },
  { code: "BOM", name: "Mumbai", latitude: 19.089, longitude: 72.868 },
  { code: "BLR", name: "Bengaluru", latitude: 13.199, longitude: 77.706 },
  { code: "MAA", name: "Chennai", latitude: 12.99, longitude: 80.169 },
  { code: "CCU", name: "Kolkata", latitude: 22.655, longitude: 88.447 },
  { code: "CMB", name: "Colombo", latitude: 7.181, longitude: 79.884 },
  { code: "MLE", name: "Malé", latitude: 4.192, longitude: 73.529 },
  { code: "KTM", name: "Kathmandu", latitude: 27.697, longitude: 85.359 },
  { code: "DAC", name: "Dhaka", latitude: 23.843, longitude: 90.398 },
  // Oceania and the Pacific
  { code: "SYD", name: "Sydney", latitude: -33.946, longitude: 151.177 },
  { code: "MEL", name: "Melbourne", latitude: -37.669, longitude: 144.841 },
  { code: "BNE", name: "Brisbane", latitude: -27.384, longitude: 153.117 },
  { code: "PER", name: "Perth", latitude: -31.94, longitude: 115.967 },
  { code: "AKL", name: "Auckland", latitude: -37.008, longitude: 174.792 },
  { code: "NAN", name: "Nadi", latitude: -17.755, longitude: 177.443 },
  { code: "HNL", name: "Honolulu", latitude: 21.319, longitude: -157.922 },
  // North America and the Caribbean
  { code: "JFK", name: "New York JFK", latitude: 40.64, longitude: -73.779 },
  { code: "BOS", name: "Boston Logan", latitude: 42.364, longitude: -71.005 },
  { code: "PHL", name: "Philadelphia", latitude: 39.872, longitude: -75.241 },
  { code: "IAD", name: "Washington Dulles", latitude: 38.953, longitude: -77.456 },
  { code: "ATL", name: "Atlanta", latitude: 33.637, longitude: -84.428 },
  { code: "CLT", name: "Charlotte", latitude: 35.214, longitude: -80.943 },
  { code: "MCO", name: "Orlando", latitude: 28.429, longitude: -81.309 },
  { code: "MIA", name: "Miami", latitude: 25.795, longitude: -80.287 },
  { code: "ORD", name: "Chicago O’Hare", latitude: 41.974, longitude: -87.907 },
  { code: "DTW", name: "Detroit", latitude: 42.212, longitude: -83.353 },
  { code: "MSP", name: "Minneapolis–St Paul", latitude: 44.885, longitude: -93.222 },
  { code: "BNA", name: "Nashville", latitude: 36.124, longitude: -86.678 },
  { code: "MSY", name: "New Orleans", latitude: 29.993, longitude: -90.258 },
  { code: "DFW", name: "Dallas/Fort Worth", latitude: 32.897, longitude: -97.038 },
  { code: "IAH", name: "Houston", latitude: 29.984, longitude: -95.341 },
  { code: "DEN", name: "Denver", latitude: 39.856, longitude: -104.674 },
  { code: "PHX", name: "Phoenix", latitude: 33.437, longitude: -112.008 },
  { code: "LAS", name: "Las Vegas", latitude: 36.084, longitude: -115.154 },
  { code: "SLC", name: "Salt Lake City", latitude: 40.79, longitude: -111.978 },
  { code: "LAX", name: "Los Angeles", latitude: 33.942, longitude: -118.408 },
  { code: "SAN", name: "San Diego", latitude: 32.733, longitude: -117.19 },
  { code: "SFO", name: "San Francisco", latitude: 37.619, longitude: -122.375 },
  { code: "SEA", name: "Seattle–Tacoma", latitude: 47.45, longitude: -122.309 },
  { code: "ANC", name: "Anchorage", latitude: 61.174, longitude: -149.996 },
  { code: "YYZ", name: "Toronto Pearson", latitude: 43.677, longitude: -79.625 },
  { code: "YUL", name: "Montréal–Trudeau", latitude: 45.47, longitude: -73.741 },
  { code: "YVR", name: "Vancouver", latitude: 49.195, longitude: -123.184 },
  { code: "YYC", name: "Calgary", latitude: 51.131, longitude: -114.011 },
  { code: "MEX", name: "Mexico City", latitude: 19.436, longitude: -99.072 },
  { code: "CUN", name: "Cancún", latitude: 21.037, longitude: -86.877 },
  { code: "PTY", name: "Panama City Tocumen", latitude: 9.071, longitude: -79.383 },
  { code: "SJO", name: "San José, Costa Rica", latitude: 9.994, longitude: -84.209 },
  { code: "HAV", name: "Havana", latitude: 22.989, longitude: -82.409 },
  { code: "SJU", name: "San Juan", latitude: 18.439, longitude: -66.002 },
  { code: "PUJ", name: "Punta Cana", latitude: 18.567, longitude: -68.363 },
  // South America
  { code: "BOG", name: "Bogotá", latitude: 4.702, longitude: -74.147 },
  { code: "MDE", name: "Medellín", latitude: 6.165, longitude: -75.423 },
  { code: "UIO", name: "Quito", latitude: -0.129, longitude: -78.358 },
  { code: "LIM", name: "Lima", latitude: -12.022, longitude: -77.114 },
  { code: "CUZ", name: "Cusco", latitude: -13.536, longitude: -71.939 },
  { code: "GRU", name: "São Paulo–Guarulhos", latitude: -23.435, longitude: -46.473 },
  { code: "GIG", name: "Rio de Janeiro–Galeão", latitude: -22.81, longitude: -43.251 },
  { code: "EZE", name: "Buenos Aires–Ezeiza", latitude: -34.822, longitude: -58.536 },
  { code: "SCL", name: "Santiago", latitude: -33.393, longitude: -70.786 },
  { code: "MVD", name: "Montevideo", latitude: -34.838, longitude: -56.031 },
];

// Further than this from every airport on the list, a trip shows no code.
const MAX_KM = 150;

// Great-circle distance in km (the haversine formula).
function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// The closest airport on the list within 150 km, or null (none, or no destination).
export function nearestAirport(place: { latitude: number; longitude: number } | null): Airport | null {
  if (!place) return null;
  let best: Airport | null = null;
  let bestKm = MAX_KM;
  for (const airport of AIRPORTS) {
    const km = distanceKm(place, airport);
    if (km <= bestKm) {
      best = airport;
      bestKm = km;
    }
  }
  return best;
}
