const path = require('path');


module.exports = {
    forge: {
      make_targets: {
        win32: [
          //"squirrel"
          "zip"
        ],
        darwin: [
          "zip"
        ],
        linux: [
          "deb",
          "rpm"
        ]
      },
      electronPackagerConfig: {
        "icon": path.resolve(__dirname, '/res/Icon.icns'),
        "icon": "./res/Icon.icns",
        "packageManager": false,
        "asar": true
      },
      /*
      electronWinstallerConfig: {
        "name": "AmigaPal",
        "authors": "Brendan Ratliff",
        "description": "Amiga 8svx sample converter",
        "exe": "AmigaPal.exe"
      },*/
      electronInstallerDebian: {},
      electronInstallerRedhat: {},
      github_repository: {
        owner: "Echolevel",
        name: "AmigaPal"
      },
      windowsStoreConfig: {
        packageName: "amigapal",
        name: "AmigaPal"
      }
    }
}
