export const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";

export interface NominatimResult {
  place_id: number;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

export function truncate(name: string, max: number): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 3) + "...";
}

export async function fetchGeocode(place: string): Promise<NominatimResult[]> {
  const url = new URL(NOMINATIM_BASE);
  url.searchParams.set("q", place);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "3");
  url.searchParams.set("addressdetails", "0");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "AGNTDEV-Bot/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed: Nominatim returned status ${response.status}.`);
  }

  return (await response.json()) as NominatimResult[];
}

export function buildButtons(results: NominatimResult[]): { text: string; data: string }[] {
  return results.slice(0, 3).map((r) => ({
    text: truncate(r.display_name, 50),
    data: `geocode:${r.lat}:${r.lon}`,
  }));
}