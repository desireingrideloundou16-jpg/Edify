# Phase 2C-4F-3 — mise en page intelligente des pots coniques

Cette phase est une couche de **composition déterministe** : elle place les éléments de l'illustration dans
l'espace d'impression défini par la géométrie. Elle ne modifie jamais la paroi, le secteur, les UV, les patrons,
les dimensions physiques, ni la taille d'un élément. Elle n'utilise aucune IA et aucun aléa.

```
conicalProfile      secteur exact, bande sous le couvercle              (2C-4F-1, inchangé)
      ↓
conicalSafeArea     zone sûre, zone principale, texte et logo conseillés (2C-4F-2, inchangé)
      ↓
conicalLayout       classification, priorités, placement valide, collisions   ← pur (structure/profile/conicalLayout.ts)
      ↓
artwork             relevé des éléments dessinés, décalages appliqués         (artwork/placement.ts, smartLayout.ts)
      ↓
aperçu · 3D · PDF   une seule position logique par élément
```

Hiérarchie de vérité : géométrie physique → surface imprimable → zones techniques → zone sûre → composition →
illustration. La composition ne remonte jamais la chaîne.

## 1. Problème

La phase 2C-4F-2 a montré que la mise en page par défaut (`drawWrap`, conçue pour une étiquette rectangulaire)
place des éléments hors de la zone sûre. Sur la **boîte traiteur** :
- le code-barres traverse l'arc du bas ;
- « Contenu net » longe la couture ;
- le « 250 g » de la face tombe entièrement sous l'arc intérieur, donc il n'est pas imprimé.

## 2. Éléments (audit de l'artwork)

L'illustration est **procédurale** : `drawFront`, les 14 layouts de `compose.ts`, `drawBack` et `drawBarcode`
calculent leurs positions en fractions du cadre, sans modèle d'éléments stocké. Plutôt que de créer un second
système d'artwork, les primitives existantes **déclarent** chaque élément qu'elles dessinent via
`placeElement(ctx, rôle, boîte, dessin)` :

| Primitive | Élément | Rôle |
|---|---|---|
| `text()` de `compose.ts`, et `microLine` qui l'utilise | une ligne de texte | d'après le champ affiché : contenance → `netContent`, nom → `productName`, marque (ou un de ses mots) → `brand`, accroche → `subtitle`, badge → `badge`, origine → `secondary`, slogan → `claim` |
| `drawLogo` de `compose.ts`, logo de `drawFront` | logo ou monogramme | `logo` |
| `drawSeal` | sceau du badge | `badge` |
| marque, nom, accroche et contenance de `drawFront` | lignes de la face classique | `brand`, `productName`, `subtitle`, `netContent` |
| filet d'accent de `drawFront` | filet | `decorative` |
| titre de `drawBack` | titre du dos | `secondary` |
| corps de `drawBack` | bloc des mentions (ingrédients, emploi…) | `regulatory` |
| faits de `drawBack` | bloc « Contenu net / dates / prix » | `netContent` |
| `drawBarcode` | code-barres, plaque blanche et zones de silence GS1 comprises | `barcode` |

- **Hors session**, `placeElement` appelle simplement le dessin : rendu identique, appel pour appel.
- **Session « record »** : la boîte de l'élément (sa propre emprise, ramenée au cadre par la transformation
  courante) est notée.
- **Session « apply »** : l'élément est dessiné translaté de son décalage. Taille, police, couleurs et rotation
  sont inchangées, et le découpage au contour imprimé (`drawSurface`) ne bouge pas.
- **Identifiants** : `rôle#rang` dans l'ordre de dessin (`netContent#1`). Cet ordre est fixe pour un design, donc
  le relevé et l'application ont les mêmes identifiants.

Les motifs, l'illustration IA, les bandeaux, cadres et emblèmes ne sont pas déclarés : ils sont décoratifs et
peuvent passer sous la découpe.

## 3. Priorités

| Priorité | Groupe | Rôles |
|---|---|---|
| **P0 critique** | REGULATORY | `barcode`, `regulatory` (mentions obligatoires) |
| **P1 identité** | IDENTITY / PRODUCT | `logo`, `brand`, `productName` |
| **P2 information** | PRODUCT / INFORMATION | `subtitle`, `netContent`, `bodyText` |
| **P3 marketing** | MARKETING | `claim`, `badge`, `secondary` |
| **P4 décoratif** | DECORATIVE | `image`, `decorative` (jamais contraints) |

