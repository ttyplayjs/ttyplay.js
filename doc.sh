#!/bin/bash

DIR=$(cd $(dirname ${BASH_SOURCE[0]}) && pwd)
${DIR}/node_modules/.bin/jsdoc -c ${DIR}/jsdoc.json -R README.md -d ${DIR}/../ttyplay-pages ${DIR}/src/javascripts/ttyplay.js
