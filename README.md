# Drift Racer

**Race. Drift. Boost. Win.**

Drift Racer is a top-down arcade racing game built with only **HTML, CSS and vanilla JavaScript**. There are no frameworks, no external images and no installation. Race 5 AI opponents over 3 laps, drift through corners and release for a mini-turbo.

**Live demo:** _add your Vercel link here_ (for example `https://drift-racer.vercel.app`)

---

## Features

- Top-down camera that smoothly follows your car
- Closed race circuit with long straights, a hairpin, an S-curve, wide corners and tight corners
- 6 racers (you and 5 AI cars) over 3 laps, with live position (for example `2/6`) and lap counter
- Arcade drifting with tire smoke, tire marks and sparks
- Drift charge in three levels: blue, yellow and purple (MAX)
- Mini-turbo when you release a drift (a longer drift gives a bigger boost)
- Minimap showing the track and every car
- Car collisions with bounce, impact particles and screen shake
- Start screen, credits screen, pause screen and finish screen
- Touch controls for phones and tablets

---

## Controls

| Key | Action |
|---|---|
| Arrow Up | Accelerate |
| Arrow Down | Brake / reverse |
| Arrow Left / Right | Steer |
| Space | Drift / handbrake |
| P | Pause / resume |

On touch devices, use the on-screen buttons: LEFT, RIGHT, GAS, BRAKE and DRIFT.

### How to drift

1. Build up some speed first (the car must be moving fast enough).
2. Hold **Space** and steer **Left** or **Right**. The car slides through the corner.
3. Keep holding. The spark colour shows the charge: **blue, then yellow, then purple**.
4. Release **Space** to straighten the car and get a **mini-turbo**. Purple gives the biggest boost.

---

## How to run

**Option 1: VS Code Live Server (recommended)**
1. Open the project folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**.

**Option 2: Open directly**
Double-click `index.html`. It works in any modern browser.

---

## Project structure

```
drift-racer/
├── index.html   # Page structure: canvas, menus, HUD, touch controls
├── style.css    # Layout and styling for overlays, HUD and buttons
├── game.js      # All game logic: track, physics, AI, rendering
└── README.md
```

---

## How it works

| Part | Idea |
|---|---|
| **Track** | 13 control points are smoothed with a Catmull-Rom spline into 182 points. This one list drives drawing, AI, lap counting and the off-track check. |
| **Physics** | Each car has a `heading` (where it points) and a `velAngle` (where it moves). In normal driving they match. |
| **Drifting** | While drifting, `velAngle` follows `heading` slowly, so the car slides sideways while moving forward. |
| **Mini-turbo** | The boost is a separate value that fades over time, so holding the gas alone can never reach turbo speed. |
| **AI** | AI cars aim at a point ahead on the track, with a small sideways offset so they take different lines and overtake each other. |
| **Position** | Progress = laps x track length + distance along the track. Cars are sorted by progress every frame. |
| **Game loop** | `requestAnimationFrame` calls `update(dt)` and `draw()`. All movement uses `dt`, so speed is the same at any frame rate. |
| **Game states** | `start`, `playing`, `paused` and `finished` |

---

## Deploy on GitHub and Vercel

1. Push the files to a GitHub repository, with `index.html` at the top level.
2. On [vercel.com](https://vercel.com), choose **Add New, then Project**, and import the repository.
3. Set **Framework Preset** to `Other`, leave the build settings empty, and click **Deploy**.

Every push to GitHub redeploys the site automatically.

---

## Future improvements

- Start countdown (3, 2, 1, GO)
- Best lap times
- Car selection
- Sound effects and music
- AI cars that also drift