Le code-barres est P0, jamais décoratif. Ordre de traitement : la priorité, puis un ordre fixe des rôles, puis
l'identifiant (`placementOrder`). Le résultat ne dépend donc pas de l'ordre d'entrée (testé).

## 4. Contraintes

Toutes les régions sont les secteurs d'anneau exacts de 2C-4F-2. Un élément n'est valide que si **ses 4 coins**
y sont (`rectInRegion`), jamais d'après une boîte englobante.

| Rôle | Peut rester s'il est dans | Déplacé de préférence vers |
|---|---|---|
| `logo` | la zone principale | le cercle du logo conseillé → la zone principale → la zone sûre |
| `brand`, `productName` | la zone principale | la zone principale → la zone sûre |
| tous les autres (sauf P4) | la zone sûre | la zone sûre |

Toute région est incluse dans la zone sûre, donc tout élément placé est :
- **dans le secteur** ;
- **hors de la bande sous le couvercle**, avec la marge `SAFE_MM` ;
- **loin de la couture**, avec la marge angulaire de 2C-4F-2.

**Marges** : aucune nouvelle marge de sécurité. Celles de la zone sûre (`SAFE_MM` = 3 mm, marge de couture
dérivée) s'appliquent. Le code-barres porte ses **zones de silence GS1** (11 et 7 modules) dans sa boîte : aucun
autre élément protégé ne peut y entrer.

**Collisions** : un élément P0 à P2 placé devient un obstacle pour tout ce qui est placé après lui. Le code-barres
n'est donc jamais déplacé par un logo, ni le logo par un slogan. Couples testés :
- code-barres et logo, nom du produit, contenu net ;
- mentions et code-barres ;
- logo et marque.

**Côté conservé** : la zone principale (la face) est réservée à la composition de la face. Un élément parti des
côtés ou du dos, dont la règle ne vise pas la face, n'y est **jamais déplacé** : ses 4 coins restent de son côté du
coin angulaire. Le test est exact, car les bords du coin sont des droites passant par l'apex. Sans cette règle, un
bloc de mentions trop long chasserait la marque de la face.

## 5. Algorithme (`findValidPlacement`, `planLayout`)

Pour un élément, avec les obstacles déjà placés :

1. S'il est dans sa région d'acceptation et libre → **`valid`**, il ne bouge pas (mouvement minimal).
2. Sinon, pour chaque région visée dans l'ordre :
   - candidats sur une grille de `PLACEMENT_GRID_MM` = 1 mm, ancrée sur sa position, limitée à l'étendue de la
     région ;
   - chaque candidat est testé exactement : région, côté, obstacles ;
   - le plus petit déplacement gagne. Égalités départagées par |dy|, puis dy, puis dx.
   - Résultat : **`moved`**.
3. Rien ne convient → **`invalid`**, l'élément reste en place avec une raison déterministe :
   - « trop grand : L × H mm ne tient nulle part dans la zone sûre (de son côté du pot) » ;
   - ou « aucune position libre … : les éléments prioritaires occupent la place ».

**Colonnes** : les éléments empilés (emprises horizontales qui se recouvrent, verticales disjointes) forment une
colonne. Elles sont traitées dans l'ordre de leur membre le plus important (les P0 d'abord) :

1. Ses membres sont d'abord placés un par un, au mouvement minimal.
2. Si cela **casse la colonne** (membre invalide, membre sorti de sa colonne, ordre de lecture changé), la colonne
   est **réalignée** à la place (`reflowColumn`) :
   - ordre, alignement horizontal et tailles sont conservés ;
   - les espacements sont réduits par pas de 5 % (`COLUMN_SPACING_STEPS` = 20), le plus grand espacement qui tient
     gagne ;
   - la colonne glisse en bloc, latéralement au plus de sa propre largeur ;
   - le plus petit déplacement total gagne.
3. Les éléments décoratifs déclarés (filet d'accent) suivent leur colonne.
4. Si aucun réalignement ne tient, le placement un par un est gardé.

Pas de réalignement si un membre est trop grand en lui-même.

**Score** (`Placement.score`) :
- 1 pour un élément laissé en place ;
- 1 / (1 + d / hauteur de la zone sûre) pour un élément déplacé de d mm ;
- 0 pour un élément invalide.

**Orientation** : les éléments restent droits (`rotationDeg` = 0, la convention du rendu). `textOrientationAt` donne
le conseil `upright` / `tangent` au centre final. C'est une **recommandation** : appliquer une rotation changerait
le comportement du rendu.

**Complexité** :
- un élément : O(G × O), avec G le nombre de points de grille de la région (au plus environ 30 000 pour le pot de
  protéine) et O le nombre d'obstacles (moins de 10) ;
- une colonne : au plus 21 espacements × (2L + 1) glissements × H positions, avec un arrêt dès que le glissement
  seul coûte plus que la meilleure solution.

Mesuré, relevé compris : 6 à 65 ms par design, calculé une fois par modification (débounce de 120 ms). Aucune
boucle infinie, aucun calcul par pixel.

## 6. RECOMMEND / APPLY

- **RECOMMEND** (par défaut) :
  - `useSmartLayout` relève les éléments (`recordWrapElements`, sur un canvas de travail, polices chargées) et
    calcule le plan (`planLayout`). L'artwork n'est pas modifié.
  - L'aperçu montre le panneau « Mise en page intelligente » (éléments à repositionner ou impossibles, avec leur
    raison) et, dans le patron :
    - en ambre, la position actuelle (tirets), la position recommandée (trait plein) et une flèche ;
    - en rouge, les éléments impossibles à placer.
- **APPLY** (« Appliquer les positions recommandées ») :
  - les décalages des éléments déplacés (`WrapPlacement`, en fractions du cadre imprimé) sont portés par le
    **design** ;
  - `drawWrap` les applique pour l'aperçu, la 3D, les miniatures et le PDF : **une seule position logique** ;
  - « Revenir à la mise en page d'origine » les retire.
