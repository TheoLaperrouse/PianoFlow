# 🎹 PianoFlow

Application web pour apprendre le piano **sans lire de partition**, façon « tutoriel YouTube » : les notes descendent depuis le haut de l'écran et viennent s'allumer sur les touches du clavier — bleu pour la main gauche, vert pour la main droite.

Inspiré de Synthesia / piano tutorials, conçu pour les débutants qui veulent jouer rapidement sans passer par le solfège.

## ✨ Fonctionnalités (MVP)

- 📁 Import de fichiers **MIDI** (`.mid`, `.midi`)
- 🎼 Visualisation **falling-notes** sur clavier 88 touches
- 🖐️ Détection automatique main gauche (bleu) / main droite (vert) à partir des pistes MIDI
- ▶️ Lecture audio synchronisée (Tone.js)
- ⏯️ Contrôles : play / pause / rejouer
- 🐢 Vitesse réglable (0.25x → 1.5x)
- 🔭 Anticipation visuelle ajustable (1s → 6s)

## 🛠️ Stack technique

| Domaine | Choix |
|---|---|
| Framework | **Vue 3** + Composition API (`<script setup>`) |
| Langage | **TypeScript** |
| Build | **Vite** |
| Package manager | **Yarn** |
| Lint / Format | **Biome** |
| Parsing MIDI | [`@tonejs/midi`](https://github.com/Tonejs/Midi) |
| Audio | [`Tone.js`](https://tonejs.github.io/) |
| Rendu | HTML Canvas 2D |

## 🚀 Démarrage

```bash
yarn install
yarn dev
```

L'app est ensuite accessible sur `http://localhost:5173`.

### Scripts disponibles

| Commande | Description |
|---|---|
| `yarn dev` | Lance le serveur de développement |
| `yarn build` | Build de production (vérifie les types + bundle) |
| `yarn preview` | Prévisualise le build de prod |
| `yarn lint` | Vérifie le code avec Biome |
| `yarn format` | Formate le code avec Biome |

## 📂 Structure

```
src/
├── App.vue              # UI principale (toolbar + canvas)
├── main.ts              # Bootstrap Vue
├── styles.css           # Styles globaux
└── piano/
    ├── keyboard.ts      # Géométrie du clavier 88 touches
    ├── midiLoader.ts    # Parsing MIDI + détection des mains
    ├── renderer.ts      # Rendu Canvas (notes qui tombent + clavier)
    └── audio.ts         # Lecture audio via Tone.js
```

## 🗺️ Roadmap

- [ ] Support **MusicXML** (via `opensheetmusicdisplay` ou conversion MIDI)
- [ ] Choix manuel des pistes main gauche / main droite
- [ ] Sampler de piano réaliste (Salamander Grand) plutôt que synth
- [ ] Mode entraînement : pause à chaque note tant qu'elle n'est pas jouée (clavier MIDI USB)
- [ ] Export d'une **vidéo** (MediaRecorder)
- [ ] Import audio (MP3/WAV) → MIDI via [`basic-pitch`](https://github.com/spotify/basic-pitch) (TensorFlow.js)
- [ ] Bibliothèque de morceaux intégrée

## 📝 Format MIDI attendu

- Idéalement : **2 pistes** (typiquement piste 0 = main droite, piste 1 = main gauche). PianoFlow attribue automatiquement la piste la plus grave à la main gauche.
- En cas d'une seule piste : split par hauteur (notes < Do central → main gauche).

## 🎨 Code de couleurs

| Couleur | Signification |
|---|---|
| 🟦 Bleu | Main gauche |
| 🟩 Vert | Main droite |
| 🔴 Ligne rouge | Ligne de frappe (les notes y arrivent au bon moment) |
| 🔴 Point rouge sous le Do central | Repère C4 |

## 📄 Licence

Projet personnel — usage libre.
