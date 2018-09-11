var app        = require("../server.js");
var twitter    = require("twitter");
var formidable = require("formidable");
var request    = require("request");
var moment     = require("moment");
var mysql      = require("mysql");
var fs         = require("fs");

function MySqlConnection(){
  fs.readFile("config.json", "utf-8", (error, data) => {
    if(error){
      console.log(error);
      return;
    }

    data = JSON.parse(data);

    conn = mysql.createConnection({
      host    : data["host"],
      user    : data["user"],
      password: data["password"],
      database: data["database"]
    });
  });
}

MySqlConnection();

function FEK(){}

FEK.prototype.Initialize = function(req){return new Promise((resolve) => {
  var self = this;
  self.response = {};
  self.response["records"]       = {};
  self.response["announcements"] = [];
  self.response["event"]         = {};
  self.response["version"]       = {};

  self.form = new formidable.IncomingForm();

  self.form.parse(req, function(err, data, files){
    if(Object.keys(files).length){
      self.filePath = files["file"].path;
      self.fileName = files["file"].name;
      self.fileExt  = files["file"].name.split(".").pop();
    }

    for(key in data)
      self[key] = data[key];

    if(self.region == "EU Oeste" ||
       self.region == "EU Ouest" ||
       self.region == "Eu Ovest" ||
       self.region == "Westeuropa")
      self.region = "EUW";

    // Data that will be used
    // Remember to change myName to name and myRegion to region in FEK.user.js
    // this.name    = req.body.myName;
    // this.region  = req.body.myRegion;
    // this.users   = req.body.users;
    // this.regions = req.body.regions;

    resolve();
  });
})}

FEK.prototype.GetBoardsInfo = function(){return new Promise((resolve) => {
  var self = this;

  // Get JSON data from Riot's Boards API
  var uri = `http://boards.na.leagueoflegends.com/api/users/${self.region}/${self.name}`;
  uri = encodeURI(uri);

  var options = {
    url     : uri,
    json    : true,
    headers : {
      "User-Agent": "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.9) Gecko/20071025 Firefox/2.0.0.9"
    }
  };

  request(options, function(err, res, data){
    self.boardsId     = data["id"];
    self.boardsName   = data["name"];
    self.boardsRegion = data["realm"];
    resolve();
  });
})}

FEK.prototype.CheckIfUserExists = function(){return new Promise((resolve) => {
  // Check if the Boards ID exists in the database
  var self = this;
  var sql  = `SELECT * FROM users WHERE boards_id=?`;
  var args = [self.boardsId];

  conn.query(sql, args, function(err, rows){
    var lastLogin = new Date();

    if(rows.length == 0){
      var sql = `INSERT INTO users (boards_id, name, region, last_login) VALUES (?,?,?,?)`;
      var args = [self.boardsId, self.boardsName, self.boardsRegion, lastLogin];

      conn.query(sql, args, function(err, rows){
        resolve();
      });
    }else{
      var sql = `UPDATE users SET name=?, region=?, last_login=? WHERE boards_id=?`;
      var args = [self.boardsName, self.boardsRegion, lastLogin, self.boardsId];
      conn.query(sql, args, function(err, rows){
        resolve();
      });
    }
  });
})}

FEK.prototype.GetVersion = function(){return new Promise((resolve) => {
  var self = this;
  var sql = `SELECT number, link FROM version`;
  var args = [];
  conn.query(sql, args, function(err, rows){
    // IMPORTANT!
    // Change this from records to something else later
    self.response["version"]["number"] = rows[0]["number"];
    self.response["version"]["link"]   = rows[0]["link"];
    resolve();
  });
})}

FEK.prototype.GetEvent = function(){return new Promise((resolve) => {
  var self = this;
  var sql = `SELECT message, stream, thread, start, end FROM event`;
  var args = [];
  conn.query(sql, args, function(err, rows){
    self.response["event"]["message"] = rows[0]["message"];
    self.response["event"]["stream"]  = rows[0]["stream"];
    self.response["event"]["thread"]  = rows[0]["thread"];
    self.response["event"]["start"]   = rows[0]["start"];
    self.response["event"]["end"]     = rows[0]["end"];
    resolve();
  });
})}

