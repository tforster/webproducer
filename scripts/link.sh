#!/bin/zsh
MODULE_ROOT=$(readlink -f `dirname "$0"`/..)
ln -s $MODULE_ROOT `pwd`

