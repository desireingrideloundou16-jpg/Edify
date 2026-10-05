# Phase 2C-4D-2 — patron de la barquette

> **Construction de référence** (voir [tray-construction.md](tray-construction.md)) : plateau rectangulaire à coins
> collés. Le patron est celui de **cette** barquette, pas celui de toutes les barquettes industrielles.

## Statut

| id | Modèle | Patron |
|---|---|---|
| `food-tray` (Barquette) | `tray` | **supporté** (`template: "gluedCornerTray"`) |
| `display-box` (Présentoir) | `display` | non supporté, refus propre |
| `egg-carton` (Boîte à œufs) | `moulded` | non supporté : « Pulpe moulée : … pas de patron de découpe à plat » |
| `pizza-box`, `burger-box` | `pizza`, `clamshell` | non supportés, inchangés |

Il reste 20 formats non supportés au catalogue.

## Développement

```
assembly (trayProfile.ts, 9 pièces, 8 plis)
   ↓  foldedSheet(parts, folds, TRAY_ROOT)        (dieline.ts, partagé avec la boîte postale)
   ↓  developAssembly                              (develop.ts, inchangé pour le déroulé)
panneaux + plis (hinges) + contour (rectUnionOutline) + fentes (contactSlits) + colle (glueContacts)
   ↓  layoutFromStructure → aperçu (drawDieline) et PDF (exportPrintPdf) : le même FlatLayout
```

- **Racine** : `bottom`, vu de dessous (côté imprimé), avant en haut. C'est la convention de la boîte postale et du
  fond du coffret rigide (`TRAY_ROOT`).
- **Disposition** (180 × 120 × 40, carton alimentaire, t = 0,45 mm) : feuille de **259,1 × 199,1 mm**.

```
          patte ┌──────── avant ────────┐ patte
                │      (à l'endroit)     │
   ┌──── gauche ┼───────── fond ─────────┼ droit ────┐
   │  (270°)    │                        │   (90°)   │
   └────────────┼────────────────────────┼───────────┘
          patte │      dos (180°)        │ patte
                └────────────────────────┘
```

- **Panneaux** : 9, un par pièce, aux dimensions de la 3D.
  - fond : 179,1 × 119,1 mm ;
  - avant et dos : 179,1 × 40 mm ;
  - côtés : 120 × 40 mm ;
  - pattes : 13,8 × 39,55 mm (la longueur de patte vient de la construction).
- **Plis** : 8, un par pli de l'assemblage (4 fond → paroi, 4 paroi → patte), sur les frontières communes et à la
  longueur des arêtes 3D. Ils sont aussi exposés en `hinges` (plis « montagne » vus du côté imprimé).
- **Contour** : un seul, fermé et simple (12 sommets). Son aire égale la somme des panneaux : il n'y a ni trou ni
  seconde pièce.
- **Fentes** : 8, produites par `contactSlits`. À chaque coin, une fente sépare la patte du côté voisin, et une
  autre sépare la paroi (avant ou dos) du côté, sur la longueur t. Toute longueur de contact entre deux panneaux
  est soit un pli, soit une fente.

## Colle

`glueZones` est une nouvelle primitive générique de `PackagingStructure`, produite par `foldedSheet` à partir de
`AssemblyPart.glueTo`. Pour chaque pièce collée, elle donne :
- le panneau qui la porte ;
- la pièce sur laquelle elle est collée ;
- le **côté de la feuille** (`outer` = côté imprimé, `inner` = revers) ;
- le polygone.

- **Zone** : c'est l'intersection réelle des deux faces en contact dans l'assemblage. Pour cette construction,
  chaque patte est plaquée sur toute sa surface contre le côté, si bien que la zone couvre la patte entière. C'est
  le contact calculé, pas un choix.
- **Côté** : `outer`, la face imprimée de la patte. Une fois pliée, elle est tournée vers le côté. Ce sens se
  calcule par `outerNormal` (`develop.ts`), qui sert aussi de garde-fou contre tout patron en miroir.
- **Rendu** : aplat et hachures gris ardoise (slate de l'interface) dans l'aperçu, avec « Colle » dans la légende ;
  aplat gris et contour dans la page 2 du PDF, avec la mention dans la légende du PDF.
- **Anciens gabarits** : les polygones `glue` historiques de l'étui et de la brique **ne sont pas** dessinés, pour
  que leurs patrons restent strictement inchangés.

## Surfaces et rotations

| Surface | Panneau | Rotation à plat | Contrôle |
|---|---|---|---|
| `front` | avant | 0° | bas de l'illustration sur le pli fond/avant |
| `back` | dos | 180° | idem, pli fond/dos |
| `left` | côté gauche | 270° | idem, pli fond/gauche |
| `right` | côté droit | 90° | idem, pli fond/droit |
| `bottom` | fond | 0° | haut de l'illustration sur le pli fond/avant (UV : haut vers l'avant) |

- `top` est absent.
- Les rotations sont calculées depuis les UV de la 3D (`FACE_UP`), par la même fonction que pour la boîte postale
  (`assemblySurfaces`).
- Aucun miroir : la face vue à plat est la face imprimée de la 3D (`outerNormal`, testé).

## Fond perdu et PDF

- Le fond perdu (3 mm) s'ajoute **autour** de la feuille, sans changer les panneaux.
- Le PDF reçoit la matière (correctif de 2C-4C) et produit exactement le patron de l'aperçu. Un test vérifie que
  le patron change avec la matière.
- Page : 301,1 × 241,1 mm (feuille + 2 × 3 + 2 × 18 mm).

## Limites (non traitées dans cette phase)

- Pattes rectangulaires, sans chanfrein. Leur longueur reprend une hypothèse de 2C-4D-1.
- Pli vif : pas de compensation d'épaisseur, ni de rayon de pli, ni de compensation d'écrasement.
- La colle couvre toute la face de contact : il n'y a pas de marge ni de motif de dépose, qui sont des choix de
  fabrication.
- Pas d'impression intérieure.
- Pas de variantes de coins, de soufflets, de parois évasées ni de verrouillage.
- Les zones de colle de l'étui et de la brique ne sont pas encore dessinées.
