# PF2e Token-Bar

Die **PF2e Token-Bar** erweitert Foundry VTT um eine kompakte Anzeige aller relevanten Charaktere am oberen Bildschirmrand. Sie erlaubt schnelle Interaktionen mit Tokens, verknüpften Charakterbögen und diversen Gruppenaktionen – optimiert für Pathfinder 2e.

---

## Inhaltsverzeichnis

1. [Funktionsübersicht](#funktionsübersicht)
2. [Party-Modus](#party-modus)
3. [Kampf-Modus](#kampf-modus)
4. [Ring-Menü](#ring-menü)
5. [Einstellungen & Steuerung](#einstellungen--steuerung)
6. [Tastenkürzel](#tastenkürzel)
7. [Debugging](#debugging)

---

## Funktionsübersicht

- **Token-Leiste** mit Porträts aller relevanten Akteure (Gruppe oder Kampfteilnehmer).
- **HP-Balken & Wert** direkt unter dem Token.
- **Heldenpunkte**: Plus/Minus-Buttons zur schnellen Anpassung.
- **Effekt-Leiste**: Aktive Effekte und Zustände als Icons (Klick öffnet, Rechtsklick entfernt).
- **Rollenanfragen**: Button *„Wurf anfordern“* erzeugt Chatlinks für Skills oder Rettungswürfe.
- **Ausrichtung & Position**: Horizontal oder vertikal, frei verschiebbar, skalierbar.
- **Ein-/Ausklappbar** und bei Bedarf *gesperrt*, um Verschieben zu verhindern.

---

## Party-Modus

Aktiv, wenn **kein Kampf läuft**.

### Darstellung
- Zeigt alle Gruppenmitglieder (Actors aus der Party).
- HP-Balken, Heldenpunkte und Effekte wie oben beschrieben.

### Zusätzliche Buttons
- **Gruppe in Begegnung übernehmen** – erstellt bei Bedarf eine neue Begegnung und fügt alle Gruppen-Tokens hinzu.
- **Alle heilen** – setzt HP aller Gruppenmitglieder auf das Maximum.
- **Alle rasten** – ruft die PF2e-Funktion „Rest for the Night“ für die gesamte Gruppe auf.
- **Gruppenlager** – öffnet das Party-Inventar; Gegenstände können per Drag&Drop hinzugefügt werden.
- **Beute** / **Verkaufen** – öffnet benannte Loot-Akteure und akzeptiert Items via Drag&Drop.
- **Wurf anfordern** – siehe oben.
- **Begegnung starten** – beginnt eine neue Encounter-Runde (Start-Button ändert sich zu *„Begegnung beenden“*).

---

## Kampf-Modus

Aktiv, sobald eine **Begegnung läuft** oder Combatants existieren.

### Darstellung
- Zeigt alle Combatants, sortiert nach Initiative (NPCs zuerst bei Gleichstand).
- **Initiative-Werte** pro Token – fehlt der Wert, erscheint *„RFC!“* (Initiative würfeln).
- **Aktueller Zug**: Token des aktiven Combatants wird hervorgehoben.
- **Rundenzähler** und **Schwierigkeitsgrad** der Begegnung (Trivial bis Extrem).
- **Delay/Play-Icons**: Zug verzögern oder wieder aufnehmen, inklusive Stundenglas/Play-Symbol.

### Zusätzliche Buttons
- **Begegnung beenden** – beendet die aktuelle Combat.
- **NSC-Initiative** – würfelt Initiative für alle NPCs ohne Wert.
- **Vorheriger/Nächster Zug** – steuert den aktiven Combatant.
- **Wurf anfordern** – steht auch im Kampf zur Verfügung.
- **Verbergen/Anzeigen** – Token-Bar ausklappen oder minimieren.

---

## Ring-Menü

Rechtsklick auf einen Token öffnet ein radiales Menü:

| Symbol | Funktion |
|-------|-----------|
| 📋 Liste | **Zustand hinzufügen/entfernen** (Condition Manager) |
| 👁️ / 🚫 | **Sichtbarkeit umschalten** |
| 🎯 | **Ping** auf die Token-Position |
| ⌛ / ▶️ | **Zug verzögern** oder **fortsetzen** (nur im Kampf) |
| 🎲 | **Initiative würfeln** (wenn noch nicht gesetzt) |

---

## Einstellungen & Steuerung

Unter **Einstellungen → Moduleinstellungen → PF2E Token-Bar**:

- **PF2E Token-Leiste aktivieren** – schaltet die Bar ein oder aus.
- **Standard Kampf-Tracker schließen** – verhindert das automatische Öffnen des Foundry-Kampf-Trackers.
- **Balkengröße** – Skalierung zwischen 50 % und 200 %.
- **Ausrichtung** – horizontal oder vertikal (auch per Button in der Bar).
- **Leiste sperren** – verhindert versehentliches Verschieben.
- **Position** – wird nach Verschieben automatisch gespeichert.

---

## Tastenkürzel

- **T** – Zielmarkierung für den aktuell angehoverten Token umschalten.

---

## Debugging

Aktivieren Sie **„PF2E Token Bar: Debug Logging“** in den Moduleinstellungen, um zusätzliche Konsolenmeldungen zu erhalten.

```javascript
// Alternativ direkt über die Browserkonsole:
game.settings.set("pf2e-token-bar", "debug", true);
```

Viel Spaß mit der PF2e Token-Bar und dem schnellen Zugriff auf Party- und Kampffunktionen!
