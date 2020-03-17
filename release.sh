#!/bin/bash

git checkout $1
npm version patch
git push origin $1
git push github $1
