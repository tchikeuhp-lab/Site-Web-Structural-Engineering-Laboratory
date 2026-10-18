# Arpentis — calcul de superficies et métré de parcelles

Application web **autonome** (PWA) : tracé d'une parcelle à partir de ses bornes, superficie (formule de Gauss, contrôle croisé par triangulation de Héron), périmètre, cotes, gisements, angles intérieurs, acquisition GNSS, coordonnées WGS84 et UTM, exports DXF / GeoJSON / KML / CSV et fiche de relevé A4 (PDF par impression).

Aucun serveur, aucune clé d'API, aucun service tiers : l'application est un site statique. Une fois chargée une première fois, elle fonctionne **hors ligne**, et les relevés restent sur l'appareil (IndexedDB).

## Démarrage

```bash
npm install
npm run dev        # développement sur http://localhost:3000
npm test           # tests unitaires (calculs, UTM, stockage, historique)
npm run build      # typecheck strict + build dans dist/
npm run preview    # sert dist/ sur http://localhost:4173
```

Node ≥ 20.19.

## Déploiement

`dist/` est un site statique : copiez-le sur n'importe quel hébergeur **en HTTPS** (le GPS du navigateur l'exige).

- Les chemins sont relatifs : le site fonctionne à la racine d'un domaine comme dans un sous-dossier. Pour imposer une base absolue : `BASE_PATH=/arpentis/ npm run build`.
- `public/_headers` (Netlify, Cloudflare Pages) applique la CSP et les en-têtes de sécurité ; la CSP est aussi injectée dans `index.html` au build.
- Autres hébergeurs : reproduire ces en-têtes, et servir `index.html`, `sw.js` et `manifest.webmanifest` avec `Cache-Control: no-cache`.
- Nginx (exemple) :

  ```nginx
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
  add_header Permissions-Policy "geolocation=(self), camera=(), microphone=()" always;
  location = /sw.js { add_header Cache-Control "no-cache"; }
  ```

## Mise en ligne sur GitHub Pages

1. Créez un dépôt GitHub et poussez ce projet sur la branche `main` :
   ```bash
   git remote add origin https://github.com/<compte>/<depot>.git
   git push -u origin main
   ```
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Chaque `push` sur `main` lance `.github/workflows/deploy.yml` (tests, build, publication). Le site est servi en HTTPS sur `https://<compte>.github.io/<depot>/` — le GPS du navigateur y fonctionne.

`.github/workflows/ci.yml` exécute tests et build sur les autres branches et les pull requests.
GitHub Pages ne permet pas de définir des en-têtes HTTP : la CSP est donc portée par la balise `<meta>` injectée dans `index.html` au build (le fichier `public/_headers` ne sert que sur Netlify / Cloudflare Pages).

## Commandes du plan

Tactile : un doigt glisse = déplacer la vue, tap sur une borne = l'inspecter, deux doigts = zoom. Aucun geste ne crée ni ne déplace de borne (ajout par le bouton « + »). Clavier : flèches, `+` / `−`, `0` (tout cadrer), `Tab` (parcourir les bornes), `Suppr`, `Ctrl+Z` / `Ctrl+Maj+Z`.

## Données et sauvegardes

- Stockage : IndexedDB (schéma versionné, migration automatique de l'ancien `localStorage`), plusieurs relevés, annuler / rétablir (100 niveaux).
- **Sauvegarde** : bouton « Mes relevés » → *Sauvegarder ce relevé* / *Tout sauvegarder* (JSON) ; *Importer* pour restaurer. Le navigateur peut purger les données d'un site en cas de manque d'espace : sauvegardez régulièrement.

## Conventions de calcul

| Sujet | Convention |
|---|---|
| Repère | Plan tangent local (ENU) ancré sur la première borne GNSS/lat-lon. Un relevé saisi en X/Y reste **local** (non géoréférencé : pas d'export SIG). |
| Distance maximale | 20 km autour de l'origine ; au-delà la borne est refusée (le plan tangent n'est plus fiable). |
| Superficie | Formule de Gauss dans le repère local ; contrôle : somme des triangles de Héron. |
| Gisement | Depuis le Nord, sens horaire (0–360°). |
| DXF | Repère local par défaut ; option UTM (X = Est, Y = Nord) pour un relevé géoréférencé. |
| Angle intérieur | Indépendant du sens de saisie des bornes. |
| UTM | WGS 84 / UTM (EPSG:326xx), séries de Krüger. Cameroun : fuseaux 32N et 33N. Le datum cadastral local (ex. Minna) est à confirmer avec le service du cadastre. |
| Précision GNSS | Jamais meilleure que le meilleur fixe déclaré par le récepteur ni que la dispersion observée (les fixes successifs sont corrélés). Une coordonnée modifiée à la main perd sa précision GNSS. |

La fiche de relevé est **indicative** : elle ne remplace pas un bornage ou un levé établi par un géomètre agréé.

## Structure

```
src/utils/      calculs (géométrie, WGS84/ENU, UTM), exports, téléchargement
src/storage/    IndexedDB, validation, migration, import/export JSON
src/state/      historique annuler / rétablir
src/components/ interface (canevas, tiroirs, modales)
```

## Application Android

Voir [README-ANDROID.md](README-ANDROID.md) : APK compilé par GitHub Actions, signature, développement local.
