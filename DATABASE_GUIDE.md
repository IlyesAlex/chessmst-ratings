# Adatok lekérése, ellenőrzése és tesztadatok törlése

A legegyszerűbb módszer: dupla kattintás az `EXPORT_DATA.cmd` fájlon a teljes SQL-mentéshez és a feldolgozott CSV/XLSX/SQL táblához. A teljes adatbázis ürítéséhez használd az `EMPTY_DATABASE.cmd` fájlt: előbb bezáratja az oldalakat, mentést készít, majd az **EMPTY chessmst-ratings** megerősítést kéri. Részletes lépések: [EXPORT_INSTRUCTIONS.md](EXPORT_INSTRUCTIONS.md). Az alábbi parancsok külön ellenőrzéshez és kézi adminisztrációhoz használhatók.

## Lekérés és ellenőrzés

PowerShellben, a projekt főmappájából:

```powershell
cd C:\_ALEX_\RESEARCH\SAKKSZEMLE\stimuli\stimuli_ratings
node tools/database.js inspect
```

Egy készlethez: `node tools/database.js inspect --set demo` vagy `--set B`.

| Eredmény | Jelentés |
| --- | --- |
| `valid: true` | Az azonosítók, adatstruktúra és válaszértékek érvényesek. |
| `expectedResponses` | B: 2592, demo: 480 szükséges válasz. |
| `submitted` | A „Mentés és tovább” gombbal beküldött válaszok. |
| `drafts` | Elkezdett, de még nem beküldött válaszok. |
| `completedPositions` | Állások, amelyeknél mind a 12 kérdés elkészült. |
| `cursor`, `firstIncomplete` | Az aktuális és az első hiányzó kérdés indexe, nullától számozva. |
| `revision` | A szervermentés verziószáma. |
| `empty: true` | Nincs válasz/piszkozat ebben a készletben. |

Az érvényesség az adatokat ellenőrzi, nem a sakkértékelés szakmai helyességét. A gyűjtés közben természetes, hogy még nincs minden válasz beküldve.

**Kézi próba:** küldj be egy skálaválaszt, várd meg az „Adatbázisba mentve” jelzést, és futtasd az ellenőrzést: a `submitted` értéknek nőnie kell. Jelölj meg egy mezőt továbblépés nélkül: ez piszkozat. Frissítéskor a kérdés és a jelölés álljon vissza. Konfliktusnál próbálj két párt: újratöltés után is páronként maradjanak meg. Eszközváltáskor azonos készlet-URL-t használj. A B és demo haladása külön maradjon.

Csak megjelenési próbához: `?set=demo&preview=1`. Ez elkülönített helyi előnézet, nem ír az adatbázisba. A résztvevőnek a normál, `preview=1` nélküli linket küldd.

## CSV- és JSON-mentés

```powershell
node tools/database.js export
```

Új, dátumozott `backups` almappába menti a szerver aktuális adatait: készletenként `*-responses.csv`, visszaimportálható `*-backup.json`, teljes `*-api-state.json`, illetve `inspection.json`. Egy készlethez használj `--set demo` vagy `--set B` paramétert.

A CSV minden elvárt kérdéssort tartalmaz. A `submitted=false` sor nem kész válasz; a `[]` lehet érvényes „Nincs ilyen” válasz, és nem azonos a hiányzó/null értékkel. A weboldal „Mentés és adatok” menüje a böngésző állapotát exportálja, a parancs a szerverét. Szinkronizálás után egyezniük kell.

## Közvetlen SQL-lekérés és teljes mentés

```powershell
cd C:\_ALEX_\RESEARCH\SAKKSZEMLE\stimuli\stimuli_ratings\backend
$inspectionSql = (Get-Content .\inspect.sql | Where-Object { $_ -notmatch '^\s*--' }) -join ' '
npx.cmd --prefer-online wrangler@4.150.0 d1 execute chessmst-ratings --remote --command $inspectionSql --json
```

Ez az összes tárolt készletverziót, előzményszámot, néhány friss választ és a szükséges táblák/nézet/triggerek meglétét mutatja. A D1 nem engedi a SQLite `PRAGMA integrity_check` parancsot; itt logikai ellenőrzést végzünk.

**Törlés előtt teljes SQL-mentés is kell**, mert az aktuális CSV/JSON nem tartalmazza az összes előzményt és régebbi verziót:

```powershell
$backupStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Force ..\backups | Out-Null
npx.cmd --prefer-online wrangler@4.150.0 d1 export chessmst-ratings --remote --output "..\backups\full-before-reset-$backupStamp.sql"
```

Várd meg a végét, ellenőrizd a fájlt. Export közben ne fusson értékelés vagy más adatbázisparancs: a D1 rövid időre foglalja az adatbázist. A `backups/` Git által figyelmen kívül van hagyva; válaszokat ne tölts fel a nyilvános repóba. [D1 parancsok dokumentációja](https://developers.cloudflare.com/d1/wrangler-commands/)

## Minden tesztadat törlése továbbküldés előtt

**Csak akkor futtasd, ha a jelenlegi összes adat tesztadat és a mentés elkészült.** Törli minden készlet/verzió válaszait, piszkozatait és előzményeit. A táblák és az API megmaradnak.

1. Zárd be az értékelőoldalt minden eszközön/böngészőben. Nyitott oldalak visszatölthetik a tesztadatokat.
2. Készítsd el a teljes SQL-mentést.
3. A backend mappából indítsd a törlést:

```powershell
npx.cmd --prefer-online wrangler@4.150.0 d1 execute chessmst-ratings --remote --file=./reset-all-test-data.sql
```

4. Ellenőrizd, hogy mindkét szám **0**:

```powershell
npx.cmd --prefer-online wrangler@4.150.0 d1 execute chessmst-ratings --remote --command "SELECT (SELECT COUNT(*) FROM study_state) AS remaining_states, (SELECT COUNT(*) FROM response_history) AS remaining_history;"
```

5. **Töltsd újra a frissített értékelőoldalt.** Az adatbázis resetjelzője miatt a régi helyi válaszokat nem tölti vissza automatikusan. A régi oldalverzió újratöltésig nem menthet. A külön helyi helyreállítási másolatok letöltéséhez és eltávolításához nyisd meg a `reset-local.html` oldalt: `https://ilyesalex.github.io/chessmst-ratings/reset-local.html`. Localhost esetén: `http://127.0.0.1:8000/reset-local.html`.

   Kattints a „Helyi JSON-mentések letöltése” gombra, ellenőrizd a letöltéseket, majd a „Helyi tesztmentések törlése” gombra. Megerősítés: **TORLES**. Csak az ezen a böngészőn, ezen a webcímen tárolt ChessMST-mentéseket kezeli. Minden tesztelésre használt telefonon/böngészőben külön ismételd meg; localhoston és a GitHub Pages címen külön tárhely van.

6. Nyisd újra a normál értékelőoldalt: első kérdés, **0 beküldött válasz**. A főmappából a `node tools/database.js inspect` mindkét készletnél `empty: true` legyen. Az oldal létrehozhat új, üres állapotsort; ez önmagában nem korábbi válasz.

Ne importáld vissza a tesztmentést. A résztvevőnek `?set=B` vagy `?set=demo` linket küldj, ne a resetoldalt vagy az előnézetet. A resetvédelemhez a friss `schema.sql`, Worker és weboldal egyaránt szükséges. A `collection_control` táblát és sorát ne töröld; az új parancsfájlok megtartják.

### Csak a demo aktuális verziójának ürítése

A projekt főmappájából: `node tools/database.js prepare-reset --set demo`. Mentést és célzott `reset.sql` fájlt készít a kiírt `backups` mappába; **nem hajtja végre**. Ellenőrizd az azonosítót, készíts teljes SQL-mentést, majd add meg a fájl kiírt teljes útvonalát a Wrangler `--file` paraméterének. A B és a régebbi verziók megmaradnak. A helyi resetoldal minden helyi ChessMST-mentést töröl, ezért a megtartandó válaszokat előtte szinkronizáld és exportáld.

## Az új megjelenés közzététele

Töltsd fel a frissített `docs/` tartalmát a GitHub-repóba, az `assets/pieces/` mappával és az új CSS/JS/reset fájlokkal együtt. Várd meg a Pages közzétételét, majd Ctrl+F5. A bábu- és táblastílus módosítása nem változtatja meg a készletverziót vagy a mentett válaszokat. A Workert emiatt nem kell újratelepíteni.
