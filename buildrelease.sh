#!/bin/bash

electron-packager . amigapal --all --overwrite --ignore=node_modules/electron-* --asar=true --out=./release/ --icon=./icon.icns
