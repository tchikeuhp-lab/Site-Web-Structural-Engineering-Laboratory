# Changelog

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
