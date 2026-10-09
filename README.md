# NBA Draft (privat)

Statische Web-App: Rad drehen (Franchise + Dekade), fünf Spieler draften, Lineup/Chemie/Coach
einstellen, 82 Spiele + Playoffs simulieren. Daily Challenge, Freunde-Links, Share-Karte, PWA.
Kein Backend, alles läuft im Browser (`localStorage`).

## Lokal starten
```
npm install
npm run sample     # erfundene Testdaten (bis die echten Daten gebaut sind)
npm test
npm run dev        # http://localhost:5173
npm run build      # Ausgabe in dist/
```

## Echte Daten
Siehe `DATA_SOURCES.md`: Kaggle-CSVs nach `data-pipeline/raw/`, dann
`pip install -r data-pipeline/requirements.txt` und `python data-pipeline/build_players.py`.
Danach die Werte in `src/core/config.js` (SIM, CHEM, PLAYOFFS) mit echten Ratings nachjustieren.

## Auf GitHub Pages veröffentlichen
1. Neues GitHub-Repo anlegen und pushen (`git remote add origin <url>` + `git push -u origin main`).
2. Im Repo: Settings -> Pages -> Source: **GitHub Actions**.
3. Jeder Push auf `main` testet, baut und veröffentlicht automatisch (`.github/workflows/deploy.yml`).
4. Die URL sieht aus wie `https://<name>.github.io/<repo>/`. Challenge-Links nutzen diese URL.

## Als App installieren (PWA)
Nach dem Deploy (HTTPS nötig): am Handy im Browser-Menü „Zur Startseite hinzufügen“ bzw. „App installieren“.
Die App läuft danach auch offline. Änderungen an `public/sw.js`: `VERSION` hochzählen.
Icons neu erzeugen: `python scripts/make_icons.py` (Pillow).

## Aufbau
- `src/core/` reine Logik ohne DOM (Seed, Draft, Chemie, Sim, Playoffs, Regeln, Daily) – getestet
- `src/ui/` Oberfläche (Screens, Karten, Share-Karte, Konfetti)
- `data-pipeline/` Python-Skript für `public/data/players.json`
