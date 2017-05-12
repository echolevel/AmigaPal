# electangular.js

Use __electangular.js__ in your __[Electron](http://electron.atom.io/)__ apps to easily access Electron based functionality in your __[AngularJS](https://angularjs.org/)__ code.

Some additional service methods for IPC functionality are incorporated, as well as `Promise` based `dialog` module methods.

### Installation

__1. Download and move the `electangular.js` file into your Electron project.__

__2. Load the script in the main Electron `index.html` after your Angular import.__

```html
<html>
  ...

  <script src='./js/angular.min.js'></script>
  <script src='./js/electangular.js'></script> <!-- you are here -->
  <script src='./my_ng_app.js'></script>
  </body>
</html>
```

__3. Inject the module into your Angular `app` code.__

```js
'use strict';
angular.module('app', ['electangular']); // welcome to the team

...
```

### Services

The __electangular__ module exposes two public services that can be used in your Angular project.

|Name|Description|
|----|-----------|
|`electron`|A collection of Electron functionality for access within AngularJS.|
|`ipc`|Facilitates IPC communication between the `main` process and `renderer` process.|

---

#### `electron` Service

An example of using the `electron` service in an Angular controller:

```js
'use strict';
angular.module('app', ['electangular']) // don't forget electangular

.controller("MainController", ['$scope','electron',
function($scope, electron) {
  $scope.doBeep = function() {
    electron.shell.beep();
  }

  $scope.showError = function(err) {
    electron.dialog.showErrorBox('Error Title', err);
  }
}]);
```

In the code above, when the `doBeep` method is triggered, Electron will make the machine perform a system beep. When `showErrorBox` is called, a dialog box will be presented to the user.

#### API

The supported Electron modules can be found in the `electron` service namespace. Refer to the [Electron documentation](http://electron.atom.io/docs/) for more details on the functionality each module provides.

Because AngularJS runs in the `renderer` process, access to the `main` process is provided via `electron.remote` and all rules for that module apply. ([See `remote` docs.](http://electron.atom.io/docs/api/remote/))

##### Electron Module Table

|Module|Process|
|-----|-------|
|`Accelerator`|Main|
|`app`|Main|
|`autoUpdater`|Main|
|`BrowserWindow`|Main|
|`contentTracing`|Main|
|`dialog`|Main|
|`globalShortcut`|Main|
|`Menu`|Main|
|`MenuItem`|Main|
|`powerMonitor`|Main|
|`powerSaveBlocker`|Main|
|`protocol`|Main|
|`session`|Main|
|`systemPreferences`|Main|
|`Tray`|Main|
|`desktopCapturer`|Renderer|
|`webFrame`|Renderer|
|`clipboard`|Both|
|`crashReporter`|Both|
|`nativeImage`|Both|
|`process`|Both|
|`screen`|Both|
|`shell`|Both|

---

#### `dialog` Module Promises

Some Electron methods, like `dialog.showMessageBox`, use a callback. For Angular, we wrap the `$q` service to handle this properly using promises. This requires a slightly different signature for the `dialog` methods.

```js
...

.controller("MainController", ['$scope', 'electron',
function($scope, electron) {
  $scope.showMessage = function() {
    electron.dialog.showMessageBox({
      title: 'Title',
      description: 'This is some descriptive message',
      buttons: ['Cancel', 'OK'],
      cancelId: 0,
      defaultId: 1
    }).then((result) => { //Promise, not callback.
      console.log(result);
    }, () => {
      console.log('error');
    });
  }
}]);
```

The `dialog` methods use the same signature as shown in the Electron docs, except for the callback. Instead the following methods return a `Promise` when using __electangular__.

  - `showOpenDialog`
  - `showSaveDialog`
  - `showMessageBox`

Replacing callbacks with Promises is fairly simple:

```js
//Do not include a callback
dialog.showSaveDialog({ //Set up as usual
  title: 'Save Me',
  defaultPath: 'home',
  buttonLabel: 'OK'
}).then((result) => { //Op was successful
  console.log(result); //The save file path
}, () => { //Something went wrong
  console.log('oh no!');
});
```

> __Note:__ `dialog.showErrorBox` does not use a callback or `Promise`.

```js
...

.controller("MainController", ['electron',
function(electron) {
  electron.dialog.showErrorBox("Error Title", "Error Description");
}]);
```

__Window Target__

Most of the `dialog` methods allow you to optionally pass a `browserWindow` instance where the dialog should be rendered. For example, the signature for `showMessageBox`:

```js
dialog.showMessageBox([browserWindow,] options [,callback]);
```

If you do not specifically pass a window reference, then the currently focused window will render the dialog.

On OS X you can also use "sheets" by passing a `null` type to the `browserWindow` parameter:

```js
//Dialog will show as OS X sheet (Promise shown)
dialog.showMessageBox(null, options).then((result) => {
  console.log(result);
}, () => {
  console.log('error');
});
```

---

#### `ipc` Service

You can "wire" in your Angular app with the IPC (inter-process communication) system that Electron exposes using the __electangular__ `ipc` service.

An example of using the `ipc` service in an Angular controller:

```js
...

.controller("MainController", ['ipc',
function(ipc) {
  //send a message to main process
  ipc.send("Here is a message to main");
}])
```

#### Setting Up Electron

__1. Add the following to the top of your `main.js`:__

```js
...
const {ipcMain} = require('electron').ipcMain;

...
```

__2. Add the following listener to the `main.js` apps 'ready' event code:__

```js
...

app.on('ready', () => {
  ...

  ipcMain.on('electron-msg', (event, msg) => {
    //handle incoming message here
    console.log(msg);

    //message can be an Object
    if (msg.username == 'dude') {
      console.log(msg.access_level);
    }
  });
})
```

__3. Send a message from the `main` process to the `renderer`:__

```js
...

app.on('ready', () => {
  ...

  win = new BrowserWindow(...)

  //send message to renderer
  win.webContents.send('electron-msg', msg);
})
```

---

#### Setting Up Angular

When the __electangular__ module is first initialized it will broadcast incoming messages from the `main` process. You can listen for these messages, which use the Angular `$rootScope` event emitter.

An example of listening to the `main` process in a controller:

```js
'use strict';
angular.module('app', ['electangular'])

.controller("MainController", ['$rootScope',
function($rootScope) {
  $rootScope.$on('electron-msg', (event, msg) => {
    console.log(msg);
  });
}]);
```

If you prefer to handle messaging from a central location, add the listener to the `run` method of your Angular app:

```js
'use strict';
angular.module('app', ['electangular'])

.run(['$rootScope',
function($rootScope) {
  $rootScope.$on('electron-msg', (event, msg) => {
    switch (msg) { //Traffic cop
      case 'msg1':
        //do something
        break;
      case 'msg2':
        //something else
        break;
      default:
        //whatever
      }
    }
  }
}]);
```

---

__Contributions always welcome. :)__

---

electangular.js | AngularJS Module for Atom Electron | &copy;2016 develephant :elephant:
