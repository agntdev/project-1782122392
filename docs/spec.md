## Summary
A Telegram bot that lets users search and view free satellite imagery (Sentinel-2 and Landsat) by place name and date range, producing on-the-fly composites (cloud-filtered/median) and common indices (true color, NDVI, false color). The bot returns preview images in chat and stores generated composites for reuse.

## Audience
End users who want quick visual satellite imagery for cities/places (researchers, journalists, land managers, curious public) — non-technical users interacting via Telegram in Russian.

## Core entities
- User: Telegram user id, language, preferences (default visualization, last place).
- Place: geocoded point (lat/lon) and bounding box (auto buffer by zoom/scale), place name.
- Query: user request containing place, date range, sensor preference (Sentinel/Landsat/auto), composite method, visualization (true color/NDVI/false color), cloud threshold.
- Scene/Granule: metadata for candidate scenes (acquisition date, cloud cover, S3 path or URL).
- Composite/ImageAsset: generated raster (preview JPEG, optional full GeoTIFF), processing parameters, cache key & TTL.
- CacheEntry: maps Query -> ImageAsset with expiry.

## Integrations & notification targets
- Geocoding: Nominatim (OpenStreetMap) as default geocoder to turn place names into coordinates.
- Satellite data: AWS Open Data Registry public buckets for Sentinel-2 and Landsat (read-only) as primary raw data source.
- Cloud masking: s2cloudless (for Sentinel-2) and fmasks/QA bands for Landsat; fallback to scene metadata cloud_cover filtering.
- Raster processing: server-side stack using rasterio/xarray/numpy (or rio-tiler style pipeline) to download tiles, mask clouds, compute composites and indices.
- Storage/cache: S3-compatible object storage for generated images and tiles cache (or local disk for initial dev), with signed URLs for downloads.
- Notifications: results posted to requesting Telegram chat; optional admin error notifications to a configured admin chat id.

## Interaction flows (Telegram UX, Russian)
- /start — brief help and examples.
- /search — starts guided flow: ask for place name (text). After geocoding, show 3 best matches as buttons.
- After place selection: show quick date-range buttons (Last month, Last year, Custom range). For Custom, request start and end dates (YYYY-MM-DD).
- Next show composite/visualization options as inline buttons: Composite type: [Median composite, Most recent, Custom (first)]; Visualization: [True color (RGB), False color (NIR/Red/Green), NDVI]. Also a cloud-cover slider choices as buttons: [Auto (20%), 10%, 20%, 40%].
- User taps Confirm -> bot queues processing and sends a "processing" message + progress updates if long. When ready, bot sends preview JPEG (max 1024 px) with metadata (dates used, sensor, cloud cover) and buttons: [Download full-res GeoTIFF (link), New search].
- Errors and no-data scenarios return friendly Russian messages and suggestions (widen date range, lower cloud threshold, try Landsat/Sentinel toggle).

## Persistence
- Persist users (id, language, prefs) and recent queries in a small DB (Postgres or SQLite for prototype).
- Cache generated ImageAssets in S3 (or local storage) with metadata in DB and 30-day TTL; cache keys include place bounding box, date range, sensor, composite settings.
- Cache geocoding results for popular place names (TTL 7 days) to reduce calls to Nominatim.

## Payments
- None. All sources are free; no paid features in scope.

## Non-goals
- No real-time satellite tasking (ordering new captures) or integration with commercial providers (SentinelHub paid) by default.
- Not a GIS desktop replacement — output is for quick visual inspection, not high-precision mapping analysis (though full GeoTIFF is available for download).
- No heavy multi-user project collaboration or access-control beyond Telegram chat rights.

## Assumptions & defaults
- Default geocoder: Nominatim (OpenStreetMap). Rationale: free, no API key required for initial build.
- Default data source: AWS Open Data for Sentinel-2 and Landsat. Rationale: free public access and broad coverage.
- Default composite method: median composite across selected date range. Rationale: robust cloud reduction for most user cases.
- Default cloud threshold: 20% (auto). Rationale: balance between data availability and cloud-free results.
- Default visualizations: True color (RGB), plus NDVI and false color options. Rationale: covers the common user needs without complicating UI.
- Preview output: JPEG max dimension 1024 px; full-resolution GeoTIFF available via signed S3 link. Rationale: fast delivery in chat and optional high-res download.
- Processing stack: server-side raster processing (rasterio, s2cloudless, numpy) rather than GEE. Rationale: avoids GEE account dependency and keeps all processing under our control.
- Storage: S3-compatible storage for generated composites and cached tiles (local disk for prototype). Rationale: scalable and easy to serve signed links.


Deliverable: implementation-ready brief describing commands, data flows, integrations, persistence and defaults; use this as the build specification.