FEK.prototype.GetTwitterInfo = function(){return new Promise((resolve) => {
  var self = this;
  var sql = `SELECT * FROM tweets ORDER BY id DESC LIMIT 0, 2`;
  var args = [];
  conn.query(sql, args, function(err, rows){
    for(var i = 0; i < rows.length; i++){
      var data           = {};
      data["id"]         = rows[i]["id"];
      data["created_at"] = rows[i]["created_at"];
      data["text"]       = rows[i]["text"];
      data["user"]       = [rows[i]["name"],
                            rows[i]["screen_name"],
                            rows[i]["profile_image_url"]];

      self.response["announcements"].push(data);
    }

    resolve();
  });
})}

FEK.prototype.GetAvatars = function(){return new Promise((resolve) => {
  if(!this.users){
    resolve();
    return;
  }

  var self = this;
  var sql = `SELECT name, region, boards_id, staff, title, badge FROM users`;
  var args = [];
  var firstRun = true;

  self.users   = self.users.split(",");
  self.regions = self.regions.split(",");

  for(var i = 0; i < self.users.length; i++){
    if(firstRun){
      firstRun = false;
      sql += ` WHERE name=? AND region=?`;
      args.push(self.users[i]);
      args.push(self.regions[i]);
    }else{
      sql += ` OR name=? AND region=?`;
      args.push(self.users[i]);
      args.push(self.regions[i]);
    }
  }

  conn.query(sql, args, function(err, rows){
    for(var i = 0; i < rows.length; i++){
      var row      = rows[i];
      var name     = row["name"];
      var region   = row["region"];
      var boardsId = row["boards_id"];
      var staff    = row["staff"];
      var title    = row["title"];
      var badge    = row["badge"];

      if(!self.response["records"][name])         self.response["records"][name]         = {};
      if(!self.response["records"][name][region]) self.response["records"][name][region] = {};

      self.response["records"][name][region]["staff"] = staff;
      self.response["records"][name][region]["title"] = title;
      self.response["records"][name][region]["badge"] = badge;

      var avatar = self.FindAvatar(boardsId);
      if(avatar)
        self.response["records"][name][region]["avatar"] = avatar;
    }

    resolve();
  });
})}

FEK.prototype.FindAvatar = function(boardsId){
  var localPath = "static/fek-avatars/" + boardsId;
  var publicPath = "https://tundrafizz.space/fek-avatars/" + boardsId;
  var extensions = [".jpg", ".jpeg", ".png", ".gif", ".webm", ".bmp"];

  for(var i = 0; i < extensions.length; i++){
    if(fs.existsSync(localPath + extensions[i])){
      return publicPath + extensions[i];
    }
  }

  return false;
}

app.post("/database", function(req, res){
  var fek = new FEK();

  fek.Initialize(req)
  .then(() => {
    if(fek.name){
      fek.GetBoardsInfo()
      .then(() => fek.CheckIfUserExists())
      .then(() => fek.GetVersion())
      .then(() => fek.GetEvent())
      .then(() => fek.GetTwitterInfo())
      .then(() => fek.GetAvatars())
      .then(() => res.json(fek.response));
    }else{
      fek.GetVersion()
      .then(() => fek.GetEvent())
      .then(() => fek.GetTwitterInfo())
      .then(() => fek.GetAvatars())
      .then(() => res.json(fek.response));
    }
  })
})

function UploadAvatar(){}

UploadAvatar.prototype.Initialize = function(req){return new Promise((resolve) => {
  var self = this;
  self.response       = false; // If the avatar was uploaded (false by default)

  self.form           = new formidable.IncomingForm();
  self.form.multiples = true; // Form Option: Allow uploading multiple files at once
  self.form.uploadDir = "./static/fek-avatars"; // Form Option: Set the upload directory

  self.form.parse(req, function(err, data, files){
    if(Object.keys(files).length){
      self.filePath = files["file"].path;
      self.fileName = files["file"].name;
      self.fileExt  = files["file"].name.split(".").pop();
    }

    for(key in data)
      self[key] = data[key];

    resolve();
  });
})}

