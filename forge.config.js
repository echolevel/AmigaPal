const path = require('path');


module.exports = {
    forge: {
      make_targets: {
        win32: [
          "squirrel"
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
        "icon": path.resolve(__dirname, 'res/Icon.icns'),
        "packageManager": "npm",
        "asar": true
      },
      electronWinstallerConfig: {
        "name": "amigapal"
      },
      electronInstallerDebian: {},
      electronInstallerRedhat: {},
      github_repository: {
        owner: "",
        name: ""
      },
      windowsStoreConfig: {
        packageName: "",
        name: "amigapal"
      }
    }
}
