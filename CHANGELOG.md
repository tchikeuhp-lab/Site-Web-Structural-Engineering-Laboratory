# Changelog

## 2.3.1

- Export DXF : tous les textes (dessin, cartouche, tableau) utilisent la police Arial Narrow (style `ARIAL_NARROW`, fichier `arialn.ttf`).

## 2.3.0 — Cartouche DXF normalisé

- Export DXF : cadre de feuille (ISO 5457) avec repères de centrage et de zones, cartouche ISO 7200 (logo SEL, titre, maître d'ouvrage, localisation, n° de plan, référence cadastrale, superficie, système de coordonnées, dessiné/vérifié par, date, échelle, format, indice, feuille).
- Choix automatique du plus petit format A4 à A0 et d'une échelle normalisée ; format et échelle modifiables. La feuille est tracée à l'échelle autour du dessin : coordonnées inchangées (UTM exploitables), impression 1:1 depuis le modèle.
- Textes aux hauteurs normalisées (ISO 3098), tableau des coordonnées des bornes, flèche nord, échelle graphique, calques dédiés.
- Nouveaux champs du relevé (facultatifs, conservés avec le projet) : maître d'ouvrage, localisation, n° de plan, vérifié par, indice de révision.

## 2.2.2

- GNSS : moyennage sur 30 mesures de position au lieu de 20 (fenêtre glissante, compteur « n / 30 »).

## 2.2.1

- Identité visuelle SEL : logo sur les icônes (web et Android), l'écran de démarrage et l'en-tête de la fiche de relevé.
- GNSS : fenêtre de 20 mesures, compteur « mesures de position » (fin du 30/20).
- Signature de release avec une clé SEL dédiée (secrets GitHub).

## 2.2.0 — Application Android

- Conteneur Android (Capacitor 8) : identifiant `com.structuralengineeringlabs.arpentis`, APK/AAB compilés par GitHub Actions (`.github/workflows/android.yml`).
- GNSS : plugin natif de géolocalisation sur Android (demande de permission explicite, messages d'erreur adaptés), API navigateur inchangée sur le web.
- Exports (DXF, CSV, GeoJSON, KML, sauvegardes JSON) : écriture dans le cache puis feuille de partage Android.
- Fiche de relevé : impression / PDF via le gestionnaire d'impression Android (plugin `NativePrint`).
- Bouton « retour » : ferme d'abord fenêtres et tiroirs, puis met l'application en arrière-plan.
- Aucune permission INTERNET, sauvegarde cloud Android désactivée : les données restent sur l'appareil.
- Build web inchangé ; `npm run build:android` produit la version embarquée (sans service worker).

## 2.1.0 — gestes, clavier, exports

**Canevas**
- Un tap sélectionne une borne **au relâchement** ; un glissement (même parti d'une borne) déplace seulement la vue ; un tremblement de moins de 8 px reste un tap. Aucun geste ne crée ni ne déplace de borne.
- Pincement à deux doigts : zoom et déplacement combinés, centrés sur le milieu des doigts ; le relâchement ne déclenche aucune sélection parasite.
- Boutons de zoom et molette : zoom centré (sur le curseur pour la molette).
- Clavier : flèches (déplacer), + / − (zoom), 0 (tout cadrer), Tab / Maj+Tab (parcourir les bornes), Échap, Suppr (annulable avec Ctrl+Z).
- Accessibilité : plan focalisable avec description, résumé du plan lu par les lecteurs d'écran, bandeau d'état annoncé, textes SVG et étiquettes à 10–11 px minimum.
- Barre de navigation centrée sur grand écran.

**Exports**
- DXF en coordonnées **UTM** (WGS 84, un seul fuseau par relevé, EPSG indiqué dans le fichier) pour superposer le plan à un fond SIG ou cadastral ; option dans l'écran Export, grisée pour un relevé local.
- Fiche de relevé : impression A4 vérifiée (une page, marges propres, uniquement la fiche).
- 9 tests d'export supplémentaires (DXF local / UTM, GeoJSON, KML, CSV, noms de fichier).

## 2.0.0 — application web autonome

**Calculs**
- Angles intérieurs corrigés pour les polygones saisis dans le sens anti-horaire (somme = (n−2)·180°).
- Gisement topographique (depuis le Nord, sens horaire) ajouté ; angle mathématique conservé pour le dessin.
- Triangulation : bornes alignées absorbées, plus de décomposition partielle ; contrôle croisé Gauss / Héron.
- Format agraire sans « 100.00 ca » parasite.
- Moyennage GNSS : précision rapportée prudente (jamais meilleure que le meilleur fixe ni que la dispersion observée).
- Coordonnées UTM (WGS 84) ajoutées : carnet, fiche, CSV, inspection de borne.
- Plus de relevé d'exemple parisien par défaut : projet vierge, origine ancrée sur la première borne GNSS / lat-lon, bornes à plus de 20 km refusées.
- Provenance de chaque borne (GNSS, saisie, local, forme, exemple) ; une coordonnée modifiée à la main perd sa précision GNSS.

**Données**
- IndexedDB (schéma versionné, migration depuis l'ancien localStorage), multi-relevés, import / export / sauvegarde JSON, `storage.persist()`.
- Annuler / rétablir (100 niveaux, Ctrl+Z / Ctrl+Maj+Z), suppression de borne annulable.
- Error Boundary, dialogues de confirmation accessibles (fin de `window.confirm`), champs numériques tolérant « - » et la virgule décimale.

**Web autonome**
- Retrait de Gemini, Express, dotenv, AI Studio ; polices hébergées localement ; CSP ; chemins relatifs (`BASE_PATH`) ; `npm install` sans options.
- PWA : mise à jour sur demande, icônes PNG régénérées (les précédentes étaient vides) dont une icône maskable, manifest complet.
- Simulation GNSS réservée au développement.
- Aimantation supprimée (sans objet depuis la fin de l'ajout tactile) ; boutons annuler / rétablir ; zoom molette fonctionnel ; cadrage automatique à l'ajout d'une borne.
- Exports : noms de fichier avec accents, CSV protégé contre l'injection de formule, DXF ASCII, KML sans ressource externe, GeoJSON / KML refusés pour un relevé non géoréférencé, annulation du partage sans téléchargement parasite.
- Fiche de relevé : impression A4 dédiée, gisements et UTM, date du relevé, version, avertissement de non-valeur légale.

## Non traité
Mise en page desktop avec panneaux latéraux fixes (les tiroirs sont centrés et bornés à 42 rem sur grand écran), audit d'accessibilité complet avec lecteur d'écran réel, i18n, datum cadastral local (ex. Minna).
