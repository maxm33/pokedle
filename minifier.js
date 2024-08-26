const fs = require("fs");
const https = require("https");
const querystring = require("querystring");

cleanDir(__dirname + "/public/js");
cleanDir(__dirname + "/public/stylesheets");

// get files automatically from 'unminified' dir
minify("classicAppState", "js");
minify("classicMode", "js");
minify("pokemons", "js");
minify("style", "css");

function cleanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) fs.unlinkSync(dir + "/" + file);
}

function minify(file, type) {
  const query = querystring.stringify({
    input: fs.readFileSync(
      __dirname + "/unminified/" + file + "." + type,
      "utf-8"
    ),
  });
  const req = https.request(
    {
      method: "POST",
      hostname: "www.toptal.com",
      path:
        type == "js"
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
            (type == "js" ? type : "stylesheets") +
            "/" +
            file +
            "." +
            type,
          data,
          { encoding: "utf8", flag: "w" }
        );
        console.log("Minified: " + file + "." + type);
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
