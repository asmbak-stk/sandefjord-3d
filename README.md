# Sandefjord 3D

Sentrum og havna i Sandefjord som en interaktiv 3D-modell, bygget fra åpne
kartdata. Dra for å rotere, scroll for å zoome, høyreklikk-dra for å panorere.

![Three.js](https://img.shields.io/badge/Three.js-r169-black) ![Vite](https://img.shields.io/badge/Vite-5-black) ![Data](https://img.shields.io/badge/data-OpenStreetMap-black)

## Hvordan det er bygget

`scripts/build_data.py` henter bygninger, veier, vann, grøntareal og jernbane
fra OpenStreetMap via Overpass API, og regner om fra breddegrad/lengdegrad til
meter i et lokalt koordinatsystem. **Nullpunktet er hvalfangstmonumentet**
(59.1274372 N, 10.2256699 Ø) — alt i scenen måles i meter derfra.

Resultatet er én flat JSON-fil, `public/data/sandefjord.json`:

| | antall |
|---|---|
| bygninger | 1526 |
| veistrekninger | 965 |
| grøntareal | 66 |
| jernbane | 10 |
| vannflater | 4 |
| landemerker | 5 |

Landemerkene er ikke hentet fra OSM. Sandar kirke, Torget og
hvalfangstmonumentet er modellert for hånd i `src/scene/landmarks/`, fordi
OSM-omrisset alene ikke gir dem noen form.

## Kjøre lokalt

```bash
npm install
npm run dev
```

Datafila ligger ferdig i repoet, så appen kjører uten at du henter noe.

## Bygge data på nytt

Bare nødvendig hvis du vil endre utsnittet eller oppdatere mot nyere OSM-data.

```bash
pip install requests shapely
python3 scripts/build_data.py
```

Skriptet prøver tre Overpass-speil etter tur, siden det offisielle
strupes ved mye trafikk.

## Lisens på dataene

Kartdataene kommer fra OpenStreetMap og er © OpenStreetMap-bidragsytere,
tilgjengelige under [ODbL](https://www.openstreetmap.org/copyright).
