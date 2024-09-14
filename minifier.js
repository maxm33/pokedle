const fs = require("fs");
const https = require("https");
const querystring = require("querystring");

cleanDir(__dirname + "/public/js");
cleanDir(__dirname + "/public/stylesheets");

for (var file of fs.readdirSync(__dirname + "/unminified")) {
  var filename = file.split(".");
  var name = filename[0];
  var extension = filename[1];
  if (extension == null || (extension != "js" && extension != "css")) {
    console.error("Can't minify ." + extension + " files");
    continue;
  }
  minify(name, extension);
}

function cleanDir(dir) {
  for (var file of fs.readdirSync(dir)) fs.unlinkSync(dir + "/" + file);
}

function minify(name, extension) {
  var query = querystring.stringify({
    input: fs.readFileSync(
      __dirname + "/unminified/" + name + "." + extension,
      "utf-8"
    ),
  });
  var req = https.request(
    {
      method: "POST",
      hostname: "www.toptal.com",
      path:
        extension == "js"
          ? "/developers/javascript-minifier/api/raw"
          : "/developers/cssminifier/api/raw",
    },
    function (res) {
      var data = "";
      res.on("data", function (chunk) {
        data += chunk;
      });
      res.on("end", function () {
        fs.writeFileSync(
          __dirname +
            "/public/" +
            (extension == "js" ? extension : "stylesheets") +
            "/" +
            name +
            "." +
            extension,
          data,
          { encoding: "utf8", flag: "w" }
        );
        console.log("Minified: " + name + "." + extension);
      });
    }
  );
  req.on("error", function (err) {
    throw err;
  });
  req.setHeader("Content-Type", "application/x-www-form-urlencoded");
  req.setHeader("Content-Length", query.length);
  req.end(query, "utf-8");
}
