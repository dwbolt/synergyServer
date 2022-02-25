// web server: static files and and API to webserver

// create server class and load configuration file
app = new (require('./server.js'))("../configHTTPS");  // class where the work gets done

async function startServer() {
  // load classes
  app.sessions = new (require('./sessions.js'));   // keep track of sessions, requests and responses
  app.logs     = new (require('./logs.js'    ));   // logs


  await app.main();

  // start timers
  setInterval( app.sessions.cleanUp.bind(app.sessions), 1000);
  setInterval( app.logs.summary.bind(    app.logs    ), 5000);
  const n= new Date();
  app.logs.error(`server started  ${n.toISOString()}`);

  // server loop
  app.https.createServer(
    {
    // https certificates for encription
    key:  app.fs.readFileSync('../certificates/sfcknox.org/private.key.pem')
   ,cert: app.fs.readFileSync('../certificates/sfcknox.org/domain.cert.pem')
   ,ca:   app.fs.readFileSync('../certificates/sfcknox.org/intermediate.cert.pem')
    },app.requestIn.bind(app)
  ).listen(app.config.port);

  console.log(`https:// Server using port: ${app.config.port}`);
}

startServer();
