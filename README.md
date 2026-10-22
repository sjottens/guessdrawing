# Krabbel! — realtime multiplayer tekenspel

Een tekenspel zoals skribbl.io: één speler tekent, de rest raadt via de chat.

- **Web** (`apps/web`): Next.js (App Router), React, TypeScript, Tailwind CSS
- **Server** (`apps/server`): Node + TypeScript + Socket.IO — de server is de baas over alle spellogica
- **Gedeeld** (`packages/shared`): types voor socket-events, constanten en helpers

## Spelregels

- Kies een naam, maak een kamer of join via code/link (max 8 spelers)
- De host start het spel (minimaal 2 spelers); iedereen tekent om de beurt, 3 rondes
- De tekenaar kiest 1 van 3 woorden (na 15 s wordt er automatisch gekozen)
- Een beurt duurt 80 s; de anderen zien streepjes en krijgen na verloop van tijd letters als hint
- Raden gaat via de chat. Een goed antwoord ziet niemand anders; wie het al weet chat in een apart kanaal met de tekenaar. Bijna goed? Dan krijg je (alleen jij) een seintje
- Punten: 500 → 100 afhankelijk van hoe snel je raadt; de tekenaar krijgt 60 punten per goede rader
- Na 3 rondes volgt een scorebord met de winnaar; de host kan opnieuw beginnen

## Lokaal draaien

Vereist: Node 20+ en pnpm (`corepack enable` activeert de versie uit `package.json`).

```bash
pnpm install
pnpm dev
```

Dit start beide apps tegelijk:

- web: http://localhost:3000
- server: http://localhost:4000 (health check op `/health`)

Open de site in twee browservensters (of een normaal + incognito venster) om met jezelf te spelen. Elk tabblad is een aparte speler.

**Testen op je telefoon:** open `http://<ip-van-je-computer>:3000`. Zonder `NEXT_PUBLIC_SERVER_URL` verbindt de web-app met poort 4000 op dezelfde host. Next.js kan in dev-modus verzoeken vanaf een ander adres blokkeren; voeg dan je IP toe aan `allowedDevOrigins` in `apps/web/next.config.ts`.

### Overige commando's

```bash
pnpm test        # server-tests (rooms, tekenen, spelverloop)
pnpm typecheck   # TypeScript-check van alle packages
pnpm build       # productie-build van web en server
```

### Omgevingsvariabelen

| App | Variabele | Standaard | Uitleg |
| --- | --- | --- | --- |
| web | `NEXT_PUBLIC_SERVER_URL` | `http(s)://<host>:4000` | URL van de Socket.IO-server |
| server | `PORT` | `4000` | Poort waarop de server luistert |
| server | `CORS_ORIGIN` | `*` | Toegestane origin(s), kommagescheiden, bv. `https://krabbel.vercel.app` |

## Deployen

De web-app en de server worden los gedeployd: de web-app op Vercel, de server op Railway of Fly.io (Vercel ondersteunt geen langlevende WebSocket-verbindingen).

> De spelstatus staat in het geheugen van de server. Draai daarom precies **één** server-instantie. Bij een herstart van de server vervallen lopende spellen.

### 1. Server op Fly.io

De `fly.toml` in de root gebruikt `apps/server/Dockerfile`.

```bash
fly launch --no-deploy --copy-config   # kies een unieke app-naam
fly secrets set CORS_ORIGIN=https://jouw-app.vercel.app
fly deploy
```

De server draait dan op `https://<app-naam>.fly.dev`.

### 1. (alternatief) Server op Railway

1. Maak een nieuw project → *Deploy from GitHub repo* en kies deze repo.
2. Railway leest `railway.json` en bouwt met `apps/server/Dockerfile`. Laat de *Root Directory* leeg (de Dockerfile heeft de hele monorepo nodig).
3. Zet de variabele `CORS_ORIGIN=https://jouw-app.vercel.app`. `PORT` zet Railway zelf.
4. Onder *Settings → Networking* maak je een publiek domein aan, bv. `https://krabbel-server.up.railway.app`.

### 2. Web-app op Vercel

1. *Add New → Project* en importeer deze repo.
2. Zet **Root Directory** op `apps/web`. Vercel herkent Next.js en pnpm automatisch (laat *Include files outside of the Root Directory* aan staan, dat is nodig voor `packages/shared`).
3. Voeg de omgevingsvariabele `NEXT_PUBLIC_SERVER_URL` toe met de URL van je server (bv. `https://krabbel-server.fly.dev`).
4. Deploy. Zet daarna de Vercel-URL in `CORS_ORIGIN` van de server.

## Hoe het werkt

### Server is de baas

De server houdt per kamer alle staat bij: spelers, fase (`lobby → choosing → drawing → turnEnd → … → gameEnd`), timers, het woord, punten en de tekening. Elke speler krijgt een **eigen** versie van de staat (`room:state`), zodat het woord alleen naar de tekenaar en naar spelers die het al geraden hebben gaat. Alle invoer van clients wordt gecontroleerd (wie mag tekenen, geldige kleuren/diktes, limieten op het aantal punten).

### Tekenen

- Streken worden verstuurd als **genormaliseerde coördinaten (0–1)** op een canvas met vaste verhouding 4:3, dus een tekening ziet er op elk scherm hetzelfde uit. De lijndikte is een fractie van de canvasbreedte.
- Pointer events werken voor muis, pen en touch; punten worden per ~35 ms gebundeld verzonden (`draw:begin`, `draw:points`).
- Undo verwijdert je laatste streek, wissen maakt het canvas leeg; de server stuurt dit naar iedereen.
- Wie later binnenkomt (of opnieuw verbindt) krijgt de volledige tekening via `draw:sync`.

### Reconnect

Elk tabblad heeft een geheim sessietoken (in `sessionStorage`). Valt de verbinding weg, dan houdt de server je plek 30 seconden vast; Socket.IO verbindt automatisch opnieuw en de client joint dan met hetzelfde token, inclusief score en tekening. Ook een pagina-refresh houdt je plek vast. Is de tekenaar langer dan 10 seconden weg, dan wordt de beurt overgeslagen. Gaat de host weg, dan wordt iemand anders host.

### Projectstructuur

```
apps/
  server/src/
    server.ts        Socket.IO-setup en event-routing
    room.ts          Kamer + spellogica (fases, timers, raden, punten)
    drawing.ts       Validatie en opslag van streken
    words.ts         Woordkeuze en hints
    data/words.nl.json   Nederlandse woordenlijst
  web/
    app/             Next.js-pagina's (start, /room/[code])
    components/      Canvas, toolbar, chat, spelerslijst, overlays
    lib/             Socket-client/store, tekening-store, rendering
packages/shared/src/ Gedeelde types, events en constanten
```

Woorden toevoegen? Pas `apps/server/src/data/words.nl.json` aan.
