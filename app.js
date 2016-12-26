/*
 *  _____                    _                    _
 * |  __ \                  | |                  | |
 * | |  | |  ___   ___  ____| |  ___    __ _   __| |  ___  _ __
 * | |  | | / _ \ / _ \|_  /| | / _ \  / _` | / _` | / _ \| '__|
 * | |__| ||  __/|  __/ / / | || (_) || (_| || (_| ||  __/| |
 * |_____/  \___| \___|/___||_| \___/  \__,_| \__,_| \___||_|
 *
 *
 *
 *  Maintained by ParadoxalManiak <https://www.reddit.com/user/ParadoxalManiak/>
 *  Original work by ZzMTV <https://boerse.to/members/zzmtv.3378614/>
 * */

// Setup error logging
var winston = require('winston');
winston.add(winston.transports.File, {
  filename: __dirname + '/deezloader.log',
  handleExceptions: true,
  humanReadableUnhandledException: true
});

var electron = require('electron');
var electronApp = electron.app;
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var http = require('http');
var io = require('socket.io').listen(server, {log: false});
var fs = require('fs');
var async = require('async');
var request = require('request');
var nodeID3 = require('node-id3');
var Deezer = require('./deezer-api');
var mkdirp = require('mkdirp');
var config = require('./config.json');

// Setup the folders
var mainFolder = electronApp.getPath('music') + '/Deezloader';
initFolders();
module.exports.mainFolder = mainFolder;

// Route and Create server
app.use('/', express.static(__dirname + '/public/'));
server.listen(config.serverPort);
console.log('Server is running @ localhost:' + config.serverPort);

// Deezer API init START
// Initiate the Deezer API, or try to until the fucking server dies
var initialized = false; // The magic var

var tryInit = setInterval(function () {
  Deezer.init(function (err) {
    if (err) {
      console.log(err);
      return;
    }
    clearInterval(tryInit);
    initialized = true;
  });
}, 1000);
// END

