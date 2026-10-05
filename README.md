# Induktion

**Aufgaben zur vollständigen Induktion, jedes Mal neu erzeugt, mit Lösungsweg und Lösung.**
Eine installierbare Web-App (PWA), komplett statisch, gebaut für GitHub Pages.

© 2026 Nikita Berger

## Warum es das gibt

Ehrlich gesagt: Ich hasse Beweise. Vollständige Induktion fand ich lange einfach nur nervig.
Trotzdem muss ich sie können. Also wollte ich sie endlich lernen, und zwar an **vielen verschiedenen
Aufgaben**, nicht an den drei Beispielen aus dem Skript, die ich nach einer Woche auswendig kenne.

Deshalb gibt es diese App: Ich öffne sie, bekomme eine **neue Aufgabe**, löse sie auf Papier und lasse
mir danach den **Lösungsweg Schritt für Schritt** anzeigen: Induktionsanfang, Annahme, Schritt, Schluss.
Nichts ist fest einprogrammiert, jede Aufgabe wird beim Öffnen frisch erzeugt.

## Was drin ist

Die Themen folgen der PDF „Beweise durch vollständige Induktion“ (Luise Unger, FernUniversität in Hagen):

| Thema | Beispiele |
|---|---|
| Formeln mit Summen | arithmetisch, Quadrate, Kuben, geometrisch, Teleskop, alternierend, mit Fakultät |
| Ungleichungen | `n² ≥ an+b`, `2ⁿ > an+b`, `cⁿ < n!`, Bernoulli |
| Teilbarkeit | `aⁿ − bⁿ`, `aⁿ + c`, `n³ − n`, `n(n+1)(n+2)` |
| Formeln mit Produkten | Potenzprodukte, `∏(1 + c/k)`, Teleskopprodukte |
| Manchmal klappt es nicht | stärkere Aussage beweisen, dann folgern |

- 24 Aufgabentypen in 3 Leveln, Zufallszahlen jedes Mal anders (jede Aufgabe hat eine Kennung wie `#k3j9x`
  und ist über den Link reproduzierbar).
- Du gibst **nichts ein**. Aufgabe lesen, selbst lösen, Lösungsweg aufdecken. Tipps gibt es vorher.
- Fortschritt, Serie und „Nochmal üben“-Liste bleiben lokal im Browser.
- Offline nutzbar nach dem ersten Laden, mit haptischem Feedback auf dem Handy.

## Korrektheit

Die Lösungen werden nicht geraten. `tests/gen.test.mjs` erzeugt 3600 Aufgaben, prüft jede Behauptung
numerisch und rechnet **jede Zeile jeder Umformungskette** mit exakten Brüchen (BigInt) nach.

```bash
node tests/gen.test.mjs
```

## Starten

Kein Build nötig, nur ein statischer Server (wegen Service Worker):

```bash
python -m http.server 8000
```

Dann `http://localhost:8000` öffnen.

### GitHub Pages

Repository auf GitHub pushen, unter *Settings → Pages* den Branch `main` und den Ordner `/ (root)` wählen.
Alle Pfade sind relativ, die App läuft auch unter `https://<name>.github.io/<repo>/`.

## Technik

- [daisyUI 5](https://daisyui.com/docs/cdn/) über CDN, Tailwind Browser-Build
- [KaTeX](https://katex.org) für die Formeln
- [web-haptics](https://www.jsdelivr.com/package/npm/web-haptics) für Vibrationsfeedback
- BlurText und GradualBlur nach Vorbild von [React Bits](https://reactbits.dev), in reinem JS nachgebaut
- Eigener Code: `js/core.js` (Brüche, Polynome), `js/gen.js` (Generatoren), `js/app.js` (Oberfläche)

### Eigenes Hintergrundbild

Eine Datei `assets/bg/bg.jpg` ablegen. Sie wird automatisch weichgezeichnet hinter die App gelegt.

## Lizenz

MIT, siehe [LICENSE](LICENSE). Die PDF ist nicht Teil dieses Repositories.
