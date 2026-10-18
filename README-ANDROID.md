# Arpentis — application Android

L'application Android est la même application web, embarquée dans un conteneur [Capacitor](https://capacitorjs.com) :
tout fonctionne hors ligne, les relevés restent sur l'appareil (aucune permission INTERNET, pas de sauvegarde cloud Android).

- Identifiant : `com.structuralengineeringlabs.arpentis` · Android 7.0+ (minSdk 24)
- Spécifique à Android : GPS natif, export par feuille de partage, impression PDF native, bouton « retour »

## Obtenir l'APK (sans rien installer)

1. Poussez le dépôt sur GitHub : le workflow **Android** se lance tout seul.
2. Onglet **Actions → Android → dernier run → Artifacts → `arpentis-debug-apk`**.
3. Copiez l'APK sur le téléphone, ouvrez-le et autorisez l'installation depuis cette source.

L'APK « debug » sert aux essais. Pour distribuer ou publier, utilisez la version signée ci-dessous.

## Version signée (release APK + AAB pour le Play Store)

1. Créez une clé de signature **une seule fois** et conservez-la précieusement (la perdre interdit toute mise à jour) :
   ```bash
   keytool -genkeypair -v -keystore arpentis.jks -alias arpentis -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 arpentis.jks > keystore.b64   # macOS : base64 -i arpentis.jks
   ```
2. Dans GitHub : **Settings → Secrets and variables → Actions**, créez :
   `ANDROID_KEYSTORE_BASE64` (contenu de `keystore.b64`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`arpentis`), `ANDROID_KEY_PASSWORD`.
3. Publiez : `git tag v2.2.0 && git push origin v2.2.0`. Le workflow signe, puis attache l'APK et l'AAB à une release GitHub.

Ne commitez jamais le fichier `.jks` (déjà ignoré par `.gitignore`).

## Développer en local

Prérequis : Node 22, JDK 21, Android Studio (SDK 36).

```bash
npm ci
npm run android:sync     # build web (mode android) + copie dans android/
npm run android:open     # ouvre Android Studio, puis Run ▶
```

Après toute modification du code web, relancez `npm run android:sync`.
Icônes et écran de démarrage : modifiez `assets/*.png` puis `npm run android:assets`.

## Si l'application vit dans un sous-dossier d'un dépôt (ex. `sel-apps/arpentis`)

Les workflows doivent se trouver à la racine du dépôt (`.github/workflows/`). Dans `android.yml`, passez `APP_DIR: arpentis`
et ajoutez un filtre `paths: ['arpentis/**']` sous `push` et `pull_request`.

## À vérifier sur un vrai téléphone (la compilation a lieu sur GitHub, pas dans l'environnement de développement)

- [ ] Installation, icône, écran de démarrage
- [ ] Bouton GPS : boîte de permission, puis relevé moyenné avec précision affichée
- [ ] Mode avion : création de bornes, calcul, redémarrage de l'application, données conservées
- [ ] Export DXF / CSV / GeoJSON / KML : feuille de partage, enregistrement dans Fichiers ou Drive
- [ ] Sauvegarde JSON puis import dans un second relevé
- [ ] Fiche de relevé : Imprimer → « Enregistrer au format PDF »
- [ ] Bouton retour (fenêtre ouverte → fermée ; sur le canevas → l'application passe en arrière-plan)
- [ ] Rotation de l'écran, verrouillage / déverrouillage pendant un relevé GPS

## Limites connues

- Le GPS d'un téléphone donne typiquement 3 à 5 m de précision : la fiche garde sa mention « sans valeur légale ».
- Si l'utilisateur vide les données de l'application dans Android, les relevés sont perdus : faites des sauvegardes JSON régulières.
