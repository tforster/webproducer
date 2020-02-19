#!/bin/bash

################################################################################
# theme-dev.sh 
# ------------
# Simple shell script to orchestrate the serverless offline module, your Lambda
# function, a local http server and a file watcher on theme
#
# Usage: 
# 1. Copy this file to root of your web project
# 2. Make it executable with chmod +x ./theme-dev.sh. 
# 3. Execute with ./theme-dev.sh {dev | stage | prod}
#
################################################################################

# During development of this script we sometimes end up with an orphaned process that needs to be killed by it's TCP port
lsof -i tcp:3701 | awk 'NR!=1 {print $2}' | xargs kill  # HTTP Server launched from ./http-server.js
lsof -i tcp:3000 | awk 'NR!=1 {print $2}' | xargs kill  # Serverless Offline plugin launched from line 8 below and src/serverless.yml

# Start the local serverless emulator for API Gateway and Lambda FaaS processing in the background (defined in src/serverless.yml)
(cd src; serverless offline &)

# Start a static server to serve content from the build folder for local theme development
node ./node_modules/http2-server --root tmp/build --cert . tmp & 

# Use inotifywait ($ apt install inotifytools) to watch the src/theme folder for changes and invoke the local Lambda function
inotifywait -mre close_write --format '%f' src/theme src/resources | while read NEWFILE; do curl -X POST http://localhost:3000/publish\?stage=dev\&local=true; done
