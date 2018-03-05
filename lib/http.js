var path = require("path");
var fs = require("fs");
var mime = require('mime-types');
var http = require("http");
var url = require("url");
var qs = require('querystring');
var formidable = require('formidable');
var _ = require('lodash');

module.exports = function(synapps) {
  function processHttpRequest(req, response) {
    if (req.type === 'jsonp') {
      // jsonp
      synapps._scheduler.send(req).done(function(result) {
        response.writeHead(200, { 'content-type': 'text/json' });
        response.end(result.callback + '(' + JSON.stringify(result.data) + ');');
      }).fail(function(err) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        if (err && err.notification && err.notification.type === 'ERROR') {
          response.write(err.notification.msg);
          return response.end();
        } else if (_.isObject(err)) {
          if (err instanceof Error) {
            err = err.message;
          } else {
            err = JSON.stringify(err);
          }
          response.write(err);
        } else {
          response.write(err);
        }
        response.end();
      });
    } else {
      // http
      synapps._scheduler.send(req).done(function(result) {
        response.writeHead(200, result.headers);
        if (!result.data) {
          return response.end();
        } else if (result.headers['content-type'] === 'text/json') {
          response.write(JSON.stringify(result.data));
        } else {
          if (_.isString(result.data) || _.isBuffer(result.data)) {
            response.write(result.data);
          } else {
            synapps.debug('error', 'invalid response type ' + typeof result.data);
          }
        }
        response.end();
      }).fail(function(err) {
        if (err && err.notification && err.notification.type === 'ERROR') {
          if (err.notification.msg === '#404_ERROR') {
            response.writeHead(404, { "Content-Type": "text/plain" });
          } else {
            response.writeHead(500, { "Content-Type": "text/plain" });
          }
          response.write(err.notification.msg);
          return response.end();
        } else if (_.isObject(err)) {
          if (err instanceof Error) {
            err = err.message;
          } else {
            err = JSON.stringify(err);
          }
          response.writeHead(500, { "Content-Type": "text/plain" });
          response.write(err);
        } else {
          response.writeHead(500, { "Content-Type": "text/plain" });
          response.write(err);
        }
        response.end();
      });
    }
  }

  function getPostData(request, cb) {
    var fields = {};
    var form = new formidable.IncomingForm();

    form.on('field', function(name, value) {
      fields[name] = value;
    });

    form.onPart = function(part) {
      if (part.filename === void 0) {
        return form.handlePart(part);
      }

      form._flushing++;
      fields[part.name] = fields[part.name] || [];

      part.on('data', function(buffer) {
        if (buffer.length == 0) {
          return;
        }
        fields[part.name].push(buffer);
      });

      part.on('end', function() {
        form._flushing--;
        fields[part.name] = Buffer.concat(fields[part.name]);
        form._maybeEnd();
      });
    };

    form.parse(request, function(err) {
      if (err) {
        return cb(err);
      }
      cb(null, fields);
    });
  }

  function createRequest(request, cb) {
    var uri = url.parse(request.url).pathname;
    uri = qs.unescape(uri);
    var apiDir = synapps._config.apiDir;

    if (apiDir && uri.startsWith('/' + apiDir)) {
      uri = uri.slice(apiDir.length + 2, uri.length);
    } else {
      uri = uri.slice(1, uri.length);
    }

    var method = request.method.toLowerCase();
    if (method === 'post') {
      getPostData(request, function(err, data) {
        if (err) {
          return cb(err);
        }
        cb(null, {
          type: 'http',
          method: 'post',
          request: uri.replace(/:/g, '/'),
          sessionID: data.sessionID,
          data: data
        });
      });
    } else {
      var urlData = url.parse(request.url, true).query;
      if (urlData.callback) {
        // JSONP request
        return cb(null, {
          type: 'jsonp',
          request: uri.replace(/:/g, '/'),
          sessionID: null,
          data: urlData,
          callback: urlData.callback
        });
      }
      // HTTP request
      return cb(null, {
        type: 'http',
        method: method,
        request: uri.replace(/:/g, '/'),
        sessionID: null,
        data: urlData
      });
    }
  }

  var server = http.createServer(function(request, response) {

    var uri = url.parse(request.url).pathname;

    var apiDir = synapps._config.apiDir;
    if (apiDir && uri.startsWith('/' + apiDir)) {
      if (uri === '/' + apiDir + '/socket.io') {
        return;
      }
      return createRequest(request, function(err, req) {
        if (err) {
          response.writeHead(400, { "Content-Type": "text/plain" });
          response.write("#BAD_REQUEST");
          response.end();
          return;
        }
        processHttpRequest(req, response);
      });
    } else {
      if (uri === '/socket.io') {
        return;
      }
      if (synapps._config.staticDir) {
        var filename = path.join(synapps._config.staticDir, uri);
        fs.exists(filename, function(exists) {
          if (exists) {
            fs.stat(filename, function(err, stat) {
              if (err) {
                response.writeHead(404, { "Content-Type": "text/plain" });
                response.write("#404_NOT_FOUND");
                response.end();
                return;
              }
              if (stat.isDirectory()) {
                filename = path.join(filename, 'index.html');
              }
              fs.readFile(filename, "binary", function(err, file) {
                if (err) {
                  response.writeHead(500, { "Content-Type": "text/plain" });
                  response.write("#INTERNAL_SERVER_ERROR");
                  response.end();
                  return;
                }
                var contentType = mime.lookup(filename) || 'application/octet-stream';
                response.writeHead(200, { "Content-Type": contentType });
                response.write(file, "binary");
                response.end();
              });
            });
          } else {
            return createRequest(request, function(err, req) {
              if (err) {
                response.writeHead(400, { "Content-Type": "text/plain" });
                response.write("#BAD_REQUEST");
                response.end();
                return;
              }
              processHttpRequest(req, response);
            });
          }
        });
      } else {
        return createRequest(request, function(err, req) {
          if (err) {
            response.writeHead(400, { "Content-Type": "text/plain" });
            response.write("#BAD_REQUEST");
            response.end();
            return;
          }
          processHttpRequest(req, response);
        });
      }
    }
  });

  return server;
};
