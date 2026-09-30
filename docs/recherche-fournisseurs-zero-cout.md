# Recherche : un rendu de niveau « designer expert » à coût zéro

> Objectif fixé : Edify doit tourner en automatique **sans dépense d'API ni d'abonnement**, avec des mockups 3D
> plus réalistes que Pacdora. Recherche faite le 30 septembre 2026 ; chaque affirmation renvoie à sa source.

## 1. Constat principal : la qualité « Pacdora » vient du rendu, pas d'une IA

Pacdora calcule ses rendus **sur ses propres serveurs** (« cloud rendering », images 4K en moins de 60 s)
[[Pacdora](https://www.pacdora.com/3d-creator), [MSB Digital](https://msbdigital.com/pacdora-review/)]. Ce sont des
serveurs GPU que Pacdora paie. Pour obtenir la même qualité **sans rien payer**, il faut faire ce calcul **sur la
carte graphique du visiteur**, dans son navigateur :

| Brique | Solution gratuite | Licence | Rôle |
|---|---|---|---|
| Rendu photoréaliste | [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) (path tracing progressif dans le navigateur, WebGL2 / WebGPU, compatible avec les matériaux Three.js déjà utilisés par Edify) | MIT | Rendu HD final : lumière, reflets et ombres physiquement exacts |
| Environnements lumineux (HDRI) et textures | [Poly Haven](https://polyhaven.com/license) | CC0 : usage commercial libre, sans attribution | Studios, lumières réalistes, surfaces (bois, béton, marbre) |
| Moteur 3D | Three.js + React Three Fiber (déjà en place) | MIT | Aperçu interactif |

**Conclusion : le chemin vers « mieux que Pacdora » à coût zéro est le moteur 3D d'Edify lui-même**
(voir `docs/audit-moteur-mockup.md`, phase 2), pas un fournisseur d'IA. C'est aussi ce qui garantit la fidélité :
le vrai design de l'utilisateur, plié sur la vraie forme, et non une image inventée par une IA.

## 2. IA : ce qui est réellement gratuit

| Fournisseur | Ce qui est gratuit | Limites réelles | Usage recommandé dans Edify |
|---|---|---|---|
| **Google Gemini** (déjà en place) | Palier gratuit sur plusieurs modèles Flash | Quotas réduits en décembre 2025, variables selon la demande ; génération d'images très limitée (≈ 2 images/min sur Imagen) [[Google](https://ai.google.dev/gemini-api/docs/rate-limits), [synthèse](https://www.aifreeapi.com/en/posts/gemini-image-generation-free-api)] | Conception du design (spec JSON), suggestions, voix : **déjà le bon choix** |
| **Cloudflare Workers AI** (déjà en place) | 10 000 neurons/jour, soit environ 45 images FLUX schnell | Remise à zéro annoncée à 00:00 UTC [[Cloudflare](https://developers.cloudflare.com/workers-ai/platform/pricing/)] ; observé épuisé à 06:45 UTC | Illustrations et décors, avec repli déterministe quand le quota est vide |
| **Puter.js** (« user-pays ») | **Le développeur ne paie rien** : chaque utilisateur consomme sur **son propre compte Puter** ; accès à des modèles haut de gamme (Nano Banana Pro, GPT Image, FLUX.2 pro) [[Puter](https://developer.puter.com/tutorials/free-unlimited-image-generation-api/)] | L'utilisateur doit se connecter à Puter. La documentation ne précise **ni** l'allocation gratuite par utilisateur **ni** les conditions commerciales : **à vérifier avant intégration** | **Option « IA premium »** facultative : un bouton pour les clients qui veulent une illustration de qualité maximale, sans coût pour Edify |
| **Pollinations.ai** | API d'images sans compte ni clé | Débit limité, aucune garantie de service, limites modifiables sans préavis ; droits commerciaux selon le modèle [[apiframe](https://apiframe.ai/blog/free-ai-image-generation-api-2026), [itsfree.dev](https://itsfree.dev/tools/pollinations-ai)] | Au mieux un repli de secours, jamais une brique centrale |
| **IA dans le navigateur (WebGPU)** | Modèles d'images qui tournent sur le GPU du visiteur (dont FLUX.2) [[Hugging Face](https://huggingface.co/collections/ryanhlewis/webgpu-browser-local-image-models)] | Téléchargements lourds (plusieurs Go), cartes graphiques récentes nécessaires : inadapté aux téléphones d'entrée de gamme | Piste expérimentale pour plus tard |

**Règle retenue** : aucun de ces paliers gratuits n'est illimité. Edify doit toujours fonctionner avec son **repli
déterministe** (designer hors ligne, illustrations et motifs procéduraux, décors studio 3D) quand un quota est
épuisé. C'est déjà le cas, et la phase 1 mesure désormais chaque repli (`ai_usage`, statut `fallback`).

## 3. Ce qui ne peut pas être strictement gratuit

- **Hébergement** : le plan gratuit de Vercel interdit l'usage commercial ; le plan gratuit de Cloudflare Workers
  limite une application à 3 Mo, trop peu pour Edify [[OpenNext](https://opennext.js.org/cloudflare),
  [cogley.jp](https://cogley.jp/articles/cloudflare-pages-to-workers-migration)]. Minimum réaliste : Cloudflare Workers
  Paid (5 $/mois) ou Vercel Pro (20 $/mois).
- **SasPay** : commission par transaction, payée par le client ou déduite, selon le réglage choisi.

Tout le reste (3D, design, PDF, codes-barres, IA en palier gratuit avec repli) peut tourner sans dépense.

## 4. Plan d'action retenu

1. **Phase 2 (moteur 3D)** : matières réalistes, finitions, géométrie détaillée, éclairage CC0, puis rendu HD par
   path tracing dans le navigateur. C'est le levier principal, et il est à coût zéro.
2. **Illustrations** : garder Cloudflare (palier gratuit) avec repli déterministe ; ajouter Puter.js en option
   « IA premium » payée par l'utilisateur, **après vérification de ses conditions**.
3. **Conception (spec JSON)** : garder Gemini (palier gratuit) ; la phase 1 mesure maintenant la qualité réelle
   (quel modèle répond, avec quels délais) pour ajuster l'ordre des modèles.
