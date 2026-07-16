# Seek Skip

<p align="center">
  <img src="assets/screenshots/1.png" alt="Seek Skip" width="440">
</p>

Hop the same search query between search engines with one click. When you run a
search, a compact toolbar appears at the bottom of the results page with a button
for each of your other configured engines — click one and the same query re-runs
there. Also hands queries off to [Venice.ai](https://venice.ai) chat.

**Firefox:** [addons.mozilla.org/firefox/addon/seek-skip](https://addons.mozilla.org/en-US/firefox/addon/seek-skip/)

## Repository layout

```
chromium/   Chromium extension source (Chrome, Brave, Edge, Vivaldi, …)
firefox/    Firefox extension source (Firefox, Floorp, LibreWolf, …)
assets/     Branding, screenshots, and store promo images
```

## Features

### Toolbar
- Appears on any configured engine's results page, centred at the bottom.
- One button per engine (favicon + name), shown in the order set in Settings.
- **Dormant mode** — after you move the mouse, the toolbar shrinks to 50% size and
  50% opacity to stay out of the way:

<p align="center">
  <img src="assets/screenshots/2.jpg" alt="Toolbar in dormant mode" width="720">
</p>

- Hover to expand it back to full size:

<p align="center">
  <img src="assets/screenshots/3.jpg" alt="Toolbar expanded on hover" width="720">
</p>

- Tracks query changes on single-page-app engines (Google, Brave, DDG refine
  searches without a page load) so the buttons always carry your *current* query.
- Dismiss with the × until your next search.

### Engine management (Settings)

<p align="center">
  <img src="assets/screenshots/4.png" alt="Seek Skip settings page" width="720">
</p>

- Add, **edit in place**, delete, and reorder engines — drag rows or use the
  ▲/▼ arrows. Toolbar order mirrors list order.
- **Sync** — the engine list is stored in browser sync storage and follows you
  across devices signed into the same browser profile.
- **Export / Import** — engines export to a JSON file (hand-editable). Import
  offers replace-or-merge; merge de-duplicates against your existing list.
  Imports are validated: malformed entries and non-http(s) URLs are dropped.
- Built-in **query parameter field guide** explaining how to find any engine's
  parameter, common parameters (`q`, `text`, `p`, `wd`, …), and the cases that
  can't work (path-based results URLs, POST-only forms, fragment queries).

### Venice.ai integration
Venice has no URL prefill parameter, so the extension does the typing for you:

1. Click **Venice** on the toolbar.
2. Venice chat opens in a new tab (default: `https://venice.ai/chat/agent`,
   configurable).
3. The extension finds the chat composer and types your query in.
4. Depending on the **auto-submit** setting, it either sends the message or
   leaves it pre-filled for review.

No API key required — it uses your normal logged-in Venice session. Progress is
logged to the Venice tab's DevTools console under `[Seek Skip]` for easy
debugging. Because this is DOM automation against an unofficial surface, a
Venice UI redesign may break it until selectors are updated.

## Installation

### Firefox
Install from [AMO](https://addons.mozilla.org/en-US/firefox/addon/seek-skip/).

For development: `about:debugging#/runtime/this-firefox` → **Load Temporary
Add-on** → select `firefox/manifest.json`. Cleared on browser restart.

### Chromium (Chrome, Brave, Edge, Vivaldi, …)
1. Clone or download this repository.
2. Go to `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the `chromium/` folder.

## Packaging for store upload

Both stores require a zip with `manifest.json` at the root (no wrapper folder).
From inside the relevant source folder:

```bash
cd firefox && zip -r ../seekskip-firefox.zip .      # bash
```

```powershell
Compress-Archive -Path firefox\* -DestinationPath seekskip-firefox.zip   # PowerShell
```

## Adding an engine

Each engine needs three things:

| Field | What it is | Example |
|---|---|---|
| Name | Button label | `Google` |
| URL | The engine's *results page* URL, query string stripped | `https://www.google.com/search` |
| Parameter | The query-string key that carries the search terms | `q` |

To discover an unknown engine's parameter: search for something unmistakable
(e.g. `TESTQUERY123`) and see which `key=` in the address bar holds it. The full
field guide lives at the bottom of the Settings page.

Default engines: Google, Yandex, Brave, DuckDuckGo, Claude (`claude.ai/new`,
outbound-only — Claude rewrites its URL after load, so no toolbar appears there).

## License

[MIT](LICENSE)
