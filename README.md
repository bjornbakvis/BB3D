# BB 3D Studio (basis)

Dit is een **nieuw** basisproject voor een toekomstige 3D ontwerp webapp (tuinen, badkamers, toiletten, etc.).

## Wat zit er nu in?
- React + Vite + Tailwind (net als je eerdere project)
- Homepagina
- Studio pagina (placeholder)
- Login pagina (placeholder)
- ProtectedRoute structuur (Studio is "achter login")

## Lokaal draaien (optioneel)
```bash
npm install
npm run dev
```

## Deploy op Vercel (zoals je gewend bent)
1. Maak een **nieuw GitHub repo** en zet deze bestanden erin.
2. Ga naar Vercel → **New Project** → kies je repo.
3. Framework: Vite (meestal herkent Vercel dit vanzelf).
4. Build command: `npm run build`
5. Output directory: `dist`

## Belangrijk (voor later)
Echte login komt later met:
- `/api/login`
- `/api/logout`
- `/api/session`
en een veilige session-cookie (HttpOnly).
