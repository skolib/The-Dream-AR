# The Dream AR
Dieses Projekt ist im Zusammenspiel mit einer Spieldemo entstanden, damit diese Zusammen Ausgestellt werden. Durch das AR Experience wurde es denen Besuchern der Ausstellung ermöglicht, die Spielwelt aus einem anderen Winkel zu betrachten.

## Funktionsweise/Anleitung
1) Öffne die URL brave://flags/ und suche nach „WebXR Incubation”. Schalte die Option auf „Enabled”.
2) Die Webseite (URL: https://catghostl.github.io/) öffnen.
3) Auf „Enter AR” drücken, um AR zu starten (es kann sein, dass man nach dem Kamerazugriff gefragt wird. Dies sollte für die Sitzung akzeptiert werden).
4) Kamera auf Marker richten. Sobald der Marker erkannt wurde, sollte das Portal sofort erscheinen. Jeder Marker muss einzeln einmal erfasst werden.
5) Dem Portal nähern, um die Umgebung zu wechseln und sich umzuschauen. Die Umgebung ändert sich, sobald der Nutzer einen bestimmten Abstand zum Portal erreicht hat.
6) Nachdem man fertig ist mit dem Rumschauen, wieder vom Marker weg bewegen, um wieder in die reale Umgebung zu gelangen und zum nächsten Portal gehen.

## Anforderungen in bezug auf Marker-Tarcking
### Projekt spezifisch Anforderungen:
- Der abstand zwischen Nutzer und Portal sollte messbar sein, um die Umgebung ab einem definiertem Abstand zum Marker zu wechseln.
- Es sollen drei bis vier unterschiedliche Umgebungen sein, weshalb drei bis vier unterschiedliche Marker gebraucht werden, die einer bestimmten Umgebung zugeordnet werden können.
- Die Portale und somit Marker sollen feste Position im Raum haben, für die Raumplanung der Ausstellung.
- Die Ausführung soll über eine Webseite erfolgen, statt einer App, um die Nutzung auf der Ausstellung zugänglicher zu gestalten. 
- Marker sollten keine Permanente Erkennung erfordern, da bei der Ausstellung nicht versichert werden kann, dass sie nicht verdeckt werden.
- Kosten sollten für das Projekt vermieden werden

### Allgemeine Marker Anforderungen:
- Ausreichend Licht zur Erkennung der Marker
- kontrastreiche Marker, um die Erkennung zu verbessen

## Research in Bezug auf Marker-Tracking
Um die geeignetste Technologie für das Projekt zu finden, wurden verschiedene Frameworks untersucht und teilweise getestet.

### Überblick: Verfügbare Technologien
# Tabelle

### AR.js Test
Aufgrund der Kostenpflichtigkeit bei 8th Wall und Zapworks wurden diese direkt ausgeschlossen. Zwischen denen zwei verbleibenden Technologien, WebXR Image Tracking und AR.js, wäre AR.js die bevorzugte Wahl, da es auf einer Größeren Anzahl von Browsern funktioniert, keine bestimmten flags oder permissions benötigt und einfacher zum einsteigen ist. Bezogen auf die Anforderungen des Projekts war noch unklar ob AR.js Funktionen, wie die feste Platzierung eines Objekts im Raum um permanente Marker nicht zu benötigen, erfüllen kann. In Bezug auf WebXR konnte die Möglichkeit die Anforderungen umzusetzen gewährleistet werden durch eine Beispiel Anwendung, die diese Funktionen implementiert hat. Da WebXR jedoch die zweite Wahl ist nach AR.js wurde zuerst getestet ob diese Funktionen in AR.js umgesetzt werden können, bevor es ausgeschlossen wurde.

**1) Einfaches Marker-Setup**

Zuerst wurde ein einfaches AR-Szenario aufgebaut, bei dem ein 3D-Würfel direkt auf einem Marker gerendert wurde, um von ein Grundgerüst für die nächsten Schritte zu erhalten. 

**2) Objektverankerung ohne sichtbaren Marker**

Anschließend wurde überprüft, ob es möglich ist, den Würfel dauerhaft in der Umgebung zu verankern, sodass der Marker nicht ständig sichtbar sein muss.
AR.js konnte das Objekt zwar auf dem Bildschirm "fixieren", jedoch wurde es dabei nicht korrekt im 3D-Raum ausgerichtet – es verhielt sich eher wie ein 2D-Overlay. Eine echte räumliche Verankerung war nicht gegeben.

**3) Abstandsmessung zwischen Marker und Nutzer**

Ein zentrales Feature des Projekts war die Reaktion auf Abstandsänderungen (z. B. durch Näherung oder Entfernen der Kamera). Diese Funktion konnte nicht richtig umgesetzt werden, da AR.js Marker-basiert ist und die Kamera für einfache Berechnungen nutzt.  

**4) weitere Kritik**

Ein zusätzlicher kritikpunkt war die schlechte Bildqualität im Browser. 

### Fazit
**Entschieden wurde sich also für:** WebXR Image Tracking

**Begründung:**

❌  8th Wall und Zapworks bieten zwar sehr gute Voraussetzungen, wurden jedoch ausgeschlossen, da beide kostenpflichtig sind und eine Anforderung des Projekts die Vermeidung von Kosten ist.


❌  AR.js erfüllte grundlegende Anforderungen, scheitert jedoch an denen Anforderungen die auf die Funktionen des Projekts basieren.


✔️ WebXR war ursprünglich nicht die bevorzugte Lösung, hat die Projektanforderungen im Endeffekt aber am zuverlässigsten erfüllt.

### Risiken & Einschränkungen
**Browser-Kompatibilität:** Nicht alle Geräte unterstützen WebXR/Image Tracking

**Abhängigkeit von Internetverbindung:** Web-basierte AR erfordert Internetverbindung

## Pseudocode
**Prüfen ob Image Tracking verfügbar ist:**
```
IF AR Button gedrückt THEN
    check ob Image Tracking supportet ist
    IF Image Tracking supportet  THEN
        starte AR Experience
    ELSE
        zeige Hinweis ("Bitte Einstellungen prüfen und Seite neu laden.")
Else
    zeig AR Button
ENDIF
```
**Initialisierung (Marker, Modelle und Umgebung vorbereiten):**

```
FOR all Images
    erstelle Bitmap des Markers
    setz geladenen Marker in Array mit dem passendem Index

    Lade Model
    setz geladenes Model in Array mit dem passendem Index

    Lade Umgebung
    Umgebung zur Szene hinzufügen
    Umgebung unsichtbar stellen
    setz geladene Umgebung in Array mit dem passendem Index
ENDFOR
```
**Model Platzierung:**
```
IF Marker erkannt THEN
    hol Marker Index
    übertrage die Position des Markers auf  das Model mit dem selbem Index wie der Marker
    Platziere das Model mit dem selbem Index wie dem Marker in der Szene
ELSE
ENDIF
```
**Umgebungswechsel:**
```
FOR modele
    hol Model Index
    IF Abstand der Kamera zum Model < Abstands Grenze THEN
        Umgebung mit dem selben Index wie das Model sichtbar machen
        FOR alle Modele außer das mit dem selben Index wie das Model
            Model unsichtbar machen
        ENDFOR
    Else
        Umgebung mit dem selben Index wie das Model nicht sichtbar machen
        FOR alle Modelle
            Model sichtbar machen
        ENDFOR
    ENDIF
ENDFOR
```
## Links
<a href="https://catghostl.github.io/"> The Dream AR </a>
<a href="[https://catghostl.github.io/](https://www.linkedin.com/in/viktoria-silchenko-43937a299/)"> LinkedIn Profil </a>
