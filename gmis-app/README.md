# GMIS Fixes — README

## Files to DELETE from your project

1. `gmis-app/app/(tenant)/components/SelectModal.tsx`
   → Delete this entire file AND the components/ folder inside app/(tenant)/
   → Expo Router treats everything in app/ as a route — component files don't belong there

## Files to REPLACE

| File in this zip | Destination |
|---|---|
| `components/ui/SelectModal.tsx` | `gmis-app/components/ui/SelectModal.tsx` — NEW |
| `components/ui/index.ts` | `gmis-app/components/ui/index.ts` — REPLACE |
| `app/(tenant)/signup.tsx` | `gmis-app/app/(tenant)/signup.tsx` — REPLACE |
| `app/(tenant)/(student)/dashboard.tsx` | `gmis-app/app/(tenant)/(student)/dashboard.tsx` — REPLACE |
| `app.json` | `gmis-app/app.json` — REPLACE |

## Errors fixed

1. `borderRadius: "0 8px 8px 0"` → replaced with `borderTopRightRadius` + `borderBottomRightRadius`
2. `SelectModal.tsx missing default export` → moved out of app/ into components/ui/
3. `splash.png missing` → removed splash section from app.json