UploadAvatar.prototype.GetIdFromRiotApi = function(){return new Promise((resolve) => {
  var self = this;

  // Get JSON data from Riot's Boards API
  var uri = `http://boards.na.leagueoflegends.com/api/users/${self.region}/${self.name}`;
  uri = encodeURI(uri);

  var options = {
    url     : uri,
    json    : true,
    headers : {
      "User-Agent": "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.9) Gecko/20071025 Firefox/2.0.0.9"
    }
  };

  request(options, function(err, res, data){
    var summonerNameFound = (typeof data["id"] !== "undefined");
    if(summonerNameFound){
      self.id = data["id"];
      self.fullFilePath = `${self.form.uploadDir}/${self.id}.${self.fileExt}`;

      fs.readdir(self.form.uploadDir, function(err, files){
        self.files = files;
        for(var i = 0; i < self.files.length; i++){
          var dir = self.form.uploadDir;
          var id  = self.files[i].split(".")[0];
          var ext = self.files[i].split(".")[1];
          var deleteThisFile = `${dir}/${id}.${ext}`;

          if(id == self.id)
            fs.unlinkSync(deleteThisFile);
        }

        fs.rename(self.filePath, self.fullFilePath);
        self.response = true;
        resolve();
      });
    }else{
      fs.unlinkSync(self.filePath);
      resolve();
    }
  });
})}

UploadAvatar.prototype.UpdateUser = function(){return new Promise((resolve) => {
  var self = this;
  var sql  = `SELECT * FROM users WHERE boards_id=?`;
  var args = [self.id];

  // Check if the ID exists in the database
  conn.query(sql, args, function(err, rows){
    var lastLogin = new Date();

    if(rows.length == 0){
      // Insert new user into database if they don't exist
      var sql = `INSERT INTO users (boards_id, name, region, last_login) VALUES (?,?,?,?)`;
      var args = [self.id, self.name, self.region, lastLogin];
      conn.query(sql, args, function(err, rows){
        resolve();
      });
    }else{
      // Update existing user
      var sql = `UPDATE users SET name=?, region=?, last_login=? WHERE boards_id=?`;
      var args = [self.name, self.region, lastLogin, self.id];
      conn.query(sql, args, function(err, rows){
        resolve();
      });
    }
  });
})}

app.post("/uploadavatar", function(req, res){
  var uploadAvatar = new UploadAvatar();

  uploadAvatar.Initialize(req)
  .then(() => uploadAvatar.GetIdFromRiotApi())
  .then(() => uploadAvatar.UpdateUser())
  .then(() => res.json(uploadAvatar.response))
})

function UserSearch(){}

UserSearch.prototype.Initialize = function(req){return new Promise((resolve) => {
  var self = this;
  self.response = {};

  self.form           = new formidable.IncomingForm();
  self.form.uploadDir = "./static/fek-badges"; // Form Option: Set the upload directory

  self.form.parse(req, function(err, data, files){
    if(Object.keys(files).length){
      self.filePath = files["file"].path;
      self.fileName = files["file"].name;
      self.fileExt  = files["file"].name.split(".").pop();
    }

    for(key in data)
      self[key] = data[key];

    resolve();
  });
})}

UserSearch.prototype.QuerySearch = function(){return new Promise((resolve) => {
  var self = this;
  var sql  = `SELECT * FROM users WHERE name LIKE ?`;
  var args = ["%"+self.name+"%"];

  conn.query(sql, args, function(err, rows){
    self.response = rows;
    resolve();
  });
})}

app.post("/querysearch", function(req, res){
  var userSearch = new UserSearch();

  userSearch.Initialize(req)
  .then(() => userSearch.QuerySearch())
  .then(() => res.json(userSearch.response))
})

function ManageCosmetics(){}

