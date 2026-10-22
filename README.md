# Krabbel! — realtime multiplayer tekenspel

Een tekenspel zoals skribbl.io: één speler tekent, de rest raadt via de chat.

- **Web** (`apps/web`): Next.js (App Router), React, TypeScript, Tailwind CSS — draait op Vercel
- **Server** (`apps/server`): Cloudflare Worker met Durable Objects (één per kamer), via WebSockets — de server is de baas over alle spellogica. Draait op het gratis Cloudflare-plan
- **Gedeeld** (`packages/shared`): types voor het WebSocket-protocol, constanten en helpers

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
- server: http://localhost:8787 (lokale Cloudflare-runtime via `wrangler dev`, health check op `/health`)

Open de site in twee browservensters (of een normaal + incognito venster) om met jezelf te spelen. Elk tabblad is een aparte speler.

**Testen op je telefoon:** open `http://<ip-van-je-computer>:3000`. Zonder `NEXT_PUBLIC_SERVER_URL` verbindt de web-app met poort 8787 op dezelfde host. Next.js kan in dev-modus verzoeken vanaf een ander adres blokkeren; voeg dan je IP toe aan `allowedDevOrigins` in `apps/web/next.config.ts`.

### Overige commando's

```bash
pnpm test           # tests van de spellogica (kamers, tekenen, spelverloop, reconnect)
pnpm typecheck      # TypeScript-check van alle packages
pnpm build          # productie-build van de web-app
pnpm deploy:server  # server naar Cloudflare deployen (na `wrangler login`)
```

### Instellingen

| App | Variabele | Standaard | Uitleg |
| --- | --- | --- | --- |
| web | `NEXT_PUBLIC_SERVER_URL` | `http(s)://<host>:8787` | URL van de Cloudflare Worker |
| server | `CORS_ORIGIN` (in `wrangler.jsonc` in de root) | leeg = alles toegestaan | Toegestane origin(s), kommagescheiden, bv. `https://guessdrawing.vercel.app` |

## Deployen

De web-app gaat naar Vercel, de server naar Cloudflare. Beide zijn gratis voor normaal gebruik.

### 1. Server op Cloudflare (gratis)

Maak een gratis account op [cloudflare.com](https://dash.cloudflare.com/sign-up). Daarna kan het op twee manieren.

**Via het dashboard (geen terminal nodig)**

1. Ga naar *Workers & Pages → Create → Import a repository* en kies deze GitHub-repo.
2. Vul in:
   - *Project name*: `guessdrawing` (moet gelijk zijn aan `name` in `wrangler.jsonc` in de root)
   - *Root directory*: `/`
   - *Build command*: `pnpm run build` (standaard) of leeg
   - *Deploy command*: `npx wrangler deploy` (standaard)
3. Deploy. Je server staat daarna op `https://guessdrawing.<jouw-subdomein>.workers.dev`. Elke push naar `main` deployt opnieuw.

**Via de terminal**

```bash
pnpm install
pnpm --filter @guessdrawing/server exec wrangler login
pnpm deploy:server
```

Controleer of het werkt: `https://guessdrawing.<jouw-subdomein>.workers.dev/health` geeft `{"ok":true}`.

### 2. Web-app op Vercel

1. *Add New → Project* en importeer deze repo.
2. Zet **Root Directory** op `apps/web`. Vercel herkent Next.js en pnpm automatisch (laat *Include files outside of the Root Directory* aan staan, dat is nodig voor `packages/shared`).
3. Voeg de omgevingsvariabele `NEXT_PUBLIC_SERVER_URL` toe met de URL van je Worker (zonder `/` aan het eind).
4. Deploy. Pas je de variabele later aan, deploy dan opnieuw: hij wordt bij het bouwen ingebakken.

### Gratis limieten

Het gratis Cloudflare-plan geeft per dag 100.000 verzoeken (WebSocket-berichten tellen mee) en een beperkte hoeveelheid rekentijd voor Durable Objects. Een kamer kost alleen rekentijd zolang er spelers verbonden zijn. Voor een groep vrienden is dat ruim voldoende; de client bundelt tekenpunten per 60 ms om het aantal berichten laag te houden. Kijk in het Cloudflare-dashboard bij *Workers & Pages → guessdrawing → Metrics* hoeveel je gebruikt.

> Een kamer leeft in het geheugen van zijn Durable Object. Na een nieuwe deploy van de server vervallen lopende spellen.

## Hoe het werkt

### Server is de baas

Elke kamercode hoort bij één Durable Object: een klein, los servertje bij Cloudflare dat alle WebSockets van die kamer afhandelt. De spellogica (`apps/server/src/game/room.ts`) weet niets van Cloudflare; hij praat via een simpele `send`/`close`-interface, zodat de tests gewoon in Node draaien.

De server houdt per kamer alle staat bij: spelers, fase (`lobby → choosing → drawing → turnEnd → … → gameEnd`), timers, het woord, punten en de tekening. Elke speler krijgt een **eigen** versie van de staat (`state`-bericht), zodat het woord alleen naar de tekenaar en naar spelers die het al geraden hebben gaat. Alle invoer van clients wordt gecontroleerd (wie mag tekenen, geldige kleuren/diktes, limieten op het aantal punten).

### Tekenen

- Streken worden verstuurd als **genormaliseerde coördinaten (0–1)** op een canvas met vaste verhouding 4:3, dus een tekening ziet er op elk scherm hetzelfde uit. De lijndikte is een fractie van de canvasbreedte.
- Pointer events werken voor muis, pen en touch; punten worden gebundeld verzonden (`draw:begin`, `draw:points`), per ~60 ms.
- Undo verwijdert je laatste streek, wissen maakt het canvas leeg; de server stuurt dit naar iedereen.
- Wie later binnenkomt (of opnieuw verbindt) krijgt de volledige tekening via `draw:sync`.

### Reconnect

Elk tabblad heeft een geheim sessietoken (in `sessionStorage`). Valt de verbinding weg, dan houdt de server je plek 30 seconden vast. De client verbindt automatisch opnieuw (ook meteen als je terugkomt naar een tabblad op je telefoon) en joint dan met hetzelfde token, inclusief score en tekening. Client en server sturen elkaar elke 10 seconden een teken van leven, zodat een weggevallen telefoon snel opgemerkt wordt. Ook een pagina-refresh houdt je plek vast. Is de tekenaar langer dan 10 seconden weg, dan wordt de beurt overgeslagen. Gaat de host weg, dan wordt iemand anders host.

### Projectstructuur

```
apps/
  server/
    src/index.ts     Worker: routes (POST /rooms, WebSocket) + Durable Object per kamer
    src/game/room.ts     Kamer + spellogica (fases, timers, raden, punten)
    src/game/drawing.ts  Validatie en opslag van streken
    src/game/words.ts    Woordkeuze en hints
    src/data/words.nl.json   Nederlandse woordenlijst
  web/
    app/             Next.js-pagina's (start, /room/[code])
    components/      Canvas, toolbar, chat, spelerslijst, overlays
    lib/             Socket-client/store, tekening-store, rendering
packages/shared/src/ Gedeelde types, protocol en constanten
wrangler.jsonc       Cloudflare-configuratie (Worker + Durable Object)
```

Woorden toevoegen? Pas `apps/server/src/data/words.nl.json` aan.