// START sockets clusterfuck
io.sockets.on('connection', function (socket) {
  socket.downloadQueue = [];
  socket.downloadWorker = null;
  socket.lastQueueId = null;

  socket.on("checkInit", function (data) {
    socket.emit("checkInit", {status: initialized});
  });

  Deezer.onDownloadProgress = function (track, progress) {
    if (!track.trackSocket) {
      return;
    }
    var complete = 0;
    if (track.trackSocket.downloadWorker.type != "track") {
      return;
    }
    if (!track.trackSocket.downloadWorker.percentage) {
      track.trackSocket.downloadWorker.percentage = 0;
    }
    if (track["FILESIZE_MP3_320"] >= 0) {
      complete = track["FILESIZE_MP3_320"];
    } else if (track["FILESIZE_MP3_256"]) {
      complete = track["FILESIZE_MP3_256"];
    } else {
      complete = track["FILESIZE_MP3_128"] || 0;
    }

    var percentage = (progress / complete) * 100;

    if ((percentage - track.trackSocket.downloadWorker.percentage > 1) || (progress == complete)) {
      track.trackSocket.downloadWorker.percentage = percentage;
      track.trackSocket.emit("downloadProgress", {
        queueId: track.trackSocket.downloadWorker.queueId,
        percentage: track.trackSocket.downloadWorker.percentage
      });
    }
  };

  function queueWorker() {
    if (socket.downloadWorker != null || socket.downloadQueue.length == 0) {
      if (socket.downloadQueue.length == 0 && socket.downloadWorker == null) {
        socket.emit("emptyDownloadQueue", {});
      }
      return;
    }
    socket.downloadWorker = socket.downloadQueue[0];
    if (socket.lastQueueId != socket.downloadWorker.queueId) {
      socket.emit("downloadStarted", {queueId: socket.downloadWorker.queueId});
      socket.lastQueueId = socket.downloadWorker.queueId;
    }

    if (socket.downloadWorker.type == "track") {
      downloadTrack(socket.downloadWorker.id, socket.downloadWorker.settings, function (err) {
        if (err) {
          socket.downloadWorker.failed++;
        } else {
          socket.downloadWorker.downloaded++;
        }
        socket.emit("updateQueue", socket.downloadWorker);
        if (socket.downloadWorker && socket.downloadQueue[0] && (socket.downloadQueue[0].queueId == socket.downloadWorker.queueId)) socket.downloadQueue.shift();
        socket.downloadWorker = null;
        queueWorker();
      });
    } else if (socket.downloadWorker.type == "playlist") {
      Deezer.getPlaylistTracks(socket.downloadWorker.id, function (err, tracks) {
        for (var i = 0; i < tracks.data.length; i++) {
          tracks.data[i] = tracks.data[i].id;
        }
        socket.downloadWorker.playlistContent = tracks.data;
        socket.downloadWorker.settings.addToPath = socket.downloadWorker.name;
        async.eachSeries(socket.downloadWorker.playlistContent, function (id, callback) {
          if (socket.downloadWorker.cancelFlag) {
            callback("stop");
            return;
          }
          socket.downloadWorker.settings.playlist = {
            position: socket.downloadWorker.playlistContent.indexOf(id),
            fullSize: socket.downloadWorker.playlistContent.length
          };
          downloadTrack(id, socket.downloadWorker.settings, function (err) {
            if (!err) {
              socket.downloadWorker.downloaded++;
            } else {
              console.log(err);
              socket.downloadWorker.failed++;
            }
            socket.emit("updateQueue", socket.downloadWorker);
            callback();
          });
        }, function (err) {
          console.log("Playlist finished: " + socket.downloadWorker.name);
          if (socket.downloadWorker && socket.downloadQueue[0] && socket.downloadQueue[0].queueId == socket.downloadWorker.queueId) socket.downloadQueue.shift();
          socket.downloadWorker = null;
          queueWorker();
        });
      });
    } else if (socket.downloadWorker.type == "album") {
      Deezer.getAlbumTracks(socket.downloadWorker.id, function (err, tracks) {
        for (var i = 0; i < tracks.data.length; i++) {
          tracks.data[i] = tracks.data[i].id;
        }
        socket.downloadWorker.playlistContent = tracks.data;
        socket.downloadWorker.settings.tagPosition = true;
        socket.downloadWorker.settings.addToPath = socket.downloadWorker.artist + " - " + socket.downloadWorker.name;
        async.eachSeries(socket.downloadWorker.playlistContent, function (id, callback) {
          if (socket.downloadWorker.cancelFlag) {
            callback("stop");
            return;
          }
          socket.downloadWorker.settings.playlist = {
            position: socket.downloadWorker.playlistContent.indexOf(id),
            fullSize: socket.downloadWorker.playlistContent.length
          };
          downloadTrack(id, socket.downloadWorker.settings, function (err) {
            if (socket.downloadWorker.countPerAlbum) {
              callback();
              return;
            }
            if (!err) {
              socket.downloadWorker.downloaded++;
            } else {
              socket.downloadWorker.failed++;
            }
            socket.emit("updateQueue", socket.downloadWorker);
            callback();
          });
        }, function (err) {
          if (socket.downloadWorker.countPerAlbum) {
            socket.downloadWorker.downloaded++;
            if (socket.downloadQueue.length > 1 && socket.downloadQueue[1].queueId == socket.downloadWorker.queueId) {
              socket.downloadQueue[1].download = socket.downloadWorker.downloaded;
            }
            socket.emit("updateQueue", socket.downloadWorker);
          }
          console.log("Album finished: " + socket.downloadWorker.name);
          if (socket.downloadWorker && socket.downloadQueue[0] && socket.downloadQueue[0].queueId == socket.downloadWorker.queueId) socket.downloadQueue.shift();
          socket.downloadWorker = null;
          queueWorker();
        });
      });
    }
  }

  socket.on("downloadtrack", function (data) {
    Deezer.getTrack(data.id, function (err, track) {
      if (err) {
        console.log(err);
        return;
      }
      var queueId = "id" + Math.random().toString(36).substring(2);
      var _track = {
        name: track["SNG_TITLE"],
        size: 1,
        downloaded: 0,
        failed: 0,
        queueId: queueId,
        id: track["SNG_ID"],
        type: "track"
      };
      if (track["VERSION"]) _track.name = _track.name + " " + track["VERSION"];
      _track.settings = data.settings || {};
      socket.downloadQueue.push(_track);
      socket.emit("addToQueue", _track);
      queueWorker();
    });
  });

  socket.on("downloadplaylist", function (data) {
    Deezer.getPlaylist(data.id, function (err, playlist) {
      if (err) {
        console.log(err);
        return;
      }
      Deezer.getPlaylistSize(data.id, function (err, size) {
        if (err) {
          console.log(err);
          return;
        }
        var queueId = "id" + Math.random().toString(36).substring(2);
        var _playlist = {
          name: playlist["title"],
          size: size,
          downloaded: 0,
          failed: 0,
          queueId: queueId,
          id: playlist["id"],
          type: "playlist"
        };
        _playlist.settings = data.settings || {};
        socket.downloadQueue.push(_playlist);
        socket.emit("addToQueue", _playlist);
        queueWorker();
      });
    });
  });

  socket.on("downloadalbum", function (data) {
    Deezer.getAlbum(data.id, function (err, album) {
      if (err) {
        console.log(err);
        return;
      }
      Deezer.getAlbumSize(data.id, function (err, size) {
        if (err) {
          console.log(err);
          return;
        }
        var queueId = "id" + Math.random().toString(36).substring(2);
        var _album = {
          name: album["title"],
          label: album["label"],
          artist: album["artist"].name,
          size: size,
          downloaded: 0,
          failed: 0,
          queueId: queueId,
          id: album["id"],
          type: "album"
        };
        _album.settings = data.settings || {};
        socket.downloadQueue.push(_album);
        socket.emit("addToQueue", _album);
        queueWorker();
      });
    });
  });

  socket.on("downloadartist", function (data) {
    Deezer.getArtist(data.id, function (err, artist) {
      if (err) {
        console.log(err);
        return;
      }
      Deezer.getArtistAlbums(data.id, function (err, albums) {
        if (err) {
          console.log(err);
          return;
        }

        var queueId = "id" + Math.random().toString(36).substring(2);
        for (var i = 0; i < albums.data.length; i++) {
          var album = albums.data[i];
          var _album = {
            name: album["title"],
            artist: artist.name,
            downloaded: 0,
            failed: 0,
            queueId: queueId,
            id: album["id"],
            type: "album",
            countPerAlbum: true
          };
          _album.settings = data.settings || {};
          socket.downloadQueue.push(_album);
        }
        var showDl = {
          size: albums.data.length,
          name: artist.name + " (ARTIST)",
          downloaded: 0,
          failed: 0,
          queueId: queueId
        }
        socket.emit("addToQueue", showDl);
        queueWorker();

      });
    });
  });

  socket.on("getChartsTopCountry", function (data) {
    Deezer.getChartsTopCountry(function (err, charts) {
      charts = charts || {};
      if (err) {
        charts.data = [];
      }
      socket.emit("getChartsTopCountry", {charts: charts.data, err: err});
    });
  });

  socket.on("getChartsCountryList", function (data) {
    Deezer.getChartsTopCountry(function (err, charts) {
      charts = charts.data || [];
      var countries = [];
      for (var i = 0; i < charts.length; i++) {
        var obj = {
          country: charts[i].title.replace("Top ", ""),
          picture_small: charts[i].picture_small,
          picture_medium: charts[i].picture_medium,
          picture_big: charts[i].picture_big
        };
        countries.push(obj);
      }
      socket.emit("getChartsCountryList", {countries: countries, selected: data.selected});
    });
  });

  socket.on("getChartsTrackListByCountry", function (data) {
    if (!data.country) {
      socket.emit("getChartsTrackListByCountry", {err: "No country passed"});
      return;
    }

    Deezer.getChartsTopCountry(function (err, charts) {
      charts = charts.data || [];
      var countries = [];
      for (var i = 0; i < charts.length; i++) {
        countries.push(charts[i].title.replace("Top ", ""));
      }

      if (countries.indexOf(data.country) == -1) {
        socket.emit("getChartsTrackListByCountry", {err: "Country not found"});
        return;
      }

      var playlistId = charts[countries.indexOf(data.country)].id;

      Deezer.getPlaylistTracks(playlistId, function (err, tracks) {
        if (err) {
          socket.emit("getChartsTrackListByCountry", {err: err});
          return;
        }
        socket.emit("getChartsTrackListByCountry", {
          playlist: charts[countries.indexOf(data.country)],
          tracks: tracks.data
        });
      });
    });
  });

  socket.on("search", function (data) {
    data.type = data.type || "track";
    if (["track", "playlist", "album", "artist"].indexOf(data.type) == -1) {
      data.type = "track";
    }
    Deezer.search(data.text, data.type, function (err, searchObject) {
      socket.emit("search", {type: data.type, items: searchObject.data});
    });
  });

  socket.on("getInformation", function (data) {
    if (!data.type || (["track", "playlist", "album", "artist"].indexOf(data.type) == -1) || !data.id) {
      socket.emit("getInformation", {err: -1, response: {}, id: data.id});
      return;
    }

    var reqType = data.type.charAt(0).toUpperCase() + data.type.slice(1);

    Deezer["get" + reqType](data.id, function (err, response) {
      if (err) {
        socket.emit("getInformation", {err: "wrong id", response: {}, id: data.id});
        return;
      }
      socket.emit("getInformation", {response: response, id: data.id});
    });
  });

  socket.on("getTrackList", function (data) {
    if (!data.type || (["playlist", "album", "artist"].indexOf(data.type) == -1) || !data.id) {
      socket.emit("getTrackList", {err: -1, response: {}, id: data.id, reqType: data.type});
      return;
    }

    if (data.type == 'artist'){
      Deezer.getArtistAlbums(data.id, function (err, response) {
        if (err) {
          socket.emit("getTrackList", {err: "wrong id", response: {}, id: data.id, reqType: data.type});
          return;
        }
        socket.emit("getTrackList", {response: response, id: data.id, reqType: data.type});
      });
    }else{
      var reqType = data.type.charAt(0).toUpperCase() + data.type.slice(1);

      Deezer["get" + reqType + "Tracks"](data.id, function (err, response) {
        if (err) {
          socket.emit("getTrackList", {err: "wrong id", response: {}, id: data.id, reqType: data.type});
          return;
        }
        socket.emit("getTrackList", {response: response, id: data.id, reqType: data.type});
      });
    }

  });

  socket.on("cancelDownload", function (data) {
    if (!data.queueId) {
      return;
    }

    var cancel = false;

    for (var i = 0; i < socket.downloadQueue.length; i++) {
      if (data.queueId == socket.downloadQueue[i].queueId) {
        socket.downloadQueue.splice(i, 1);
        i--;
        cancel = true;
      }
    }

    if (socket.downloadWorker && socket.downloadWorker.queueId == data.queueId) {
      var cancelSuccess = Deezer.cancelDecryptTrack();
      cancel = cancel || cancelSuccess;
    }


    if (cancelSuccess && socket.downloadWorker) {
      socket.downloadWorker.cancelFlag = true;
    }
    if (cancel) {
      socket.emit("cancelDownload", {queueId: data.queueId});
    }
  });

  socket.on("downloadAlreadyInQueue", function (data) {
    if (data.id) {
      return;
    }
    var isInQueue = checkIfAlreadyInQueue(data.id);
    if (isInQueue) {
      socket.emit("downloadAlreadyInQueue", {alreadyInQueue: true, id: data.id, queueId: isInQueue});
    } else {
      socket.emit("downloadAlreadyInQueue", {alreadyInQueue: false, id: data.id});
    }
  });

  function downloadTrack(id, settings, callback) {
    Deezer.getTrack(id, function (err, track) {
      if (err) {
        callback(err);
        return;
      }

      track.trackSocket = socket;

      settings = settings || {};

      if (track["VERSION"]) track["SNG_TITLE"] += " " + track["VERSION"];

      var metadata = {
        title: track["SNG_TITLE"],
        artist: track["ART_NAME"],
        album: track["ALB_TITLE"]
      };

      if (track["PHYSICAL_RELEASE_DATE"]) metadata.year = track["PHYSICAL_RELEASE_DATE"].slice(0, 4);
      if (track["TRACK_NUMBER"]) metadata.trackNumber = track["TRACK_NUMBER"] + "";

      if (settings.tagPosition) {
        metadata.trackNumber = (settings.playlist.position + 1) + "/" + settings.playlist.fullSize;
      }

      if (track["ALB_PICTURE"]) {
        metadata.image = Deezer.albumPicturesHost + track["ALB_PICTURE"] + Deezer.albumPictures.big;
      }

      var filename = metadata.artist + " - " + metadata.title;
      if (settings.filename != "" && settings.filename) {
        filename = settingsRegex(metadata, settings.filename, settings.playlist);
      }

      var filepath = mainFolder + '/mp3/';
      if (settings.path) {
        if (settings.path[settings.path.length - 1] != "/") settings.path += "/";
        filepath = settings.path;
        if (!fs.existsSync(filepath)) {
          var newFolder;
          try {
            newFolder = mkdirp.sync(filepath);
          } catch (e) {
            filepath = mainFolder + '/mp3/';
          } finally {
            if (!newFolder) {
              filepath = mainFolder + '/mp3/';
            }
          }
        }
      }

      if (settings.addToPath) {
        filepath += fixName(settings.addToPath, true) + '/';
      } else {
        if (settings.createArtistFolder) {
          filepath += fixName(metadata.artist, true) + '/';
          if (!fs.existsSync(filepath)) {
            fs.mkdirSync(filepath);
          }
        }

        if (settings.createAlbumFolder) {
          filepath += fixName(metadata.album, true) + '/';
          if (!fs.existsSync(filepath)) {
            fs.mkdirSync(filepath);
          }
        }
      }

      //Create folder if doesn't exist
      if (!fs.existsSync(filepath)) {
        fs.mkdirSync(filepath);
      }

      writePath = filepath + fixName(filename, true) + '.mp3';

      if (fs.existsSync(writePath)) {
        console.log("Already downloaded: " + metadata.artist + ' - ' + metadata.title)
        callback();
        return;
      }

      //Get image
      if (metadata.image) {
        var imagefile = fs.createWriteStream(mainFolder + "/img/" + fixName(metadata.title, true) + ".jpg");
        http.get(metadata.image, function (response) {
          if (!response) {
            metadata.image = undefined;
            return;
          }
          response.pipe(imagefile);
          metadata.image = (mainFolder + '/img/' + fixName(metadata.title, true) + ".jpg").replace(/\\/g, "/");
        });
      }

      Deezer.decryptTrack(track, function (err, buffer) {
        if (err && err.message == "aborted") {
          socket.downloadWorker.cancelFlag = true;
          callback();
          return;
        }
        if (err) {
          Deezer.hasTrackAlternative(id, function (err, alternative) {
            if (err || !alternative) {
              callback(err);
              return;
            }
            downloadTrack(alternative.id, settings, callback);
          });
          return;
        }

        fs.writeFile(writePath, buffer, function (err) {
          if (err) {
            callback(err);
            return;
          }

          if (settings.createM3UFile && settings.playlist) {
            fs.appendFileSync(filepath + "playlist.m3u", filename + ".mp3\r\n");
          }

          console.log("Downloaded: " + metadata.artist + " - " + metadata.title);

          //Write ID3-Tags
          if (!nodeID3.write(metadata, writePath)) {
            //log
          }

          callback();
        });

      });
    });
  }

  function checkIfAlreadyInQueue(id) {
    var exists = false;
    for (var i = 0; i < socket.downloadQueue.length; i++) {
      if (socket.downloadQueue[i].id == id) {
        exists = socket.downloadQueue[i].queueId;
      }
    }
    if (socket.downloadWorker && (socket.downloadWorker.id == id)) {
      exists = socket.downloadWorker.queueId;
    }
    return exists;
  }
});

