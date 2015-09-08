#!/bin/bash

DIR=$(cd $(dirname ${BASH_SOURCE[0]}) && pwd)
${DIR}/node_modules/node-sass/bin/node-sass --watch . --output .
