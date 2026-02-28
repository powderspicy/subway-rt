# Subway Routine Timer

A single-page app for time management routines visualized as a subway line.

## What it does
- Define routine steps with planned minutes (`Activity,minutes` per line).
- Auto-generates station names like `Brush Teeth Ave`.
- Shows a subway-map style route with a moving train.
- Uses an NYC-inspired map style, typography, and line bullet (letter/number in colored circle).
- Generates varied map geometry each time you build a line.
- Adds a random intersecting transfer line and marks interchange stations.
- Announces departures and arrivals (`Now leaving... next stop...`) with optional browser voice.
- Adds periodic conductor updates with synthesized train tones during active runs.
- Supports keyboard controls while running:
  - `D` toggle delay on/off
  - `N` jump to next stop
  - `P` send train to previous stop
- At interchange stations, stop announcements include transfer availability to the intersecting line.
- Tracks planned vs actual durations in an `Actual Times` pane.
- Speed slider includes `Real-time` as the right-most setting (default).
- Includes built-in templates (`Morning Express`, `Workday Launch`, `Evening Wind-Down`).
- Save your own custom lines and load them later from the template dropdown.
- Lets you copy actual times back into the step list for your next run.

## Run
Open `index.html` in a browser.

If your browser blocks speech, allow audio/speech permissions to hear announcements.

## Publish on GitHub Pages
1. Create a new empty GitHub repository (for example: `subway-routine-timer`).
2. In Terminal:
```bash
cd "/Users/alokemukherjee/Documents/subway-routine-timer"
git add .
git commit -m "Initial subway routine timer"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```
3. In GitHub: `Repo -> Settings -> Pages`.
4. Under `Build and deployment`, set:
- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`
5. Save, then wait about 1-2 minutes. Your site URL will appear on that page.
