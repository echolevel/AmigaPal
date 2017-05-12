// electangular test
'use strict';
angular.module('app', ['electangular'])

.controller("MainController", ['$rootScope', '$scope', 'electron', 'ipc',
function($rootScope, $scope, electron, ipc) {
  $rootScope.$on('electron-msg', (event, msg) => {
    console.log('in renderer-> ' + msg);
  });


  $scope.showErrorBox = function() {
    electron.dialog.showErrorBox('Error Title', 'You totally screwed up.');
  }

  $scope.showOpenDialog = function() {
    electron.dialog.showOpenDialog(null, {
      title: 'Open Me',
      defaultPath: '/',
      properties: ['openFile']
    }).then((result) => {
      console.log(result);
    }, () => {
      console.log('canceled');
    });
  }

  $scope.showSaveDialog = function() {
    electron.dialog.showSaveDialog({
      title: 'Save It',
      defaultPath: "/",
      buttonLabel: 'OK'
    }).then((result) => {
      console.log(result);
    }, () => {
      console.log('canceled');
    });
  };

  //msg model
  $scope.msg = {
    title: "",
    message: ""
  }

  $scope.showMessageBox = function(msg) {
    electron.dialog.showMessageBox({
      type: 'info',
      title: msg.title,
      message: msg.title,
      detail: msg.message,
      buttons: ['OK', 'Nope'],
      cancelId: 1,
      defaultId: 0
    }).then((result) => {
      console.log(result);
    }, () => {
      console.log('canceled');
    });
  };

  $scope.doSomething = function() {
    ipc.send('Muggles');
  }
}]);
