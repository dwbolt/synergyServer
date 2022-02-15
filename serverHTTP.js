/*

small web server that serves static files and a
API to webserver

*/

// built in nodejs modules
const http    = require('http');  // access to http protocal
const fs       = require('fs');     // access to local server file system

// create server class and load configuration file
app       = new (require('./server.js'))("./configHTTP");  // class where the work gets done

// helper functions to get access to app object
function requestIn(  request, response) {app.requestIn(           request, response);}
function responseEnd(request, response) {app.sessions.responseEnd(request, response);}

// server request and reponse loop
async function startServer() {
  await app.createLogFiles();
  app.logError("test error log")
  app.sessions = new (require('./sessions.js'            ));   // keep track of sessions, requests and responses

  // start server loop
  http.createServer(requestIn).listen(app.config.port);

  //
  console.log(`http:// Server using port: ${app.config.port}`);
}

startServer();
