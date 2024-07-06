import https from "https";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import mime from "mime";

const options = {
  key: fs.readFileSync('private.key'),
  cert: fs.readFileSync('certificate.crt')
};

function validFilePath(filePath, allowedFolder) {
  let reqpath = path.resolve(filePath);
  for (let i = 0; i < allowedFolder.length; i++) {
    let validPath = path.resolve(allowedFolder[i]);
    if (reqpath.startsWith(validPath)) {
      return true;
    }
  }
  return false;
}
function isFileExist(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    } else {
      throw err;
    }
  }
}
function parseCookies(request) {

  const list = {};
  const cookieHeader = request.headers.cookie;

  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      let parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }

  return list;
}

function loadJson(fname) {
  let data = fs.readFileSync(fname, "utf-8");
  if (data) {
    return JSON.parse(data);
  }
  return null;
}
const server = https.createServer(options, async (req, res) => {
  let cookie = parseCookies(req);
  let knownauth = loadJson("server/dbase.json");
  let isloggedin = false;
  if (cookie.auth && cookie.username && cookie.auth === knownauth[cookie.username]) {
    isloggedin = true;
  }
  console.log(isloggedin)
  let url = req.url;
  if (url === "/" || url == "/?") {
    url = "/home.html";
  }
  
  let reqpath = path.resolve("./client"+url);
  if (!isFileExist(reqpath)) {
    reqpath = path.resolve("./files"+url);
    if (!isFileExist(reqpath)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    // check authorization
    if (!isloggedin) {
      res.writeHead(403);
      res.end("Not authorized");
      return;
    }
  } else if (!isloggedin) {
    console.log("redirect to login");
    reqpath = path.resolve("./client/login.html");
    url = "/login.html"
  }
  console.log(reqpath);
  let validPath = validFilePath(reqpath, ["client", "files"]);
  if (!validPath) {
    res.writeHead(403);
    res.end("Not authorized");
    return;
  }
  let ftype = mime.getType(reqpath);
  fs.readFile(reqpath, (err, data) => {
    if (err) {
      res.writeHead(504);
      res.end("Se fue todo a la mierda");
    } else {
      if (path.resolve("./client/home.html") === reqpath && reqpath != null) { // is home file
        let datast = data.toString("utf-8");
        let files = fs.readdirSync("./files");
        let REPLACEMEWITHFILENAMES = "";
        let REPLACEMEWITHFILESIZES = "";
        let REPLACEMEWITHHREF = "";
        for (let i = 0; i < files.length; i++) {
          let file = files[i];
          let size = fs.statSync("./files/"+file).size;
          let href = "/"+file;
          REPLACEMEWITHFILENAMES = REPLACEMEWITHFILENAMES + "\"" + file + "\"" + ",";
          REPLACEMEWITHFILESIZES = REPLACEMEWITHFILESIZES + "\"" + size +"\"" + ",";
          REPLACEMEWITHHREF = REPLACEMEWITHFILENAMES + "\"" + href + "\"" + ",";
        }
        datast = datast.replace("REPLACEMEWITHFILENAMES", REPLACEMEWITHFILENAMES);
        datast = datast.replace("REPLACEMEWITHFILESIZES", REPLACEMEWITHFILESIZES);
        datast = datast.replace("REPLACEMEWITHHREF", REPLACEMEWITHHREF);
        res.writeHead(200, {"Content-Type": ftype});
        res.write(Buffer.from(datast, "utf-8"));
        res.end();
      } else {
        res.writeHead(200, {"Content-Type": ftype});
        res.write(data);
        res.end();
      }
      
    }
  })
});

server.listen(443, () => {
  console.log('Server running on https://localhost:443/');
});
