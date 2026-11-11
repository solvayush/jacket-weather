# Jacket Weather

A light-hearted, satirical 3D lane-runner about a leather-jacketed chip CEO having a very bad week. It runs offline in a browser.

## Play

Open `jacket-weather.html` in a desktop browser. Keep these four files together:

- `jacket-weather.html` (the game engine and prologue)
- `chapters.bundle.js` (chapters 1 to 8)
- `extras.js` (floating meme cards and roadside billboards)
- `three.min.js` (three.js r149, MIT licence)

Add `?unlock=1` to the address to open every chapter from the title screen.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Change lane | ← → or A D | Swipe left / right |
| Jump | Space, ↑ or W | Swipe up |
| Slide | ↓ or S | Swipe down |
| Advance dialogue | E or Enter | Tap |
| Like a meme card | Click it, or jump into it | Tap it |
| Pause / mute / restart chapter | P / M / R | |

## Story

A prologue (the diner, 1993) and eight chapters, each a run with three or four story stops and one special mechanic. Dialogue choices move four meters (Stock Price, Board Trust, Washington, Beijing), which pick one of four endings.

## Rebuilding the chapters

Each chapter lives in `chapters/chN/chapter.js` with its own `check.js` (`node check.js`). After editing a chapter, run `node build.js` to regenerate `chapters.bundle.js`.

## Status

The game logic is covered by scripted tests, but it has had little play-testing in real browsers and none on phones.

## Disclaimer

This is a work of parody and fiction made for fun. It is not affiliated with or endorsed by any company or person. Events shown as "CONFIRMED" or "REPORTED" follow public news reporting as of November 2026; allegations are presented as allegations, and nothing here should be read as a statement of fact about any real person.
