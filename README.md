# 🎹 PianoFlow

Application web pour apprendre le piano **sans lire de partition**, façon « tutoriel YouTube » : les notes descendent depuis le haut de l'écran et viennent s'allumer sur les touches du clavier — bleu pour la main gauche, vert pour la main droite.

## ✨ Fonctionnalités

- 📁 Import **MIDI** (`.mid`, `.midi`)
- 🎤 Import **audio** (`.mp3`, `.wav`, `.ogg`, `.flac`) → transcription IA via [basic-pitch](https://github.com/spotify/basic-pitch)
- 🎼 Bibliothèque de morceaux intégrée (Au clair de la lune, Ode à la Joie, Frère Jacques)
- 🎹 Visualisation Synthesia-style sur clavier 88 touches, MG/MD codée par couleur
- ▶️ Lecture audio synchronisée (Tone.js)
- ⏯️ **Espace = play / pause**
- 🐢 Vitesse réglable (0.25x → 1.5x)
- 🎬 Export vidéo (canvas + audio → `.webm`)

## 🏛️ Architecture

Le code suit une **architecture hexagonale** (ports & adaptateurs).

```
src/
├── domain/          # Entités pures (Hand, PianoNote, Song, Keyboard) — 0 dépendance
├── application/     # Use cases (PlaybackService, RecordingService) + ports
├── infrastructure/  # Adaptateurs : Tone.js, @tonejs/midi, basic-pitch, MediaRecorder, Canvas
└── presentation/    # Vue 3 + composition root
```

Les imports vont **toujours vers l'intérieur** (`presentation → application → domain`, `infrastructure → application → domain`). Pour ajouter un nouveau format ou un nouveau moteur audio : un nouvel adaptateur, un câblage dans `composition.ts`, rien d'autre à toucher.

## 🛠️ Stack technique

| Domaine | Choix |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Langage | TypeScript |
| Build | Vite |
| UI | Tailwind v4 (dark glassmorphism) |
| Package manager | Yarn |
| Lint / Format | Biome |
| Parsing MIDI | [`@tonejs/midi`](https://github.com/Tonejs/Midi) |
| Transcription audio | [`@spotify/basic-pitch`](https://github.com/spotify/basic-pitch) (TF.js) |
| Audio | [`Tone.js`](https://tonejs.github.io/) |
| Rendu | HTML Canvas 2D |
| Versioning | semantic-release (Conventional Commits) |
| Hébergement | GitHub Pages |

## 🚀 Démarrage

```bash
yarn install      # postinstall copie le modèle basic-pitch dans public/
yarn start        # http://localhost:5173/pianoflow/
```

### Scripts

| Commande | Description |
|---|---|
| `yarn start` | Serveur de développement |
| `yarn build` | Type-check + bundle de production |
| `yarn preview` | Prévisualise le build |
| `yarn lint` | Vérification Biome |
| `yarn format` | Formate le code |
| `yarn library:gen` | Régénère les MIDI de la bibliothèque |
| `yarn setup:models` | (Re)copie les modèles ML dans `public/` |

## 🚢 Déploiement (GitHub Pages)

Le workflow `.github/workflows/release.yml` se déclenche sur chaque push sur `main` :

1. `yarn lint`
2. `semantic-release` analyse les commits et, si une version doit être publiée :
   - met à jour `CHANGELOG.md`
   - bump la version dans `package.json`
   - crée un tag `vX.Y.Z`
   - crée la GitHub Release
3. `yarn build` (avec `PIANOFLOW_BASE=/pianoflow/`)
4. Déploiement de `dist/` sur GitHub Pages

### Setup côté GitHub (à faire une fois)

1. Créer le repo `pianoflow` puis `git push -u origin main`
2. **Settings → Pages → Source : GitHub Actions**
3. **Settings → Actions → General → Workflow permissions : Read and write permissions** (pour que semantic-release puisse pousser le CHANGELOG et créer les tags)

L'application sera accessible sur `https://<utilisateur>.github.io/pianoflow/`.

### Convention de commits

Le projet suit [Conventional Commits](https://www.conventionalcommits.org/) :

- `feat:` → bump **minor** (nouvelle fonctionnalité)
- `fix:` / `perf:` → bump **patch**
- `feat!:` ou footer `BREAKING CHANGE:` → bump **major**
- `docs:` / `refactor:` / `chore:` / `ci:` / `test:` → pas de release

## 📂 Structure du domaine

| Format d'entrée | Adaptateur | Détection MG/MD |
|---|---|---|
| MIDI 2+ pistes | `MidiSongParser` | Piste de hauteur moyenne la plus grave → MG |
| MIDI 1 piste | `MidiSongParser` | Split par hauteur (< Do central → MG) |
| Audio (mp3/wav/...) | `BasicPitchAudioParser` | Split par hauteur |

## 🎨 Code de couleurs

| Couleur | Signification |
|---|---|
| 🟦 Bleu | Main gauche |
| 🟩 Vert | Main droite |
| 🔴 Ligne rouge | Ligne de frappe (les notes y arrivent au bon moment) |
| 🔴 Point rouge sous le Do central | Repère C4 |

## 📄 Licence

Projet personnel — usage libre.
