# Datasets Architecture

This document describes the **dataset-based computation architecture** used in Chrono Compass.

The core idea is simple:

> **All heavy astronomical computation is done ahead of time.**
> The browser never computes real ephemerides. It only *renders* precomputed cycles.

This keeps the application:

* fully static,
* offline-capable (PWA),
* lightweight (no backend, no runtime engines),
* predictable and debuggable.

---

## High-level concept

Each Wheel type (Compass, Horizon, Synod, Range, etc.) has its own computation algorithm **outside the browser**.

The result of such computation is a **dataset**:

* consisting of multiple *cycles*,
* each cycle represented by **16 spokes**,
* each spoke corresponding to a specific event or reference moment of that cycle.

At runtime, the browser:

* selects the correct dataset chunk by timestamp,
* selects the correct cycle inside that dataset,
* interpolates *only between spokes* for visualization.

No astronomical math happens in the client.

---

## Wheels not covered by datasets

Dataset-based computation is intentionally not used for Compass Wheels and Horizon Wheels, because they depend on a continuous observer location space (latitude/longitude) and represent local projections rather than global cycles.

These Wheels are computed algorithmically at runtime and may later benefit from precomputed auxiliary data, but not from full cycle datasets.

---

## Why 16 spokes

Chrono Compass uses a fixed **16-spoke structure** for all Wheels.

This provides:

* a uniform visual grammar across all Wheel types,
* predictable navigation (E+, E−, houses, spokes),
* strong data compression compared to continuous time series.

The 17th spoke (E+) is **not stored**.
It is implicitly the first spoke of the next cycle.

---

## Dataset granularity

Datasets are not split by calendar years, but by **groups of full cycles**.

However, **each dataset chunk is still marked by exact time boundaries**, because:

* cycles may be asymmetric,
* cycle lengths may vary over time,
* dataset selection always starts from an absolute timestamp.

Therefore:

* chunks are selected by time (`startTs ≤ t < endTs`),
* cycles are only an internal structure of a chunk.

---

## Dataset file location

All datasets live in the static public folder:

```
public/datasets/{wheelType}/{tupleId}/{chunkId}.json
```

Examples:

```
public/datasets/synod/earth_sun_moon/1800-1810.json
public/datasets/range/earth_mars/1900-1950.json
```

These files are served as static assets and fetched on demand.

---

## Dataset structure (minimal skeleton)

Each dataset file is a plain JSON object with the following required structure:

```ts
{
  type: string,          // wheel type (debug / validation)
  tuple: string[],       // ordered body tuple (debug / validation)

  startTs: number,       // equals cycles[0].spokes[0].ts
  endTs: number,         // virtual spoke 16 of the last cycle

  default: boolean,      // whether this dataset should be loaded eagerly

  cycles: [
    {
      spokes: [
        { ts: number, meta?: object }, // 16 entries
        ...
      ]
    },
    ...
  ]
}
```

### Notes

* `startTs` **must equal** the timestamp of the first spoke of the first cycle.
* `endTs` **must be strictly greater** than the timestamp of the last spoke of the last cycle.
* Each cycle must contain **exactly 16 spokes**.
* Spoke timestamps inside a cycle must be strictly increasing.
* `meta` is wheel-specific and opaque to the dataset loader.

---

## Per-spoke metadata

Each spoke may optionally contain metadata relevant to its Wheel type.

Examples:

* Compass: azimuth, altitude, visibility flags
* Horizon: altitude, rise/set flags
* Synod / Channel: angular separation
* Bind / Range: distance
* Season / Plato: axis orientation parameters
* Nodal: node longitude or plane orientation

The browser does **not interpret** this metadata.
It is passed directly to the rendering logic of the corresponding Wheel.

---

## Dataset Manifest

To avoid manual bookkeeping, Chrono Compass uses an **automatically generated dataset manifest**.

This manifest is created at build time by scanning the dataset folder.

Location:

```
public/datasets/manifest.json
```

---

## Manifest responsibilities

The manifest:

* lists all available dataset chunks,
* validates dataset consistency at build time,
* enables lazy loading by timestamp,
* allows eager loading of default datasets.

Developers **never edit the manifest manually**.
They only add or update dataset files.

---

## Manifest structure (simplified)

```ts
{
  version: number,
  generatedAt: string,

  // Precomputed list of dataset chunks that should be loaded eagerly.
  // Each item points to a chunk already described in `datasets` below.
  defaults: [
    {
      wheelType: string,
      tupleId: string,
      chunkId: string,
      url: string,
      startTs: number,
      endTs: number
    }
  ],

  datasets: {
    [wheelType: string]: {
      [tupleId: string]: [
        {
          id: string,          // chunk id (e.g. "1800-1810")
          url: string,         // public URL to dataset file
          startTs: number,
          endTs: number,
          default: boolean     // eager-load marker
        }
      ]
    }
  }
}
```

Chunks inside each `(wheelType, tupleId)` group are ordered by time.

The `defaults` array is a convenience index generated at build time so the browser can eager-load default datasets without scanning the entire manifest.

---

## Default vs lazy datasets

Each dataset chunk declares a `default` flag.

* `default: true`

    * loaded eagerly on application start,
    * used for core / common Wheels,
    * guarantees immediate usability.

* `default: false`

    * loaded lazily on demand,
    * fetched only when required by the selected timestamp,
    * cached for offline reuse.

This allows Chrono Compass to remain fast on first load while still supporting large historical ranges.

---

## Runtime behavior (browser side)

At runtime, the application:

1. Loads `manifest.json`.
2. Eagerly loads all dataset chunks listed in `manifest.defaults`.
3. On user interaction:

    * determines `(wheelType, tupleId, selectedTs)`
    * selects the matching chunk by time
    * fetches it if not already cached
4. Renders the Wheel using only spoke interpolation.

If the user is offline and required data is missing:

* the UI reports that additional data is required,
* the request is queued,
* data is fetched automatically once connectivity returns.

---

## Dataset caching and cache invalidation

Datasets are treated as **immutable artifacts**.

Any change to a dataset produces a **new versioned URL** (by version suffix or content hash).
The browser cache is therefore keyed strictly by dataset URL.

### Cache strategy

* All dataset files are cached under a dedicated cache namespace (e.g. `cc-datasets`).
* A dataset is cached the first time it is successfully fetched.
* Cached datasets are reused across sessions and offline mode.

### Manifest updates

When a new `manifest.json` is loaded:

* The application compares the new manifest version with the previously loaded one.
* A version change indicates that dataset availability may have changed.

**Important:**
A manifest version change **does not trigger re-download of all datasets**.
Only datasets whose URLs have changed will be fetched again.

### Cache garbage collection

To prevent unbounded cache growth, the application performs **best-effort cache garbage collection** after a manifest update.

Garbage collection procedure:

1. Collect the set of all dataset URLs referenced in the current manifest
   (including both `defaults` and non-default chunks).
2. Iterate over all cached dataset entries.
3. Remove any cached entry whose URL is **not present** in the current manifest.

This removes outdated dataset versions that are no longer reachable.

### Safety rules

* Cache garbage collection must never remove datasets currently in use by the UI.
* Garbage collection is allowed to be deferred (e.g. run on idle or next app start).
* Failure to clean up cache must never break functionality.

---

## Architectural benefits

This architecture provides:

* **Zero astronomical computation in the browser**
* **Strict separation of physics and UI**
* **Deterministic and debuggable Wheels**
* **Offline-first behavior**
* **Minimal hosting costs** (pure static assets)

Most importantly:

> The browser becomes a *navigation instrument*, not a simulator.

---

## Future extensions

The dataset system is intentionally extensible:

* datasets may later use binary formats for size efficiency,
* multiple dataset versions may coexist,
* higher-resolution datasets may replace coarse ones transparently,
* external generators (Skyfield, SPICE) may be introduced without touching the frontend.

All such changes remain **build-time only** and do not alter the runtime architecture.
