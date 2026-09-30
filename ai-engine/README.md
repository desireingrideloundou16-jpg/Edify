# ai-engine — EXPÉRIMENTAL, NON DÉPLOYÉ

> ⚠️ Ce dossier **n'est pas utilisé par Edify** et **ne doit pas être déployé** en l'état.
> Aucun fichier de l'application (`src/`) ne l'appelle. Il est exclu du déploiement Vercel
> (`.vercelignore`).

## Ce que c'est

Un serveur Python (FastAPI) qui génère des textures de packaging avec
**Stable Diffusion 1.5 + ControlNet Lineart**, guidées par un gabarit de découpe (dieline).

| Endpoint | Méthode | Accès |
|---|---|---|
| `/health` | GET | public, renvoie seulement `online` / `degraded` |
| `/api/v1/generate-texture` | POST | **jeton obligatoire** (`Authorization: Bearer <EDIFY_AI_ENGINE_TOKEN>`) |

Dépendances : voir `requirements.txt` (torch, diffusers, transformers…). Les modèles
(`runwayml/stable-diffusion-v1-5`, `lllyasviel/control_v11p_sd15_lineart`) sont téléchargés
depuis Hugging Face au démarrage (plusieurs Go).

## Verrous de sécurité intégrés

- **Refuse de démarrer** sans `EDIFY_AI_ENGINE_TOKEN` (32 caractères minimum).
- Écoute **uniquement en local** (`127.0.0.1`) par défaut (`EDIFY_AI_ENGINE_HOST` pour changer).
- **CORS fermé** : aucun site ne peut l'appeler depuis un navigateur, sauf origines listées dans
  `EDIFY_AI_ENGINE_ORIGINS` (séparées par des virgules). Usage prévu : serveur à serveur.
- Tailles d'image bornées (256 à 1024 px, multiples de 8), prompt limité à 1 000 caractères.
- Erreurs génériques côté client (détails uniquement dans les logs du serveur).

## Pourquoi il n'est pas déployé

- Il faut un **GPU** (CUDA) : sur CPU, une image prend plusieurs minutes. Vercel ne peut pas
  l'héberger (pas de GPU, pas de serveur Python persistant).
- Le filtre de contenu de Stable Diffusion est **désactivé** (`safety_checker=None`).
- Aucune limite de débit, aucun suivi des coûts, aucune file d'attente.

## Conditions avant tout déploiement futur

1. Héberger sur une machine GPU dédiée (RunPod, Modal, Replicate, serveur maison…), **jamais**
   exposée directement sur Internet : derrière un proxy HTTPS, appelée uniquement par le
   serveur Edify (routes `/api/*`), jamais par le navigateur.
2. Générer un jeton long et aléatoire, le stocker côté Edify (variable d'environnement serveur,
   jamais `NEXT_PUBLIC_*`) et sur la machine GPU.
3. Réactiver un filtre de contenu (ou modérer les prompts côté Edify avant l'appel).
4. Passer par la future passerelle IA d'Edify (quota, crédits, journal des coûts, kill switch)
   — voir l'audit, phases 2 à 4.
5. Ajouter une limite de débit et une file d'attente (une génération GPU à la fois par carte).

## Lancer en local (tests uniquement)

```bash
cd ai-engine
python -m venv .venv && . .venv/bin/activate   # Windows : .venv\Scripts\activate
pip install -r requirements.txt
export EDIFY_AI_ENGINE_TOKEN="$(python -c 'import secrets; print(secrets.token_hex(32))')"
python main.py            # écoute sur http://127.0.0.1:8000
```
