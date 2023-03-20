module.exports = class sync {  //  sync - server-side

/*

sync allow working offline on local computer and syncing changed files with other computers. It is simialr to google drive

Bugs-
  create /syc/{new machine folder}
*/


constructor () {  //  sync - server-side
  // load config file for syncvvv
}


async direct( //  sync - server-side
  msg  // msg.server : sync
       // msg.msg  : manifest
       // msg.type : client2server  | client2client      
       // msg.direcotry : attribute of client2server or client2client in config file that points to local directory that a manifest list is being created for
  ,request      // HTTPS request
  ,response     // HTTPS response
){

  switch (msg.msg) {
    case "manifest":
      this.manifest(msg,request,response);
      break;
  
    default:
      app.logs.error( `"Error: server.sync, message = '${obj}"`       ,request, response );
  }
}


async manifest( //  sync - server-side
   msg
  ,request      // HTTPS request
  ,response     // HTTPS response
) { 

  // set direcotryWrite  and directoryRead
  let directoryWrite // where meta data is stored about all the files in directoryRead 
   , directoryRead;  // directory were are creating the manifest files about

   let config={};  

  if         (msg.type === "client2server") {
      if        (msg.location === "local") {
        // manifes for local server upload
        config = require(app.getFilePath(request ,response ) + "/config.json")
        directoryWrite = app.getFilePath(request)+`/client2server/${msg.direcotry}`; // local dirtory to generate manifest fils
        directoryRead  = config.client2server[msg.direcotry]
      } else if (msg.location === "remote") {
        // manifes for remote serverthe one logged into  
        config.machine = "remote";
        directoryWrite = app.getFilePath(request); // local dirtory to generate manifest fils
        directoryRead  = directoryWrite+"/upload";
      } else {
        // error
        directoryWrite = app.getFilePath(request)+`/client2server/${msg.direcotry}`; // local dirtory to generate manifest fils
        directoryRead  = config.client2server[msg.direcotry]
        return;
      }
  } else if (msg.type === "client2client") {
      //
    return;
  } else {
    //
    // error in vailid msg.type
    return;
  }
  
  // load config file

  // get local path to direcotry were are creating manifest files for

  try {
    // init counters
    this.totalDir   = 0;
    this.totalFiles = 0;
    this.totalLinks = 0;

    await this.generateFiles(directoryWrite, directoryRead, request, response);  //
    
    // give client statues
    app.sessions.responseEnd(response, `
    {
     "msg"     : true
    ,"machine" : "${config.machine}"
    ,"files"   : ["1-manifest.csv","2-dir.csv","3-links.csv"]
    }`);


  } catch(e) {
    console.log(e);   // need to be logged
  }
}


async generateFiles(//  sync - server-side
 directoryWrite     // where manifest files will be written
,directoryRead      // 
,request      // HTTPS request
,response     // HTTPS response
) {
    // delete/create machine directory
    await app.fsp.rm(   `${directoryWrite}`, { recursive: true ,force: true});  // ignore errow if it does not exist
    await app.fsp.mkdir(`${directoryWrite}`, { recursive: true });              // should have an empty directory now

    // create streams
    this.stream   = app.fs.createWriteStream( `${directoryWrite}/1-manifest.csv`  , {flags: 'a'});  // append to end of file
    this.streamD  = app.fs.createWriteStream( `${directoryWrite}/2-dir.csv`       , {flags: 'a'});  // append to end of file
    this.streamL  = app.fs.createWriteStream( `${directoryWrite}/3-links.csv`     , {flags: 'a'}); // append to end of file
  
    // write headers
    this.stream.write( `"File ID","Bytes","Disk Space","Last Access","Creation","Path"\r\n`);
    this.streamD.write(`"Directory"\r\n`);
    this.streamL.write(`"Links"\r\n`);

    // creat manifest files
    this.getAllFiles(directoryRead); // local dirtory to generate manifest fils
    directoryRead

    // close the streams
    this.stream.end( );
    this.streamD.end();
    this.streamL.end();
  }


getAllFiles(  //  sync - server-side    // recursice - find all files in all subdirectories
  directoryRead  // path to local client machine to directory being synced
  ) {
  const files = app.fs.readdirSync(directoryRead);

  files.forEach((file) => {
    const dirFile = `${directoryRead}/${file}`;
    const stat = app.fs.statSync(dirFile);  // should this be converted to a an async version?

    // there are probabliy more cases than this
    if (stat.isSymbolicLink()) {
      this.totalLinks++;
      this.streamL.write(`"${dirFile}"\r\n`);
    }

    if (stat.isDirectory()) {
      // create csv of direcotorys
      this.streamD.write(`"${dirFile}"\r\n`);
      this.totalDir ++;
      this.getAllFiles(dirFile);   // recursice
    } else {
      // assume create csv of files
      // inode,size, disk size,"last access date", creation date", "path with file name"
      this.stream.write(`${stat.ino},${stat.size},${stat.blksize*stat.blocks},"${stat.atime.toUTCString()}","${stat.birthtime.toUTCString()}","${dirFile}"\r\n`);
      this.totalFiles++;
    }
  });
}


} //  sync - server-side    //////// end of class
