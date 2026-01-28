# ChronoCompass

**ChronoCompass** is an experimental visual time instrument that treats time as a set of directional cycles rather than a linear stream.

<p align="center">
  <img src="docs/screens/screenshoot.png" alt="ChronoCompass — visual time compass" width="900">
</p>

It combines astronomical and symbolic time models with a compass-like interface: days, lunar phases, years, and long cycles are represented as rotating wheels aligned to cardinal directions (E, N, W, S). The result is a tool for exploring *where* you are in time, not just *when*.

## ✨ Key ideas

- Time as **cycles**, not a timeline
- Orientation through **directions** (East / North / West / South)
- Multiple layers of time running simultaneously
- Clear distinction between **PAST**, **FUTURE**, and **LIVE (now)**
- Minimal UI, high semantic density

## 🧭 What it does

- Visualizes several time cycles:
    - Day cycle
    - Moon cycle
    - Year cycle
    - Extended / symbolic cycles
- Allows manual navigation through time
- Supports LIVE mode (auto-following the present moment)
- Lets you jump to past or future moments instantly
- Reacts to geographic location (latitude / longitude)

## 🛠 Tech stack

- **Svelte**
- **TypeScript**
- Native browser `datetime-local` controls (no heavy date libraries)
- Custom state stores for time and location
- CSS variables for theming (light / dark)

## 🎯 Status

This is a **research / exploration project**.
APIs, visuals, and internal logic may change freely.

ChronoCompass is designed as a foundation for:
- alternative time interfaces
- creative tools
- games
- worldbuilding systems
- experimental calendars

## 📜 License

MIT — use it, fork it, remix it, break it, rebuild it.  
Attribution appreciated but not required.

---

If you’re interested in time as a navigable space rather than a ticking counter — welcome.