#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const appName = process.argv[2];

function checkAppExists() {
  const appPath = path.join('apps', appName);
  if (fs.existsSync(appPath)) {
    console.error(`❌ An app with the name "${appName}" already exists at apps`);
    process.exit(1); // stop the script
  }
}

checkAppExists();

const rootPackageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(rootPackageJsonPath)) {
  console.error('No package.json found at the root. Are you in an Nx workspace?');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));

// Packages we need
const runtimeDeps = ['quasar', '@quasar/extras'];
const devDeps = ['@quasar/vite-plugin', 'sass-embedded@^1.80.2'];

// Helper to check if a package is installed
function getPkgName(pkg) {
  // Remove version info if present, e.g. "sass-embedded@^1.80.2" => "sass-embedded"
  return pkg.split('@')[0] || pkg;
}

function isInstalled(pkg) {
  const name = getPkgName(pkg);
  return (
    (packageJson.dependencies && packageJson.dependencies[name]) ||
    (packageJson.devDependencies && packageJson.devDependencies[name])
  );
}

// Install missing runtime dependencies
const missingRuntimeDeps = runtimeDeps.filter(dep => !isInstalled(dep));
if (missingRuntimeDeps.length > 0) {
  console.log(`📦 Installing runtime dependencies: ${missingRuntimeDeps.join(', ')}`);
  execSync(`yarn add -W ${missingRuntimeDeps.join(' ')}`, { stdio: 'inherit' });
} else {
  console.log('🔹 All runtime dependencies already installed.');
}

// Install missing dev dependencies
const missingDevDeps = devDeps.filter(dep => !isInstalled(dep));
if (missingDevDeps.length > 0) {
  console.log(`📦 Installing dev dependencies: ${missingDevDeps.join(', ')}`);
  execSync(`yarn add -D -W ${missingDevDeps.join(' ')}`, { stdio: 'inherit' });
} else {
  console.log('🔹 All dev dependencies already installed.');
}

// Creating NX app
if (!appName) {
  console.error('Usage: node create-quasar-app.js <app-name>');
  process.exit(1);
}

// Step 1: Generate Nx Vue 3 app
console.log(`Generating Nx Vue 3 app: ${appName}...`);
function generateNxVueApp() {
  const command = `yarn nx g @nx/vue:app apps/${appName} ` +
    '--style=scss ' +
    '--bundler=vite ' +
    '--routing=true ' +
    '--linter=eslint ' +
    '--unitTestRunner=none ' +
    '--e2eTestRunner=none ' +
    '--interactive=false';

  console.log(`📦 Generating Nx Vue 3 app: ${appName}...`);
  execSync(command, { stdio: 'inherit' });
  console.log(`✅ Nx Vue app "${appName}" created.`);
}
generateNxVueApp();

// Step 2: Modifications to NX initial app so quasar can work
function addQuasarToMainTs() {
  const mainTsPath = path.join('apps', appName, 'src', 'main.ts');

  if (!fs.existsSync(mainTsPath)) {
    console.error(`❌ main.ts not found at ${mainTsPath}`);
    return;
  }

  let content = fs.readFileSync(mainTsPath, 'utf8');

  // Add Quasar import if not already present
  if (!content.includes("import { Quasar } from 'quasar'")) {
    content = content.replace(
      /import { createApp } from 'vue';/,
      "import { createApp } from 'vue';\nimport { Quasar } from 'quasar';"
    );
  }

  // Add Quasar extras and CSS imports after imports
  if (!content.includes("@quasar/extras/material-icons/material-icons.css")) {
    content = content.replace(
      /(import { Quasar } from 'quasar';)/,
      `$1\nimport '@quasar/extras/material-icons/material-icons.css';\nimport 'quasar/src/css/index.sass';`
    );
  }

  // Add app.use(Quasar, {...}) before app.mount()
  if (!content.includes('app.use(Quasar')) {
    content = content.replace(
      /(app.mount\('#.*'\))/,
      `app.use(Quasar, {\n  plugins: {}, // import Quasar plugins here\n});\n$1`
    );
  }

  fs.writeFileSync(mainTsPath, content, 'utf8');
  console.log(`✅ Quasar added to main.ts in ${appName}`);
}

addQuasarToMainTs();

function addQuasarToViteConfig() {
  const viteConfigPath = path.join('apps', appName, 'vite.config.ts');

  if (!fs.existsSync(viteConfigPath)) {
    console.error(`❌ vite.config.ts not found at ${viteConfigPath}`);
    return;
  }

  let content = fs.readFileSync(viteConfigPath, 'utf8');

  // 1️⃣ Add imports if not present
  if (!content.includes("@quasar/vite-plugin")) {
    content = content.replace(
      /(import vue from '@vitejs\/plugin-vue';)/,
      `$1\nimport { quasar, transformAssetUrls } from '@quasar/vite-plugin';\nimport { fileURLToPath } from 'node:url';`
    );
  }

  // 2️⃣ Update vue() plugin to include transformAssetUrls
  content = content.replace(
    /vue\(\)/,
    `vue({ template: { transformAssetUrls } })`
  );

  // 3️⃣ Add quasar() plugin if not present
  if (!content.includes('quasar(')) {
    content = content.replace(
      /(plugins:\s*)\[(.*?)\]/s, // match plugins: [ ... ]
      (match, p1, p2) => {
        // Keep existing plugins in a new line format, append quasar plugin
        const plugins = p2
          .split(',')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => `    ${line}`) // indent 4 spaces
          .join(',\n');

        const quasarPlugin = `    quasar({\n      sassVariables: fileURLToPath(new URL('./src/quasar-variables.scss', import.meta.url))\n    })`;

        return `${p1}[\n${plugins},\n${quasarPlugin}\n  ]`;
      }
    );
  }

  fs.writeFileSync(viteConfigPath, content, 'utf8');
  console.log(`✅ Quasar added to vite.config.ts in ${appName}`);

  // 4️⃣ Create src/quasar-variables.sass if not exists
  const quasarVarsPath = path.join('apps', appName, 'src', 'quasar-variables.scss');
  if (!fs.existsSync(quasarVarsPath)) {
    const quasarVarsContent = `$primary: #1976D2;\n$secondary: #26A69A;\n$accent: #9C27B0;\n$dark: #1D1D1D;\n$positive: #21BA45;\n$negative: #C10015;\n$info: #31CCEC;\n$warning: #F2C037;`;
    fs.writeFileSync(quasarVarsPath, quasarVarsContent, 'utf8');
    console.log(`✅ Created quasar-variables.sass in ${appName}/src`);
  }
}

addQuasarToViteConfig()