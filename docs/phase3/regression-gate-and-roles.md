# Phase 3A — gate de non-régression 2C et rôles explicites

## PHASE_2C_REGRESSION_GATE

Fichier : `tests/unit/structure/phase2c-regression-gate.test.ts`. Fixtures **figées** :
`tests/fixtures/phase2c-gate/`, générées une seule fois depuis l'état validé de la phase 2C-4G (commit `5f9c808`).

| Fixture | Contenu protégé, par format (119) |
|---|---|
| `meta.json` | 119 formats, 107 supportés, liste des 12 refusés |
| `structures.json` | modèle, famille, décision de patron, gabarit, dimensions extérieures, matière, fond perdu, `flatMm` ; chaque surface (identité, taille, imprimable, `safeMm`, `printArea`, `draw`, contour) ; empreintes de la découpe, des plis, de la colle, des soudures, des zones techniques, des charnières, des panneaux et de la composition ; empreinte de la structure entière |
| `flat-layouts.json` | FlatLayout : taille, nombre de panneaux, libellé, empreinte complète (ou « refusé ») |
| `geometry-3d.json` | pour chaque maillage : nom, sommets, empreinte des positions (10⁻⁶), empreinte des UV (10⁻⁷), groupes, surface et taille en mm de chaque texture |

**Ce que la phase 3 peut changer** (hors fixtures) :
- positions, typographie, hiérarchie, composition, couleurs et décoration de l'artwork ;
- la 3D est relevée avec le dessin de l'artwork neutralisé : seules la géométrie et la **taille** des textures
  comptent, jamais leurs pixels.

**Ce qu'elle ne peut pas changer** : géométrie, structure, dimensions physiques, UV, patrons, surfaces
imprimables, `flatMm`, zones techniques.

**Un échec du gate** signifie que le moteur physique a changé. On ne le corrige jamais en régénérant les
fixtures : il faut une décision explicite, puis
`PHASE2C_GATE_WRITE=1 npx vitest run tests/unit/structure/phase2c-regression-gate.test.ts`.

**Vérifié par sabotage**, chaque cas détecté puis restauré :

| Sabotage | Tests en échec |
|---|---|
| rayon du bas des pots | 13 |
| UV des pots | 4 |
| rabat d'étui | 6 |
| hauteur d'étiquette | 33 |

## Rôles explicites

- **Avant** : `text()` (dans `compose.ts`) **devinait** le rôle avec `textRole()`, en comparant le texte dessiné aux
  champs du design.
- **Après** : chaque appel nomme son rôle.

| Ce qui est dessiné | Rôle |
|---|---|
| marque ou un de ses mots | `brand` |
| nom | `productName` |
| accroche | `subtitle` |
| contenance | `netContent` |
| ligne d'origine (`microLine`) | `secondary` |
| pastille du gabarit `pop` | `netContent`, ou `secondary` pour « NEW » quand la contenance est vide (rôle conservé, donc identifiants des états enregistrés inchangés) |

`draw.ts` (face classique, dos, code-barres) était déjà explicite. `textRole()` et son utilitaire `norm` ont été
supprimés, sans plus aucune référence.

**Rendu identique**, vérifié sur 168 cas (14 gabarits × 4 contenus × étui, boîte postale, bouteille) :
- **appels de dessin** : 0 différence sur 7 236 ;
- **rôles relevés** : ils ne changent que dans le cas piège où la marque, le nom et l'origine ont le même texte.
  L'ancienne déduction y étiquetait la marque comme « productName » ; c'est la fragilité supprimée.

**Reste non déclaré** (inchangé, sans rôle deviné) : le lettrage géant de marque du gabarit `poster`, dessiné
directement et découpé volontairement. Le déclarer modifierait le comportement de la mise en page intelligente :
c'est une décision de phase 3 ultérieure.