ManageCosmetics.prototype.Initialize = function(req){return new Promise((resolve) => {
  var self = this;

  self.response = {};

  self.form           = new formidable.IncomingForm();
  self.form.uploadDir = "./static/fek-badges"; // Form Option: Set the upload directory

  self.form.parse(req, function(err, data, files){
    if(Object.keys(files).length){
      self.filePath = files["file"].path;
      self.fileName = files["file"].name;
      self.fileExt  = files["file"].name.split(".").pop();
    }

    for(key in data)
      self[key] = data[key];

    resolve();
  });
})}

ManageCosmetics.prototype.AuthenticateUser = function(){return new Promise((resolve) => {
  var self = this;

  if(self.action == "Advance Day"){
    self.AdvanceDay().then(() => resolve())
    return;
  }

  if(!self.auth){
    self.response = "You must have an auth code";
    resolve();
  }else{
    var sql  = `SELECT id, boards_id FROM users WHERE name=? AND region=? AND auth=?`;
    var args = [self.name, self.region, self.auth];

    conn.query(sql, args, function(err, rows){
      if(rows[0]){
        self.id = rows[0]["id"];
        self.boardsId = rows[0]["boards_id"];

        if(self.action == "Update Title")
          self.UpdateTitle().then(() => resolve())
        else if(self.action == "Remove Title")
          self.RemoveTitle().then(() => resolve())
        else if(self.action == "Update Badge")
          self.UpdateBadge().then(() => resolve())
        else if(self.action == "Remove Badge")
          self.RemoveBadge().then(() => resolve())
        else{
          self.response = "Invalid action";
          resolve();
        }
      }else{
        self.response = "Your auth code is incorrect";
        resolve();
      }
    });
  }
})}

ManageCosmetics.prototype.UpdateTitle = function(){return new Promise((resolve) => {
  var self  = this;
  self.data = self.data.trim();

  if(self.data){
    var sql  = `SELECT fish_chips, title FROM users WHERE id=?`;
    var args = [self.id];

    conn.query(sql, args, function(err, rows){
      var row  = rows[0];
      var sql  = `UPDATE users SET title=? WHERE id=?`;
      var args = [self.data, self.id];

      if(row["title"]){
        self.response = "Title changed";
        conn.query(sql, args, function(err, rows){resolve()});
      }else if(row["fish_chips"] >= 3){
        self.response = "Title added, 3 FC deducted";
        conn.query(sql, args, function(err, rows){
          var sql   = `UPDATE users SET fish_chips=? WHERE id=?`;
          var args  = [row["fish_chips"] - 3, self.id];
          conn.query(sql, args, function(err, rows){resolve()});
        });
      }else{
        self.response = "You don't have enough FC";
        resolve();
      }
    });
  }else{
    self.response = "You can't have a blank title. If you wish to remove it, please use the Remove Title button.";
    resolve();
  }
})}

ManageCosmetics.prototype.RemoveTitle = function(){return new Promise((resolve) => {
  var self = this;
  var sql  = `SELECT title FROM users WHERE id=?`;
  var args = [self.id];

  conn.query(sql, args, function(err, rows){
    if(rows[0]["title"]){
      var sql       = `UPDATE users SET title='' WHERE id=?`;
      var args      = [self.id];
      self.response = "Title removed. Fish Chip upkeep has been reduced by 3.";
      conn.query(sql, args, function(err, rows){resolve()});
    }else{
      self.response = "You don't have a title to remove.";
      resolve();
    }
  });
})}

