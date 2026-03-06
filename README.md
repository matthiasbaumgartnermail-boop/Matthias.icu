# Homepage fuer matthias.icu

Diese statische Seite liegt in `website/`.

## Inhalte
- `index.html` - Hauptseite
- `styles.css` - Design
- `app.js` - kleine Animationen
- `assets/bmw/` - BMW-Bilder (oder Platzhalter)
- `functions/api/comments.js` - Gastkommentare für Ideen (Cloudflare Pages Function + D1)
- `_headers` - Sicherheitsheader fuer Cloudflare Pages
- `_redirects` - Kurzlink `/service` -> `https://prae.matthias.icu`
- `deploy_pages.sh` - Deploy-Skript fuer Cloudflare Pages

## Eigene BMW-Fotos
Einfach diese Dateien ersetzen/hinzufuegen:
- `website/assets/bmw/bmw-01.jpg`
- `website/assets/bmw/bmw-02.jpg`
- `website/assets/bmw/bmw-03.jpg`

## Lokaler Test
```bash
cd /Users/matthiasbaumgartner/Coding/PraeProject/website
python3 -m http.server 8090
```
Dann im Browser: `http://127.0.0.1:8090`

## Deploy auf Cloudflare Pages

### 1) Einmalig API-Variablen setzen
```bash
export CLOUDFLARE_API_TOKEN='DEIN_CLOUDFLARE_API_TOKEN'
export CLOUDFLARE_ACCOUNT_ID='DEINE_CLOUDFLARE_ACCOUNT_ID'
```

### 2) Deploy starten

Falls `wrangler` oder `npx` fehlt:
```bash
brew install node
```

Dann deployen:
```bash
cd /Users/matthiasbaumgartner/Coding/PraeProject
./website/deploy_pages.sh matthias-homepage production
```

### 3) Domain verbinden
Im Cloudflare Dashboard:
- `Workers & Pages` -> `matthias-homepage` -> `Custom domains`
- `matthias.icu` verbinden
- optional `www.matthias.icu`

Der Service-Link auf der Seite zeigt auf `https://prae.matthias.icu`.

## Kommentare fuer Ideen aktivieren (Gastname, ohne Anmeldung)
Die Website enthält nun ein Kommentarformular unter „Ideen“.  
Damit Kommentare fuer alle gespeichert werden, braucht das Pages-Projekt eine D1-Datenbankbindung.

### A) D1 in Cloudflare anlegen
1. Cloudflare -> `Storage & Databases` -> `D1` -> `Create database`
2. Name z.B. `matthias-home-comments`

### B) D1 mit Pages-Projekt verbinden
1. `Workers & Pages` -> `matthias-homepage` -> `Settings` -> `Functions`
2. `D1 database bindings` -> `Add binding`
3. Binding name: `COMMENTS_DB`
4. Database: `matthias-home-comments`
5. Speichern

### C) Neu deployen
```bash
cd /Users/matthiasbaumgartner/Coding/PraeProject
./website/deploy_pages.sh matthias-homepage production
```

### D) Admin-Löschen von Kommentaren aktivieren
1. `Workers & Pages` -> `matthias-homepage` -> `Settings` -> `Variables and Secrets`
2. Neues Secret anlegen:
   - Name: `COMMENTS_ADMIN_TOKEN`
   - Value: ein langes, eigenes Geheimnis
3. Speichern und neu deployen.

Auf der Website:
- Unter „Neueste Kommentare“ auf `Admin anmelden` klicken.
- `COMMENTS_ADMIN_TOKEN` eingeben.
- Danach erscheint bei jedem Kommentar ein `Löschen`-Button.
