# Blickwinkel Haiger – neue Website

Neue, moderne Website für **Blickwinkel – Moderne Augenoptik & Kontaktlinsen**, Hinterm Graben 4, 35708 Haiger.
Inhalte, Texte und Bilder stammen von der bisherigen Website [blickwinkel-haiger.de](https://www.blickwinkel-haiger.de/), ergänzt um Fotos des Geschäfts und Infos aus Google Maps.

## Highlights

- **Startseite als Erlebnis:** Ladenfoto, das zunächst unscharf ist und durch eine „Brille“ (folgt Maus bzw. Finger) scharf wird. Beim Scrollen wird das ganze Bild klar.
- **Live-Öffnungsstatus:** „Geöffnet bis 18:00“, „Mittagspause“ usw. – inkl. hessischer Feiertage. Ein Klick auf den Status im Header öffnet die Öffnungszeiten der ganzen Woche; der heutige Tag ist markiert.
- **Termin-Dialog in 3 Schritten:** Anliegen → Wunschtag und Uhrzeit (nur echte Öffnungszeiten) → Kontaktdaten. Auf jeder Seite über „Termin anfragen“ erreichbar.
- **Interaktive Elemente:** Sehanalyse-Schritte mit animiertem Auge, Seh-Simulator (Grauer Star, Glaukom, AMD …), Gesichtsform-Finder, Gleitsicht-Zonen, Glas-Extras, Tönungs-Finder für Sportbrillen, Ladenrundgang mit Lightbox.
- **Kompakt:** kurze Texte, wenige klare Abschnitte, am Seitenende eine ruhige Kontaktleiste statt Werbe-Bannern.
- **Kontaktlinsen nachbestellen** per Formular (Abholung oder Versand).
- **Smartphone-optimiert:** eigene Schnellleiste (Anrufen · Termin · Route), Vollbild-Menü, Dialog als Vollbild-Ansicht.
- **Datenschutzfreundlich:** Schriften selbst gehostet, keine Tracker, keine Cookies; Google Maps lädt erst nach Klick.
- **Barrierearm:** Tastaturbedienung, Skip-Links, Alternativtexte, reduzierte Animationen bei entsprechender Systemeinstellung.

## Aufbau

```
index.html, service.html, …   fertige Seiten (werden von build.mjs erzeugt – nicht direkt bearbeiten)
assets/css/style.css          gesamtes Design
assets/js/main.js             Animationen, Öffnungsstatus, Termin-Dialog, Formulare
assets/img/                   optimierte Bilder (WebP), Logo, Icons
assets/fonts/                 Schriften Fraunces & Manrope (SIL Open Font License)
api/anfrage.php               versendet Termin-Anfragen und Bestellungen per E-Mail
_src/layout.html              Grundgerüst aller Seiten
_src/partials/                wiederkehrende Bausteine (Header, Footer, Termin-Dialog, Bewertungen …)
_src/pages/                   Inhalte der einzelnen Seiten
build.mjs                     setzt die Seiten zusammen
```

## Inhalte ändern

1. Text in `_src/pages/…` oder `_src/partials/…` anpassen.
2. Zentrale Daten (Telefon, Adresse, Bewertung, Anzahl Rezensionen …) stehen oben in `build.mjs` unter `SITE`.
3. Öffnungszeiten an **zwei** Stellen ändern: `_src/partials/hours.html` (Anzeige) und `CONFIG.hours` in `assets/js/main.js` (Live-Status & Terminauswahl).
4. Seiten neu erzeugen:

```bash
node build.mjs
```

Lokale Vorschau: `npx http-server .` (oder mit PHP für das Formular: `php -S localhost:8000`) und im Browser öffnen.

## Veröffentlichen

Alle Dateien per FTP/SFTP in das Web-Verzeichnis laden (die Ordner `_src/` und `build.mjs` werden auf dem Server nicht benötigt).

- **Formulare:** Auf normalem PHP-Hosting werden Anfragen über `api/anfrage.php` direkt an `info@blickwinkel-haiger.de` gesendet. Ist kein PHP verfügbar (z. B. GitHub Pages), öffnet sich automatisch das E-Mail-Programm der Besucher mit der fertig ausgefüllten Anfrage.
- **Alte Adressen:** Die `.htaccess` leitet die bisherigen URLs (z. B. `/sehanalyse`) auf die neuen Seiten um (Apache).

## Vor dem Livegang prüfen

- [ ] **Datenschutzerklärung** wurde 1:1 von der alten Website übernommen. Sie erwähnt u. a. etracker, Cookies, YouTube und einen Newsletter, die auf der neuen Website nicht mehr genutzt werden – bitte anpassen lassen (Formularversand, Google Maps nach Einwilligung und Hosting ergänzen).
- [ ] **Erklärung zur Barrierefreiheit** verweist auf einen Prüfbericht der to.eyes GmbH für die alte Website – aktualisieren.
- [ ] **Bildrechte:** Viele Fotos (Personen, Brillengläser, Sport) sind Stockbilder aus dem Baukasten des bisherigen Website-Anbieters. Bitte klären, ob sie auch außerhalb dieses Anbieters genutzt werden dürfen – sonst durch eigene Fotos ersetzen. Eigene Fotos: Ladenfront, Innenaufnahmen, Sonnenbrillen, Inhaberfoto.
- [ ] **Google-Bewertung** (4,9 / 66 Rezensionen) und die gezeigten Rezensionen gelegentlich aktualisieren (`build.mjs` bzw. `_src/partials/reviews.html`).
- [ ] Absenderadresse in `api/anfrage.php` (`website@blickwinkel-haiger.de`) beim Hoster einrichten bzw. anpassen.
