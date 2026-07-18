/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.habittracker.app',
  productName: 'Habit Tracker',
  directories: {
    output: 'release',
    buildResources: 'buildResources',
  },
  files: [
    'dist-electron/**/*',
    'out/**/*',
    'data/**/*',
    'node_modules/**/*',
    'package.json',
  ],
  // Ensure native modules are rebuilt for the correct Electron version
  npmRebuild: true,
  extraResources: [
    { from: 'data/', to: 'data/', filter: ['**/*'] },
  ],
  win: {
    target: ['nsis'],
    icon: 'buildResources/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
  mac: {
    target: ['dmg'],
    icon: 'buildResources/icon.icns',
  },
  linux: {
    target: ['AppImage'],
    icon: 'buildResources/icon.png',
  },
}
