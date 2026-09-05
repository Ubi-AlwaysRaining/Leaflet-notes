# Leaflet — your notes & planning app

This is a web app, packaged so you can put it on your phone's home screen like
a real app — no app store needed.

## Why it needs to be "hosted" first

Two features (installing to your home screen, and reminder notifications)
only work when the app is served over `https://` — phones won't allow them
from a plain file. Getting it online takes about 2 minutes and is free.

## Easiest option: Netlify Drop (no account needed)

1. Go to **https://app.netlify.com/drop** on your computer.
2. Drag the whole `notes-app` folder (all the files: index.html, style.css,
   app.js, sw.js, manifest.json, icon-192.png, icon-512.png) onto the page.
3. Netlify gives you a link like `https://random-name-123.netlify.app`.
4. Open that link on your phone.

## Add it to your Home Screen

**Android (Chrome):** open the link → tap the ⋮ menu → **Add to Home screen**.
**iPhone (Safari):** open the link → tap the Share icon → **Add to Home Screen**.

Once added, it opens full-screen with its own icon, just like an installed app.

## Turning on reminders

Open the app → tap the settings (gear) icon → **Enable** under Reminders.
You'll then get a notification 10 minutes before any timed item in a
planning note. This works reliably while the app is open or was recently
open. Neither Android nor iPhone allow *any* web app to fire alarms with
the app fully closed for a long time without a paid push-notification
server — if you outgrow this, that's the next thing to add.

## Using the app

- **Today's Plan** is pinned at the top from the start — tap it and add your
  day's plans with times.
- Tap **+** (bottom right) to add a new **daily plan**, a **writing note**,
  or a **new folder**.
- Inside any note, tap the circles icon to pick a color, pattern, or your
  own photo as the background.
- In writing notes, pick the font and letter color from the top bar.
- In planning notes, type a plan and (optionally) a time, then tap **+** to
  add it. Tap the circle to mark it done, tap ✕ to remove it.
- Tap the folder icon in a note's header to move it into a folder.
- Inside a folder, tap its name to rename it, and use the folder-cover icon
  in the header to give it its own color, pattern, or photo.

Everything is stored privately on your own phone (in the browser's local
storage) — nothing is sent anywhere.