ManageCosmetics.prototype.UpdateBadge = function(){return new Promise((resolve) => {
  var self  = this;
  self.data = parseInt(self.data);

  if(!(self.data >= 0 && self.data <= 2)){
    self.response = "Invalid badge";
    resolve();
    return;
  }

  // Check to see if they already have a badge in that slot
  var sql  = `SELECT fish_chips, badge FROM users WHERE id=?`;
  var args = [self.id];

  conn.query(sql, args, function(err, rows){
    var row         = rows[0];
    var badge       = row["badge"].split(",");
    var badgeExists = badge[self.data] ? true : false;

    var ext = ".jpg";
    var suffix = `${self.boardsId}-${self.data}.${self.fileExt}`;
    var newPath = `static/fek-badges/${suffix}`;

    badge[self.data] = `http://localhost:9001/fek-badges/${suffix}`;
    badge = badge.join(",");

    var sql  = `UPDATE users SET badge=? WHERE id=?`;
    var args = [badge, self.id];

    if(badgeExists){
      conn.query(sql, args, function(err, rows){
        self.response = "Badge changed";
        fs.rename(self.filePath, newPath);

        resolve();
      });
    }else if(row["fish_chips"] >= 3){
      conn.query(sql, args, function(err, rows){
        var sql   = `UPDATE users SET fish_chips=? WHERE id=?`;
        var args  = [row["fish_chips"] - 3, self.id];
        self.response = "Badge added, 3 FC deducted";
        fs.rename(self.filePath, newPath);

        conn.query(sql, args, function(err, rows){resolve()});
      });
    }else{
      self.response = "You don't have enough FC";
      fs.unlinkSync(self.filePath);
      resolve();
    }
  });
})}

ManageCosmetics.prototype.RemoveBadge = function(){return new Promise((resolve) => {
  var self  = this;
  self.data = parseInt(self.data);

  if(!(self.data >= 0 && self.data <= 2)){
    self.response = "Invalid badge";
    resolve();
    return;
  }

  var sql  = `SELECT badge FROM users WHERE id=?`;
  var args = [self.id];

  conn.query(sql, args, function(err, rows){
    var row   = rows[0];
    var badge = row["badge"].split(",");

    if(badge[self.data]){
      var deleteBadge = badge[self.data].split("/").pop();
      var deletePath = `static/fek-badges/${deleteBadge}`;

      badge[self.data] = "";
      badge = badge.join(",");

      var sql  = `UPDATE users SET badge=? WHERE id=?`;
      var args = [badge, self.id];

      self.response = "Badge removed. Fish Chip upkeep has been reduced by 3.";
      conn.query(sql, args, function(err, rows){
        fs.unlinkSync(deletePath);
        resolve();
      });
    }else{
      self.response = "You don't have a badge in that slot.";
      resolve();
    }
  });
})}

ManageCosmetics.prototype.AdvanceDay = function(){return new Promise((resolve) => {
  var self = this;

  // Check all non-staff and reduce the number of FC they have by this:
  var sql = `SELECT id, fish_chips, title, badge
             FROM users WHERE staff != 1 AND
             (title != '' OR badge != ',,')`;

  conn.query(sql, function(err, rows){
    for(var i = 0; i < rows.length; i++){
      var row       = rows[i];
      var cosmetics = 0;

      if(row["title"])
        cosmetics++;

      if(row["badge"]){
        var badges = row["badge"].split(",");
        for(var i = 0; i < badges.length; i++){
          if(badges[i])
            cosmetics++;
        }
      }

      var upkeep = cosmetics * 3;

      if(row["fish_chips"] >= upkeep){
        // Deduct Fish Chips if the user can pay for it
        var newFC = row["fish_chips"] - upkeep;
        var sql   = `UPDATE users SET fish_chips=? WHERE id=?`;
        var args  = [newFC, row["id"]];
        conn.query(sql, args, function(err, rows){});
      }else{
        // Remove all cosmetics if the user can't pay for it
        var sql  = `UPDATE users SET title='', badge=',,' WHERE id=?`;
        var args = [row["id"]];
        conn.query(sql, args, function(err, rows){});
      }
    }
  });
  resolve();
})}

app.post("/managecosmetics", function(req, res){
  var manageCosmetics = new ManageCosmetics();

  manageCosmetics.Initialize(req)
  .then(() => manageCosmetics.AuthenticateUser())
  .then(() => res.json(manageCosmetics.response))
})

function WebPanel(){}

WebPanel.prototype.Initialize = function(req){return new Promise((resolve) => {
  var self = this;
  self.response = {};

  self.form = new formidable.IncomingForm();
  self.form.parse(req, function(err, data, files){
    for(key in data)
      self[key] = data[key];

    resolve();
  });
})}