- Un plan n'est appliqué qu'à un cadre de mêmes proportions (tolérance de 2 %, l'arrondi des textures).

Tant qu'APPLY n'est pas utilisé, le rendu est **inchangé** :
- les 119 formes 3D sont identiques ;
- les 119 patrons sont identiques ;
- les autres familles n'ont pas de régions de composition et ne voient jamais le panneau.

## 7. Fallback

Un élément impossible à placer n'est **ni supprimé, ni coupé, ni réduit, ni déformé, ni forcé** hors de la zone
sûre. Il reste à sa place d'origine, et le rendu continue de l'afficher. Il est signalé en rouge avec sa raison.

## 8. PDF

Le PDF commercial imprime l'artwork avec les positions appliquées. Il n'imprime **ni** les guides de 2C-4F-2, **ni**
les conseils de mise en page (`drawLayoutAdvice` est réservé à l'aperçu ; `exportPrintPdf` ne l'appelle pas, testé).

## 9. Exemples (mise en page par défaut de l'éditeur)

| Pot | Résultat |
|---|---|
| protein-tub | 1 élément : le bloc « Contenu net » est décalé de 3 mm, loin de la couture |
| yogurt-cup | 4 petits décalages de 2 à 4 mm : contenance de la face, titre du dos, contenu net, code-barres |
| deli-container | la colonne de la face est réalignée (espacement 60 %, ordre et axe gardés), le code-barres remonte de 16,8 mm au-dessus de l'arc, « Contenu net » est décalé de 4,2 mm |
| hair-cream-tub | 4 décalages de 6 à 11 mm, dont le code-barres (8,9 mm) |

**Cas impossible** : boîte traiteur avec une liste d'ingrédients longue. Le bloc de mentions (environ 94 × 32 mm)
ne tient pas de son côté du pot, entre la couture et la face. Il est déclaré **invalide** et laissé en place, sans
être poussé sur la face ; le reste est placé.

## 10. Limites

- **Ordre de lecture** : si une colonne ne tient pas même réalignée, les éléments sont placés un par un, et l'ordre
  de lecture peut changer. C'est la limite d'un solveur simple.
- **Éléments non déclarés** : cadres, bandeaux, emblèmes et anneaux de texte (`arcText` du layout « label ») restent
  en place ; un logo déplacé peut quitter son emblème.
- **Persistance** : le choix APPLY est un état de l'éditeur ; il n'est pas encore enregistré dans le projet.
- **Mesure** : les boîtes de texte valent largeur mesurée × corps, et non l'encre exacte des glyphes.
- **Hors périmètre** :
  - aucune courbure de texte, compensation typographique ni rotation automatique ;
  - pas de moteur de composition IA ;
  - pot de glace non supporté.

---

# Phase 2C-4F-4 — persistance, éléments liés et preflight

Cette phase rend la mise en page intelligente **persistante et vérifiable**. Elle ne change ni la géométrie, ni les
UV, ni les patrons, ni les modèles 3D, ni les zones sûres. Aucune IA n'est utilisée.

## 11. Persistance de l'APPLY (`artwork/smartLayoutState.ts`)

Le projet est déjà enregistré automatiquement dans `projects.data` (JSON `SavedProject`, version 1). Il reçoit un
champ optionnel `smartLayout` : aucune nouvelle table, aucune migration. Les anciens projets n'ont pas ce champ, ce
qui équivaut à « pas d'APPLY ».

```
SmartLayoutState { version: 1, status: "applied", surfaceId: "wrap", frame: printArea (mm),
                   placements: [{ elementId, role, surfaceId, original, applied, delta, rotationDeg: 0, parentId? }] }
```

- **Contenu** : chaque élément dessiné ailleurs qu'à sa place d'origine garde sa position d'origine, sa position
  appliquée et le décalage. Le décalage est redondant **à dessein** : il est revérifié au chargement.
- **Original intact** : l'artwork d'origine n'est jamais réécrit, puisque le design dessine toujours la mise en page
  d'origine et que l'état ne fait qu'ajouter les décalages.
  - « Revenir à la mise en page d'origine » retire l'état, et cela fonctionne aussi après un rechargement.
  - « Appliquer » le recrée.
- **Rechargement** : l'état est validé (`parseSmartLayoutState`), puis **dessiné tel quel**
  (`wrapPlacementFromState`), sans nouveau calcul. Aperçu, 3D, miniatures et PDF reçoivent la même position logique.
- **Idempotence** : le plan est toujours calculé sur l'artwork **d'origine** (le relevé ignore un placement
  appliqué) et le planificateur est déterministe. Appliquer deux fois, ou restaurer puis réappliquer, redonne donc
  exactement le même état (testé, à l'octet près en JSON).
- **Design modifié en mode appliqué** : le plan est recalculé et l'état mis à jour s'il diffère (même comportement
  qu'en 2C-4F-3). Le choix de l'utilisateur, « appliqué », est conservé.

**Validation au chargement**, qui ne lève jamais d'erreur : tout refus est signalé et rien d'illisible n'est
dessiné.

| Cas | Effet |
|---|---|
| état absent ou `null` | pas d'APPLY |
| non-objet, version ou statut inconnus, surface inconnue, autre format (cadre différent), liste absente | état ignoré, original dessiné |
| placement incomplet, identifiant invalide, rôle inconnu, surface inconnue, rectangle non fini, delta NaN ou incohérent, taille modifiée, rotation, position hors secteur, parent invalide, doublon | placement ignoré, les autres restent |
| placement d'un élément qui n'est plus dessiné | ignoré au rendu et au preflight (`orphanPlacements`) |

Un état enregistré pour un autre format n'est pas appliqué, et il est retiré à la sauvegarde suivante. Le lien de
partage (`#d=`) ne transporte pas l'état.

## 12. Éléments liés (`parentId`)

- **Déclaration** : une primitive déclare qu'un décor appartient à un élément :
  `placeElement(..., parentId)` avec `elementId(ctx, rôle, "next" | "last")`.
- **Décors déclarés dans cette phase** :
  - les anneaux et le filet de l'**emblème** (layout `emblem`), liés à la marque ;
  - le **médaillon** du layout `label` (disque, anneaux et textes en arc), lié à la marque.
- **Le reste** : les autres décors ne sont pas convertis et se comportent comme avant. Le filet d'accent de la face
  classique reste membre de sa colonne (2C-4F-3).

Règles (`planLayout`) :
- Un enfant **ne bouge jamais seul**. Il suit son parent du même décalage, sans changement de taille ni de rotation.
- Après le déplacement, l'enfant est **revérifié**.
  - **Enfant contraint** (badge…) : il doit respecter sa région et ne chevaucher aucun élément protégé (hors de son
    groupe). Sinon, il est `invalid` (« … en suivant « brand#0 » ») et le parent reçoit `groupIssue`.
  - **Décor** : s'il quitte la zone imprimée alors qu'il y était, il est signalé (`linkIssue`, puis un
    avertissement du preflight).
- **Liens** : un seul niveau. Un lien vers un parent absent, soi-même ou lui-même lié est ignoré, et la raison est
  écrite dans le placement. Un parent dont le propre lien est cassé compte comme une racine.

## 13. Preflight (`structure/profile/conicalPreflight.ts`, pur)

`runPackagingPreflight(structure, éléments, état)` → `preflightLayout(...)` examine l'artwork **tel qu'il sera
imprimé** (éléments d'origine + état appliqué). Il ne crée aucune nouvelle règle et ne modifie rien.

- **Régions et règles** : celles de 2C-4F-3 (`rectInLayoutRegion`, `ROLE_RULES`). Zone sûre, couture, arc du bas,
  couvercle et secteur sont ceux de 2C-4F-2. Le code-barres inclut ses zones de silence.
- **Collisions** : `rectsOverlap`, dans `placementOrder`. L'élément placé plus tard est celui qui gêne, comme pour le
  placement ; les membres d'un même groupe lié ne se gênent pas.
- **Suggestion** : la position du plan (`suggestedRect`) quand elle existe. Le côté conservé est appliqué.
- **Cause** (« où / pourquoi »), dans cet ordre :
  1. coupé par la découpe ;
  2. sous le couvercle ;
  3. trop près de la couture ;
  4. trop près du bord haut ;
  5. traverse l'arc du bas ;
  6. hors de la face ;
  7. chevauche « id ».

| Situation | Sévérité |
|---|---|
| élément P0 (code-barres, mentions) mal placé ou en collision | **blocking** (correction : mise en page intelligente) |
| élément P0, P1 ou P2 **impossible à placer** | **blocking** (correction : contenu, à raccourcir ou alléger) |
| P1 à P3 mal placé mais corrigeable, P3 impossible | **warning** |
| décor lié sorti de la zone imprimée | **warning** |
| rien | **pass** |

Les formats sans régions de composition ne sont pas concernés : `PREFLIGHT_NOT_APPLICABLE` (pass, rien vérifié).

## 14. Export

- **Avant un PDF ou un ZIP** (qui contient le PDF), le preflight est **recalculé à neuf** : polices chargées,
  nouveau relevé, état courant.
- **Ordre** : il tourne **avant** le contrôle d'abonnement, donc un export bloqué ne consomme rien.
- **Décision** : `exportAllowed(report)`.
  - **blocking** : aucun fichier. Le dialogue « Impression bloquée » indique quoi, où et comment corriger. Le bouton
    « Corriger avec la mise en page intelligente » n'applique les positions **que sur clic** ; l'utilisateur relance
    ensuite le téléchargement.
  - **warning** : export normal, le message de succès indique le nombre d'avertissements.
  - **pass** : export normal.
- La 3D seule (AR) et le partage ne sont pas des fichiers d'impression : ils ne sont pas bloqués.
- Le PDF est l'artwork de l'aperçu et de la 3D, avec la mise en page appliquée. Le preflight ne modifie pas
  l'artwork : il décide seulement si l'export est autorisé.

## 15. Interface

Le panneau « Mise en page intelligente » indique :
- **recommandation** : les éléments à repositionner ;
- **appliqué** : « Corrections appliquées — enregistrées avec le projet » ;
- la vérification avant impression : « ✓ Packaging prêt à imprimer », « ⚠ n avertissements — impression possible »
  ou « ⛔ n problèmes bloquants — le PDF d'impression ne sera pas créé » ;
- pour chaque problème : élément, cause, correction.

Composants et classes existants (`st-paywall`, `lp-btn`) : pas de nouveau design.

## 16. Performance

Preflight : 2,6 à 49 ms selon le pot et le layout (simulation de canvas). Il réutilise les éléments déjà relevés
pour l'aperçu (même débounce) ; il n'est recalculé à neuf qu'au moment d'un export.

## 17. Limites

- **Décors liés** : seuls ceux de l'emblème et du médaillon sont déclarés ; les autres (bandeaux, cadres, illustration)
  restent non contraints.
- **Liens** : un seul niveau, pas de groupes généraux.
- **Rechargement sur une autre machine** : si les polices mesurent différemment, le plan recalculé peut remplacer
  l'état enregistré dès le premier calcul.
- **Seuils** : un « Contenu net » P2 invisible n'est qu'un avertissement (P0 = code-barres et mentions, selon les
  priorités validées).
- **Mesures** : le preflight ne vérifie pas de taille minimale de code-barres (aucune règle de ce type n'existe encore
  dans le projet).
