**To DO**
* hex outline to always be visible as an option/thicker
* option to create different hex outline color compared to its parent interior color
* options for all icons to live in one area and be used by anything that would need an icon.
* clean up legend key to only have the unclaimed and impassable. Allowing the user to add the more players as needed and selecting the options
* getting rid of the 40k icons as the main players home base icons. but insted allowing it to be w/e icon wanted
* maps shapes square, hexagon, pentagon these are the only ones needed at this time
 


# Cartograph-Pattern Tactical Grid (React)

A React + Vite port of the hex-grid campaign map, restructured so the
map itself, the app state, and the UI panels are all independent —
adding a feature is almost always "add one file," not "edit five."

## Running it

```bash
npm install
npm run dev       # http://localhost:5173, hot-reloads on save
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

No other setup needed — everything (fonts, icons) loads from the same
CDNs the original prototype used.

## Deploying to GitHub Pages

Every push to `master` runs `.github/workflows/deploy-pages.yml`. The
workflow installs dependencies, builds the app, and replaces the contents of
the `dist` branch with the production files.

In the repository's GitHub Pages settings, choose **Deploy from a branch** and
select the `dist` branch and `/ (root)` folder. After that one-time setting,
merging or pushing code to `master` automatically updates the site.

## How it's organised

```
src/
  data/            Pure data. No logic, no React. Safe to edit by hand.
    palette.js            default legend/territory colours
    legionIcons.js         unit-type + legion emblem icon URLs
    rewardIcons.js         reward marker icons (inline SVG path data)
    defaultRewardTypes.js  starting reward-type list

  utils/
    hexMath.js       All the hex geometry + colour math. No React
                      imports — reusable anywhere (main map, minimap,
                      a future export-to-image feature, etc).

  state/
    mapReducer.js     THE single source of truth. One big switch
                       statement; every mutation in the app is one
                       case in here. Also exports small selector
                       functions (getOpacity, getFactionScale, ...)
                       so components never reach into state shape
                       directly — if the shape changes, only this
                       file and its selectors need updating.
    MapContext.jsx     Wraps the reducer in React Context and exposes
                       two hooks:
                         useMapState()    - read state
                         useMapActions()  - dispatch actions by name
                                            (e.g. actions.applyColor(c))
                         useMapSelectors() - derived reads (opacity,
                                            faction scale, etc.)

  hooks/
    useZoomPan.js         scroll-to-zoom + drag-to-pan, generic
    useContainerSize.js   ResizeObserver wrapper, generic

  components/
    layout/          App chrome: Header, Sidebar, Tabs, DropdownMenu.
                      Tabs.jsx and DropdownMenu.jsx are fully generic —
                      not hex-map-specific — so reuse them anywhere.
    map/             The actual map viewport.
      HexMapCanvas.jsx  sizes + renders the grid, owns zoom/pan
      HexTile.jsx       a single hex (fill, emblem, reward, icons)
      ZoomControls.jsx  the +/-/reset overlay buttons
      MiniMap.jsx        overhead/overview display (see note below)
    panels/          Sidebar tab content. Each is self-contained —
                      it pulls what it needs from MapContext itself,
                      so App.jsx and Sidebar.jsx never need to know
                      what's inside a panel.
      ReadoutPanel.jsx   always-visible selection summary
      ColorPanel.jsx     territory colours + legend editor
      IconPanel.jsx      unit-type + legion emblem placement
      RewardPanel.jsx    reward types + manual placement + randomiser
```

## Adding things

**A new action (e.g. "rename a hex"):**
1. Add a `case 'RENAME_HEX':` to `mapReducer.js`.
2. Add a one-line wrapper in `useMapActions()` in `MapContext.jsx`.
3. Call `actions.renameHex(...)` from wherever needs it.

**A new sidebar tab:**
1. Create `components/panels/YourPanel.jsx` — read what you need with
   `useMapState()` / `useMapActions()`.
2. Add `{ id: 'yourtab', label: 'Your Tab' }` to the `TABS` array in
   `Sidebar.jsx` and one line in the render switch there.

**A new icon set:**
Add an array to `data/legionIcons.js` (or a new data file) and spread
it into `ALL_ICONS`. The icon panel picks it up automatically and
groups it by its `group` field.

**A new reward icon:**
Grab the source SVG from https://github.com/game-icons/icons, drop
the first (background) `<path>`, and add an entry to
`data/rewardIcons.js`. Icons are embedded as inline path data rather
than linked by URL specifically so they don't depend on an external
host being reachable — the legion emblems in `legionIcons.js` still
use URLs, which is worth knowing if you ever see those fail to load.

## Known simplifications / where to extend next

- **Minimap is read-only.** `MiniMap.jsx` shows the whole board's
  colours but doesn't sync to the main viewport's zoom/pan yet. To
  wire that up: lift the pan/zoom state out of `useZoomPan` (currently
  local to `HexMapCanvas`) into `MapContext`, then `MiniMap` can read
  the current viewport rectangle and dispatch a "jump to" update on
  click. Left local for now to keep the state shape simple until you
  actually need the sync.
- **Zoom/pan is mouse-only.** Touch/pinch support would be a
  reasonable next addition to `useZoomPan.js` — it's isolated there,
  so nothing else needs to change.
- **No persistence yet.** State lives in memory only; refreshing the
  page resets the map. If you want save/load, the whole app state is
  one plain object (`state` in `MapContext`) — serializing it to
  `localStorage` or a file is a small addition at the provider level.
- **No undo/redo yet.** Because every mutation goes through one
  reducer, adding undo/redo later (e.g. keeping a history array of
  past states) touches only `MapContext.jsx`.