var specialCharTable = ["ç", "Ç", "ğ", "Ğ", "ı", "I", "i", "İ", "ş", "Ş"];
var specialCharTo = ["c", "C", "g", "G", "i", "I", "i", "I", "s", "S"];

var fixName = function (input, file) {
  var regEx = new RegExp('[,/\\\\:*?""<>|]', 'g');
  if (!file) {
    regEx = new RegExp('[/\\\\""<>|]', 'g');
  }
  var fixedName = input.replace(regEx, '_');
  for (var i = 0; i < specialCharTable.length; i++) {
    regEx = new RegExp(specialCharTable[i], 'g');
    fixedName = fixedName.replace(regEx, specialCharTo[i]);
  }
  while (fixedName && fixedName.slice(-1) === ".") {
    fixedName = fixedName.slice(0, -1);
  }
  return fixedName;
}

function initFolders() {
  // Define the vars
  var coverArtDir = mainFolder + "/img";
  var mp3FilesDir = mainFolder + "/mp3";

  // Create main folder
  if (!fs.existsSync(mainFolder)) {
    fs.mkdirSync(mainFolder)
  }

  // Check if folder for covers exists. Create if not
  if (fs.existsSync(coverArtDir)) {

    // Delete each file inside the folder
    fs.readdirSync(coverArtDir).forEach(function (file, index) {
      var curPath = coverArtDir + "/" + file;
      fs.unlinkSync(curPath);
    });

    // Delete the folder and make a new one
    fs.rmdir(coverArtDir, function (err) {
      fs.mkdirSync(coverArtDir);
    });
  } else {
    fs.mkdirSync(coverArtDir);
  }

  // Create if folder for audio files does not exist
  if (!fs.existsSync(mp3FilesDir)) {
    fs.mkdirSync(mp3FilesDir)
  }
}

function settingsRegex(metadata, filename, playlist) {
  filename = filename.replace(/%title%/g, metadata.title);
  filename = filename.replace(/%album%/g, metadata.album);
  filename = filename.replace(/%artist%/g, metadata.artist);
  if (playlist) {
    filename = filename.replace(/%number%/g, pad(playlist.position + 1, playlist.fullSize.toString().length));
  }
  return filename;
}

function pad(str, max) {
  str = str.toString();
  return str.length < max ? pad("0" + str, max) : str;
}

process.on('uncaughtException', function (err) {
  console.trace(err);
});
