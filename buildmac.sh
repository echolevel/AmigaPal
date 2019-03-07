#!/bin/bash

electron-packager . amigapal --platform=darwin --arch=x64 --overwrite
--ignore=node_modules/electron-* --asar=true --out=./release/ --icon=./icon.icns