WebPanel.prototype.GetWebPanel = function(){return new Promise((resolve) => {
  var self = this;

  self.response = `webpanels/${self.page}.ejs`;
  var checkPath = `views/${self.response}`;

  fs.access(checkPath, (error) => {
    if(error)
      self.response = `404.ejs`;

    resolve();
  });
})}

app.post("/webpanel", function(req, res){
  var webPanel = new WebPanel();

  webPanel.Initialize(req)
  .then(() => webPanel.GetWebPanel())
  .then(() => res.render(webPanel.response))
})

// wrenchmenIndex
// wrenchmenThread
// wrenchmenStatus

function TwitterTracker(){
  this.LoadConfig()
  .then((r) => {
    if(!r)
      this.Check();
  });
}

TwitterTracker.prototype.LoadConfig = function(){return new Promise((resolve) => {
  fs.readFile("config.json", "utf-8", (error, data) => {
    if(error){
      console.log(error);
      resolve(1);
      return;
    }

    this["data"] = JSON.parse(data);
    resolve(0);
  });
})}

TwitterTracker.prototype.Check = function(){return new Promise((resolve) => {

  var client = new twitter({
    consumer_key:        this["data"]["consumer_key"],
    consumer_secret:     this["data"]["consumer_secret"],
    access_token_key:    this["data"]["access_token_key"],
    access_token_secret: this["data"]["access_token_secret"]
  });

  setInterval(function(){
    var params = {screen_name: "TundraFizzTest"};

    client.get("statuses/user_timeline", params, function(error, tweets, response){
      if(error){
        console.log(error);
        return;
      }

      var tweetContainer = [];

      for(var i = 0; i < tweets.length; i++){
        var id           = tweets[i].id_str;
        var createdAt    = tweets[i].created_at;
        var name         = tweets[i].user.name;
        var screenName   = tweets[i].user.screen_name;
        var avatar       = tweets[i].user.profile_image_url_https;
        var text         = tweets[i].text;
        var hashtags     = tweets[i].entities.hashtags;
        var announcement = false;

        createdAt = moment(createdAt, "dd MMM DD HH:mm:ss ZZ YYYY").format();

        for(var j = 0; j < hashtags.length; j++){
          if(hashtags[j].text.toLowerCase() == "bek")
            announcement = true;

          for(var k = hashtags[j].indices[0]; k < hashtags[j].indices[1]; k++){
            var head = text.substring(0, k);
            var tail = text.substring(k+1, text.length);
            text = head + " " + tail;
          }
        }

        if(announcement){
          text = text.trim().replace(/\s+/g, " ");
          var tempObj = {
            "id":         id,
            "createdAt":  createdAt,
            "name":       name,
            "screenName": screenName,
            "avatar":     avatar,
            "text":       text
          };
          tweetContainer.push(tempObj);
        }
      }

      for(var i = 0; i < tweetContainer.length; i++){
        var sql  = `SELECT * FROM tweets WHERE id=?`;
        var args = [tweetContainer[i]["id"]];
        conn.query(sql, args, (function(i){ return function(err, rows){
          if(rows.length == 0){
            var id         = tweetContainer[i]["id"];
            var createdAt  = tweetContainer[i]["createdAt"];
            var name       = tweetContainer[i]["name"];
            var screenName = tweetContainer[i]["screenName"];
            var avatar     = tweetContainer[i]["avatar"];
            var text       = tweetContainer[i]["text"];

            var sql  = `INSERT INTO tweets (id, created_at, name, screen_name, profile_image_url, text) VALUES (?,?,?,?,?,?)`;
            var args = [id, createdAt, name, screenName, avatar, text];
            conn.query(sql, args);
          }
        }})(i));
      }
    });
  }, 5000);

  resolve(0);
})}

// var twitterTracker = new TwitterTracker();

// app.post("/querytweets", function(req, res){

//   var sql  = `SELECT * FROM tweets ORDER BY id DESC LIMIT 2;`;
//   conn.query(sql, function(error, rows){
//     if(error){
//       console.log(error);
//       res.json(null);
//       return;
//     }

//     res.json(rows);
//   });
// });
