import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function patchGradleFile(relativePath, transforms) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return false;

  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  for (const [pattern, replacement] of transforms) {
    content = content.replace(pattern, replacement);
  }

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`[gradle-9.3.1] Patched ${relativePath}`);
    return true;
  }
  return false;
}

patchGradleFile('android/capacitor-cordova-android-plugins/build.gradle', [
  [/com\.android\.tools\.build:gradle:[0-9.]+/g, 'com.android.tools.build:gradle:9.1.1'],
  [/\bminSdkVersion\s+([^\n]+)/g, 'minSdk = $1'],
  [/\btargetSdkVersion\s+([^\n]+)/g, 'targetSdk = $1'],
  [/\bversionCode\s+([0-9]+)/g, 'versionCode = $1'],
  [/\bversionName\s+("[^"]+")/g, 'versionName = $1'],
  [/\blintOptions\s*\{/g, 'lint {'],
  [/\bsourceCompatibility\s+JavaVersion\.VERSION_([0-9_]+)/g, 'sourceCompatibility = JavaVersion.VERSION_$1'],
  [/\btargetCompatibility\s+JavaVersion\.VERSION_([0-9_]+)/g, 'targetCompatibility = JavaVersion.VERSION_$1'],
]);

patchGradleFile('node_modules/@capacitor/android/capacitor/build.gradle', [
  [/com\.android\.tools\.build:gradle:[0-9.]+/g, 'com.android.tools.build:gradle:9.1.1'],
  [/\bminSdkVersion\s+([^\n]+)/g, 'minSdk = $1'],
  [/\btargetSdkVersion\s+([^\n]+)/g, 'targetSdk = $1'],
  [/\bversionCode\s+([0-9]+)/g, 'versionCode = $1'],
  [/\bversionName\s+("[^"]+")/g, 'versionName = $1'],
  [/\blintOptions\s*\{/g, 'lint {'],
  [/\bbaseline\s+file\(/g, 'baseline = file('],
  [/\bsourceCompatibility\s+JavaVersion\.VERSION_([0-9_]+)/g, 'sourceCompatibility = JavaVersion.VERSION_$1'],
  [/\btargetCompatibility\s+JavaVersion\.VERSION_([0-9_]+)/g, 'targetCompatibility = JavaVersion.VERSION_$1'],
]);
