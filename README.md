# Solmar Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/toller892/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/toller892/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the sun-soaked coastal city of **Solmar**.
You are Rico Santana, wheelman for hire. Steal cars, outrun the Solmar PD under
a five-star wanted system, and work four story jobs for the fixer Mara Voss —
on foot and behind the wheel, with traffic, pedestrians, combat, a HUD minimap
and saves. Everything in it — the city, the characters, the story, the art and
the sounds — is original. No real city, person or brand appears in it.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. The game is plain static
files under `game/` — no build step, no network requests, no libraries.

## Controls

| Key | Action |
| --- | --- |
| W / A / S / D or arrows | Move on foot / drive |
| Shift | Run |
| E | Enter, exit or steal a car (hold E to grab the package / crack the vault) |
| Mouse click | Shoot the pistol |
| F | Punch |
| R | Reload |
| Enter | Start / choose a job |
| P or Esc | Pause |
| M | Mute |

## The story

1. **Wheels for Lou** — steal any car and deliver it to Lou's Garage. ($300)
2. **The Harbor Pickup** — collect a package at the Solmar Docks and bring it
   back to Mara's Place. ($500)
3. **Heat Wave** — survive a three-star police chase for 60 seconds, then reach
   the safehouse. ($800)
4. **The Marisol Job** — crack the vault at Marisol Bank, fight the guards, and
   escape to the safehouse. ($2,500)

Between jobs, free roam is always open: cruise the city, pick up cash and
health kits, and mind the wanted stars — the heat cools off if you lie low,
but the cops never forget a body.

## Systems

- **Open city** — a 6×6 block road grid with buildings, parks, a beach and the
  docks, all generated from a seed.
- **Driving** — arcade car handling, traffic AI that follows the roads and
  brakes for the car ahead, parked cars to steal, jacking cars out of traffic.
- **Wanted system** — 0 to 5 stars; police cars chase and ram, foot cops close
  in and arrest you if you stand still. Busted costs $200 bail.
- **Combat** — fists up close, a 12-round pistol with reloads, armed guards who
  shoot back.
- **HUD** — health, money, ammo, wanted stars, objective banner and a live
  minimap with the objective marker.
- **Sound** — every sound is synthesized with WebAudio: engine hum, two-tone
  sirens, gunshots, pickups and mission jingles. No audio files.
- **Save** — money, health, ammo and mission progress save automatically.

## Layout

- `game/index.html` — the page, one canvas.
- `game/src/main.js` — boot, the loop, screens.
- `game/src/world.js` — the world: everything that exists, one step.
- `game/src/city.js` — Solmar's road grid, blocks and landmarks.
- `game/src/vehicles.js` — car physics, traffic AI, collisions.
- `game/src/people.js` — pedestrians who stroll, pause and flee.
- `game/src/police.js` — wanted stars, police cars, foot cops, arrests.
- `game/src/combat.js` — bullets, melee, armed enemies.
- `game/src/missions.js` — the four story jobs.
- `game/src/render.js` — the city, the HUD and the minimap.
- `game/src/audio.js` — synthesized WebAudio sound.
- `game/src/input.js` — keyboard and mouse.
- `game/src/save.js` — localStorage save and load.
- `game/src/shots.js` — deterministic screenshot scenes.
- `main.ts` — hands the game in: copies `game/` and `screenshots/` and writes
  `dossier.json`.
- `serve.ts` — a tiny static server for local play.
