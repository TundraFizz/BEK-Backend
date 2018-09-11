//////////////////////////////////
// Include local libraries here //
//////////////////////////////////
var app = require("../server.js");
var fs  = require("fs");

///////////
// Index //
///////////
app.get("/", function(req, res){
  fs.readFile("static/navbar.html",        "utf-8", function(err, desktop){
  fs.readFile("static/navbar-mobile.html", "utf-8", function(err, mobile){
    res.render("index.ejs", {
      desktop: desktop,
      mobile:  mobile
    });
  });
  });
});

///////////
// About //
///////////
app.get("/about", function(req, res){
  fs.readFile("static/navbar.html",        "utf-8", function(err, desktop){
  fs.readFile("static/navbar-mobile.html", "utf-8", function(err, mobile){
    res.render("about.ejs", {
      desktop: desktop,
      mobile:  mobile
    });
  });
  });
});

/////////
// Pax //
/////////
app.get("/pax", function(req, res){
  fs.readFile("static/navbar.html",        "utf-8", function(err, desktop){
  fs.readFile("static/navbar-mobile.html", "utf-8", function(err, mobile){
    res.render("pax.ejs", {
      desktop: desktop,
      mobile:  mobile
    });
  });
  });
});

/////////
// FEK //
/////////
app.get("/fek", function(req, res){
  fs.readFile("static/navbar.html",        "utf-8", function(err, desktop){
  fs.readFile("static/navbar-mobile.html", "utf-8", function(err, mobile){
    res.render("fek.ejs", {
      desktop: desktop,
      mobile:  mobile
    });
  });
  });
});

//////////////
// Projects //
//////////////
app.get("/projects", function(req, res){
  fs.readFile("static/navbar.html",        "utf-8", function(err, desktop){
  fs.readFile("static/navbar-mobile.html", "utf-8", function(err, mobile){
    res.render("projects.ejs", {
      desktop: desktop,
      mobile:  mobile
    });
  });
  });
});

app.get("/projects/discord-thing", function(req, res){
  fs.readFile("static/navbar.html",        "utf-8", function(err, desktop){
  fs.readFile("static/navbar-mobile.html", "utf-8", function(err, mobile){
    res.render("discord-thing.ejs", {
      desktop: desktop,
      mobile:  mobile
    });
  });
  });
});

///////////////////////
// Change FEK Avatar //
///////////////////////
app.get("/change", function(req, res){
  res.render("change.ejs");
});

/////////////////////////////
// FEK Admin Control Panel //
/////////////////////////////
app.get("/admin", function(req, res){
  res.render("admin.ejs");
});

///////////////////////////////////
// Fizz build and DPS calculator //
///////////////////////////////////
app.get("/calc", function(req, res){
  res.render("calc.ejs");
});

//////////////////////////////////
// 404: No route or file exists //
//////////////////////////////////
app.use(function (req, res){
  res.render("404.ejs");
});
