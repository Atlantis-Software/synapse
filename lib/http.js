var path = require("path");
var fs = require("fs");
var mime = require('mime');
var http = require("http");
var url = require("url");
var qs = require('querystring');
var formidable = require('formidable');
var _ = require('lodash');

module.exports = function(synapse) {
  function processHttpRequest(req, response) {
    if (req.type === 'jsonp') {
      // jsonp
      synapse._scheduler.send(req).done(function(result) {
        response.writeHead(200, { 'content-type': 'text/json' });
        response.end(result.callback + '(' + JSON.stringify(result.data) + ');');
      });
    } else {
      // http
      synapse._scheduler.send(req).done(function(result) {
        response.writeHead(200, result.headers);
        if (result.headers['content-type'] === 'text/json') {
          response.write(JSON.stringify(result.data));
        } else {
          response.write(result.data);
        }
        response.end();
      }).fail(function(err) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        if (err && err.notification && err.notification.type === 'ERROR') {
          response.write(err.notification.msg + "\n");
          return response.end();
        } else if (_.isObject(err)) {
          response.write(JSON.stringify(err));
        } else {
          response.write(err);
        }
        response.end();
      });
    }
  }

  var server = http.createServer(function(request, response) {

    var uri = url.parse(request.url).pathname;
    var pathChunk = path.normalize(uri).split(path.sep);
    pathChunk = pathChunk.slice(1, pathChunk.length);
    var apiDir = synapse._config.apiDir;


    if (pathChunk[0] === apiDir && pathChunk[1] === 'socket.io') {
      return;
    } else if (pathChunk[0] === apiDir) {
      var req;
      if (request.method.toLowerCase() === 'post') {
        var form = new formidable.IncomingForm();
        form.parse(request, function(err, fields, files) {
          if (err) {
            response.writeHead(500, { "Content-Type": "text/plain" });
            response.write("invalid post data\n");
            return response.end();
          }
          // HTTP post request
          var data = _.merge({}, fields, files);
          req = {
            type: 'http',
            request: pathChunk[1],
            sessionID: fields.sessionID,
            data: data
          };
          processHttpRequest(req, response);
        });

      } else {
        var urlData = url.parse(request.url, true).query;
        if (urlData.callback) {
          // JSONP request
          req = {
            type: 'jsonp',
            request: urlData.request,
            sessionID: null,
            data: urlData.data,
            callback: urlData.callback
          };
        } else {
          // HTTP request
          req = {
            type: 'http',
            request: pathChunk[1],
            sessionID: null,
            data: urlData
          };
        }
        processHttpRequest(req, response);
      }
    } else if (synapse._config.staticDir) {
      var filename = path.join(synapse._config.staticDir, uri);
      fs.exists(filename, function(exists) {
        if (!exists) {
          response.writeHead(404, { "Content-Type": "text/plain" });
          response.write("404 Not Found\n");
          response.end();
          return;
        }

        if (fs.statSync(filename).isDirectory()) {
          filename = path.join(filename, 'index.html');
        }

        fs.readFile(filename, "binary", function(err, file) {
          if (err) {
            response.writeHead(500, { "Content-Type": "text/plain" });
            response.write(err + "\n");
            response.end();
            return;
          }
          var contentType = mime.lookup(filename) || 'application/octet-stream';
          response.writeHead(200, { "Content-Type": contentType });
          response.write(file, "binary");
          response.end();
        });
      });
    }
  })
  return server;
};
