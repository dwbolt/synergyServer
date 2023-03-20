module.exports = class sessionsClass {   // sessionsClass - server-side

  // public
/*

class keeps track of user sessions, requests and response authentication

log(request,response) called from server.js when server request first comes in
  initSession(sessionKey)                    - private, init Session attributes
  initRequest(sessionKey, request, response) - private, intit Request object
responseEnd(response, content)
login(clientMsg, request, response)
logout()
changePWD
cleanUp()                      run on timer
parseCookies(request)          put cookies in an object so that they can be accessed

*/


constructor () {  // sessionsClass - server-side
    // used to see current state of the server in real time . the logfile logSummary is overwritten every cleanUp cycle
    // static
    this.serverStart  = Date.now();

    // load user autentication data
    this.users        = require(`${app.configDir}/users.json`);

    // requests
    this.requests        = 0    // increment each time a request comes in
    this.openRequests    = [];  // Requests that are still processing
    this.lastRequest     =  Date.now();   // see how hard server is being hit
    this.sessionKey      = 0;   // increment each time a new session is started
    this.bytesSent       = 0;   // total bytes sent to clients since server started
    this.headerUndefined = 0;   // keep track of how many undefined header requests come in, we ignor them

    // open sessions
    this.sessions     = {};  // open sessions
}


async initSummary( // sessionsClass - server-side
  fileName
  ) {  ///
  // if server restarts in the middle of the day, load the last data and start from there

  // make sure there is a file to load
  try {
  const stats = await app.fsp.stat(fileName);
  if (0 < stats.size ) {
    // will lose any info between last summary write and server re-start
    /*
     "serverStart"     : 1645885083838
    ,"serverUpHr"      : 15.740024722222222
    ,"bytesSent"       : 0.651191
    ,"requests"        : 83
    ,"sessionsTotal"   : 35
    ,"sesstionsActive" : 2
    ,"headerUndefined" : 5
    */
    const str  = await app.fsp.readFile(fileName);
    const s    = JSON.parse(str);
    this.requests   = s.requests;
    this.sessionKey = s.sessionsTotal;
    this.bytesSent  = s.bytesSent;
  }
  } catch (e) {
    // not going to worry if file is not there
    // just want to stop error from propagating up
  }
}


// sessionsClass - server-side
// public, called from server.js when server request first comes in
log(
    request    // request ->
  , response   // response ->
) {
  // requests start here
  let sessionKey;
  // get cookie
  const cookie = this.parseCookies(request);

  // If the cookie has a serverStart attribute that matches the current server instance,
  // and it has a valid session key (one that's a key in this.sessions),
  // then go straight to initRequest. If any of that ISN'T true, start a new session first.
  if (!(cookie.serverStart && cookie.serverStart == this.serverStart
        && cookie.sessionKey && this.sessions[cookie.sessionKey])) {
          // start new session
          sessionKey = this.sessionKey++;
          this.initSession(sessionKey);
          response.setHeader('Set-Cookie', [`serverStart=${this.serverStart};path="/"`, `sessionKey=${sessionKey};path="/"`]);
  } else {
    // session key is valid
    sessionKey = cookie.sessionKey;
  }

  this.initRequest(sessionKey, request, response);
  response.setHeader('Access-Control-Allow-Origin', '*');
  // 2022-02-23 dwb still not sure if this needs to be changed https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin
}


// sessionsClass - server-side
// private, init Session object
initSession(
  sessionKey  // sessionKey ->
) {
  this.sessions[sessionKey] = {"user":"", "requests":[]};
}


// sessionsClass - server-side
initRequest(sessionKey, request, response) { // private, intit Request object
  const now = Date.now();

  const obj = {    // request object to store
    "sessionKey"  : sessionKey
    ,"requestNum" : ++this.requests
    ,"start"      : now
    ,"lastRequest": now - this.lastRequest
    ,"duration"   : 0                                // will be replaced with milliseconds it took to process
    ,"ip"         : request.connection.remoteAddress // ip address that request came from
    ,"method"     : request.method                   // post, get, ...
    ,"url"        : request.url
  }

  this.lastRequest         = now; // update to now, so we log time between now and next request
  const nextRequestKey     = this.sessions[sessionKey].requests.length;

  // store in response way to delete openRequest when it is done, also store sessionNumber and RequestNumber for logging
  const key                = sessionKey +"-"+ nextRequestKey;
  this.openRequests[key]   = 0;                      // store request that is in process and that it just started procesing
  response.synergyRequest  = { "openReqestKey": key, "sessionNumber":sessionKey, "requestNumber": nextRequestKey  }

  this.sessions[sessionKey].requests[nextRequestKey] = obj;  // store request in session
  app.logs.request(request,response);
}


// sessionsClass - server-side
// public, called to end response back to client
responseEnd(
   response  // response ->
  ,content  // content -> what is to be sent to browser client
) {
  // make request complete not written yet
  if (content) {
    response.end(content);  // tell the client there is no more coming
  } else {
    // supports OPTIONS method with no contnet, only headers
    response.end();  // tell the client there is no more coming
    content=""; // 
  }
  delete this.openRequests[response.synergyRequest.openReqestKey];  // remove from openRequest object

  const obj = this.sessions[response.synergyRequest.sessionNumber].requests[response.synergyRequest.requestNumber];
  obj.duration    = Date.now() - obj.start;
  obj.bytesSent   = content.length;
  this.bytesSent += content.length;
//  obj.s_start     = new Date(obj.start).toISOString();
  app.logs.response(obj);
}


// public, used to login from html page
async login( // sessionsClass - server-side
   clientMsg // message from client
  ,request   // HTTPS request
  ,response  // HTTPS response
){
  const user = clientMsg.user;
  // see if user
   if (!this.users[user]) {
      // user is not in users.json, login failed
      this.responseEnd(response,'{"msg":false}');
   } else  {
     // try to load user.json from user's directtory
     //const userDir = this.users[user];
   //  const file = `${app.getSubAppPath("users",request)}/${userDir}/user.json`;
    const file = `${this.getUserDir(request, user)}/user.json`;
     try {
       const json = require(file);
       if (json.pwdDigest === this.string2digestBase64(clientMsg.pwd)) {
        // login successful
        response.setHeader('Set-Cookie', [ `userKey=${user};path="/"`]);
        this.responseEnd(response,`{"msg":true, "nameFirst":"${json.nameFirst}", "nameLast":"${json.nameLast}"}`);
        // store user with their session
        this.sessions[response.synergyRequest.sessionNumber].user = this.users[user];  // save data of logined user with session
      } else {
        this.responseEnd(response,'{"msg":false}');
      }
     } catch (e) {
       app.logs.error(`sessions.login open ${file} error=${e}`  ,request,response)
       this.responseEnd(response,'{"msg":false}');
     }
   }
}


getUserDir(  // sessionsClass - server-side
  request     //
  ,user
  )
{
  if (!user) {
    user = this.parseCookies(request).userKey
  }
  const userDir = this.users[user];
  return `${app.getSubAppPath("users",request)}/${userDir}`;  // local file system directory for loggin user
}


async changePWD( // sessionsClass - server-side
   clientMsg // message from client
  ,request   // HTTPS request
  ,response  // HTTPS response
){
  const user = clientMsg.user;
  // see if user
   if (!this.users[user]) {
      // user is not in users.json, login failed
      this.responseEnd(response,'{"msg":false}');
   } else  {
     // try to load user.json from user's directtory
     const userDir = this.users[user];
     const file = `${app.getSubAppPath("users",request)}/${userDir}/user.json`;
     try {
       const json = require(file);
       const digest = this.string2digestBase64(clientMsg.pwd);
       if (json.pwdDigest === digest) {
        // store s_digest
        json.pwdDigest = this.string2digestBase64(clientMsg.pwdNew);
        await app.fsp.writeFile(file, JSON.stringify(json)); // save the file using app.fs.writeFile

        // login successful
        //response.setHeader('Set-Cookie', [ `userKey=${user};path="/"`]);
        this.responseEnd(response,`{"msg":true, "comment":"password changed"}`);
        // store user with their session
        //this.sessions[response.synergyRequest.sessionNumber].user = this.users[user];  // save data of logined user with session
      } else {
        this.responseEnd(response,'{"msg":false}');
      }
     } catch (e) {
       app.logs.error(`sessions.login open ${file} error=${e}`  ,request,response)
       this.responseEnd(response,'{"msg":false}');
     }
   }
}


async addUser( // sessionsClass - server-side
   clientMsg // message from client
 , request    // HTTPS request
 , response   // HTTPS response
) {

  // see if user already exists
  if (this.users[clientMsg.user]) {
     // let client browser know that the user was not added
    this.responseEnd(response,`{"msg":false, "comment":"User ${clientMsg.user} already exists"}`);
    return;
  }

    // add user to json 
    const year = new Date().getFullYear().toString();
    let next   = this.users[year] || 1;  // init to 1 if no users exixt for current year

    const userDir = `${year}/${next}-${clientMsg.nameLast},${clientMsg.nameFirst}`;
    this.users[clientMsg.user] = userDir;
    this.users[year] = ++next;  // increment the next userer number

    // save updated user file to file
    await app.fsp.writeFile(`${app.config.userDir}users.json`, JSON.stringify(this.users));

    // copy user timeplate direcory to new user directory
    const usersDir = app.getSubAppPath("users",request);
    await app.fsp.cp(`${usersDir}/_template`, `${usersDir}/${userDir}`, {recursive: true})

    // add user json file with salted passord
    const userData = `
    {
       "user"      : "${clientMsg.user}"
      ,"nameFirst" : "${clientMsg.nameFirst}"
      ,"nameLast"  : "${clientMsg.nameLast}"
      ,"pwdDigest" : "${this.string2digestBase64(clientMsg.pwd)}"
      ,"phone"     : "${clientMsg.phone}"
      ,"email"     : "${clientMsg.email}"
    }`
    await app.fsp.writeFile(`${usersDir}/${userDir}/user.json`, userData);


    // reposond to browser client
    this.responseEnd(response,`{"msg":true, "comment":"User ${clientMsg.user} Added"}`);
}


string2digestBase64(  // sessionsClass - server-side
  // convert string to digest base64 string
  // passwords are not stored on the server, only the digest of the password
  s_pwd // string -
) {
  var    crypto = require('crypto');
  const  digest = crypto.createHash('sha256').update(s_pwd).digest('base64');  // salt not yet added
  return digest;
}


getUserPath( // sessionsClass - server-side
  response) {
  // return the logged in users data path
  return this.sessions[response.synergyRequest.sessionNumber].user;
}


// sessionsClass - server-side
logout(
   clientMsg // message from client
  ,request   // HTTPS request
  ,response  // HTTPS response
) {
  // remove user from their session on server
  delete this.sessions[response.synergyRequest.sessionNumber].user;

  // remove user from their session on client
  response.setHeader('Set-Cookie', [ `userKey=;path="/"`]);
  this.responseEnd(response,'{"msg":true}');
}


// 2022-02-17 potental bug, not sure what happens if cleanUp takes longer than a second to run say durring a garbage collection
// sessionsClass - server-side
// private - called every second to get rid of inactive sessions and requests
cleanUp() {
  // see if any sessions need to be culled
  for (let sess in this.sessions) { // Go through all existing sessions
    const session = this.sessions[sess];
    const requests = session.requests; // Get the list of requests
    const now = Date.now();
    // If the LAST request is older than maxSessionAge, delete the session. Note: maxSessionAge is in minutes; must convert to ms
    let sessionAge = now - requests[requests.length -1].start;
    if (sessionAge > app.config.maxSessionAge.totalMilliSec) {
      // Remove any open requests associated with this session.
      for (let req in session.requests) {
        const key = sess +"-"+ req;
        delete this.openRequests[key]; // will delete the open request with this key if it exists, and will not fail if the request doesn't exist
      }
      delete this.sessions[sess];
    }
  }
}


// sessionsClass - server-side
// private, put cookies in an object so that they can be accessed easily
parseCookies (
  request  // request ->
) {
  // https://stackoverflow.com/questions/3393854/get-and-set-a-single-cookie-with-node-js-http-server
  const list = {};
  let rc = null;  // request cookies

  if (request.headers) {
    rc = request.headers.cookie;
  }

  rc && rc.split(';').forEach( (cookie) => {
      var parts = cookie.split('='); // Split the cookie at "=", so the first entry is the attribute name and the rest is the value
      // Remove the attribute name, trim off whitespace, and that's the key.
      // Join the rest of the array with "=" just in case it was split earlier (in case there was a = in the value),
      // decode it and that's the value.
         list[parts.shift().trim()] = decodeURI(parts.join('='));
      //list[parts[0]] = parts[1];  // this is easer to read, does it do the same thing?
  });

  return list;
}


// sessionsClass - server-side
} //////// end
