Project: React/Vite Double-Elimination Tournament Website

Current Status:
- 4-player bracket works
- 8-player bracket works
- 16-player bracket works
- 32-player bracket works
- Custom player counts work
- Automatic BYE generation works
- BYE auto-advancement works
- Winners bracket routing works
- Losers bracket routing works
- Grand Finals work
- Reset Finals work
- Undo works
- PNG export works
- 31-player bracket has been tested and works
- Bracket validator created and tested.
- All tournament sizes 3–32 validated.
- bracketTest.js passes 30/30 checks.
- Storage key abstraction added to prepare for future multi-tournament support.
- Multiple tournament management implemented (create, open, rename, delete).
- Random team generation implemented (enter players, pick team size 1–4, generates randomized bracket).
- Team generation moved to SetupScreen.jsx (separate setup screen before bracket).

Development Rules:
- Bracket.jsx is stable.
- Do not rewrite Bracket.jsx.
- Do not inspect or modify Bracket.jsx unless I explicitly ask.
- Make small targeted changes only.
- Explain changes before applying them.
- Preserve working bracket routing.
- Avoid unnecessary refactors.

Current Roadmap:
1. ✓ Validate player counts 3–32
2. ✓ LocalStorage save/load
3. ✓ Add multiple tournament management
4. Add autosave/recovery
5. Add manual seeding
6. ✓ Add random seeding / team generation
7. Add tournament settings page
8. Add standings
9. Add shareable links
10. Improve mobile layout
