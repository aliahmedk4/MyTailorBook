# Hadaya — Android Build & Release Guide

---

## 1. Build & Sync

```bash
ionic build --prod
ionic cap sync android
```

---

## 2. Debug APK

```bash
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 3. Generate Release Keystore

Run once and keep the `.keystore` file safe — never commit it.

```bash
keytool -genkey -v -keystore my-release-key.keystore -alias myalias -keyalg RSA -keysize 2048 -validity 10000
```

Move the generated file into the `android/` folder:

```
android/my-release-key.keystore
```

---

## 4. Add Signing Config to `android/gradle.properties`

Append these lines to `android/gradle.properties`:

```
MYAPP_UPLOAD_STORE_FILE=my-release-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=myalias
MYAPP_UPLOAD_STORE_PASSWORD=yourpassword
MYAPP_UPLOAD_KEY_PASSWORD=yourpassword
```

---

## 5. Update `android/app/build.gradle`

Add the following at the **very top** of the file, before the `android {}` block:

```groovy
import java.util.Properties
import java.io.FileInputStream

def keystorePropertiesFile = rootProject.file("gradle.properties")
def keystoreProperties = new Properties()

if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Then inside the `android {}` block, add a `signingConfigs` and wire it to the `release` build type:

```groovy
android {

    signingConfigs {
        release {
            storeFile file(keystoreProperties['MYAPP_UPLOAD_STORE_FILE'])
            storePassword keystoreProperties['MYAPP_UPLOAD_STORE_PASSWORD']
            keyAlias keystoreProperties['MYAPP_UPLOAD_KEY_ALIAS']
            keyPassword keystoreProperties['MYAPP_UPLOAD_KEY_PASSWORD']
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## 6. Build Release APK

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## Notes

- Never commit `my-release-key.keystore` or passwords to version control
- Add to `.gitignore`:
  ```
  android/my-release-key.keystore
  ```
