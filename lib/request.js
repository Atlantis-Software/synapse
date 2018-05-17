var moment = require('moment-timezone');
var asynk = require('asynk');
var validator = require('offshore-validator');
var _ = require('lodash');
var util = require('util');
var requestErrorHandler = require('./requestErrorHandler');
var os = require('os');

var request = function(event, route) {
  if (!event || !_.isObject(event) || !event.data ) {
    throw new Error('Invalid event message from IPC');
  }
  var self = this;
  var requestInfo = event.data;
  _.assign(this, asynk.deferred());
  this.headers = {};
  this.start = Date.now();
  this.end = null;
  this.sessionID = requestInfo.sessionID;
  this.request = requestInfo.request;
  this.type = requestInfo.type;
  this.data = requestInfo.data;
  // errors
  this.validationErrors = [];
  this.requestErrorHandler = new requestErrorHandler(this);

  var Result = function() {
    return {
      notification: {
        type: "ERROR",
        msg: "#UNKNOWN_ERROR",
        uid: requestInfo.uid
      },
      data: null,
      headers: self.headers
    };
  };

  if (this.type === 'cluster' && event.data.clusterInfo) {
    this.clusterInfo = event.data.clusterInfo;
  }

  this.done(function(data) {
    if (self.headers['content-type'] === void 0 && self.type === 'http' && _.isString(data)) {
      self.setHeader('content-type', 'text/html');
    } else if (self.headers['content-type'] === void 0) {
      self.setHeader('content-type', 'text/json');
    }
    self.end = Date.now();
    var result = Result();
    if (self.type === 'jsonp') {
      result.callback = requestInfo.callback;
    }
    result.notification.type = "SUCCESS";
    result.notification.msg = '#OK';
    result.data = data;
    self.requestErrorHandler.exit();
    event.resolve(result);
  });

  this.fail(function(err) {
    err = err || '#UNKNOWN_ERROR';
    if (_.isObject(err)) {
      if (err instanceof Error) {
        err = err.message;
      } else {
        err = JSON.stringify(err);
      }
    }
    self.end = Date.now();
    var result = Result();
    result.notification.type = "ERROR";
    result.notification.msg = err;
    self.requestErrorHandler.exit();
    event.reject(result);
  });

  this.progress(function(data) {
    self.end = Date.now();
    var result = Result();
    result.notification.type = "SUCCESS";
    result.notification.msg = '#OK';
    result.data = data;
    event.notify(result);
  });

  // route
  if (route && _.isArray(route)) {
    this.definitions = route[0];
    this.controller = route[1];
    if (route[2]) {
      this.data = _.assign(this.data, route[2]);
    }
  } else {
    this.reject('#404_ERROR');
  }
};

request.prototype.setHeader = function(header, value) {
  this.headers[header.toLowerCase()] = value;
};

request.prototype.validate = function() {
  var self = this;
  // check definitions exist
  if (!this.definitions || !_.isObject(this.definitions)) {
    this.validationErrors.push(new Error(util.format('route `%s` has no definition', this.request)));
    return false;
  }
  // check controller exist
  if (!this.controller || !_.isFunction(this.controller)) {
    this.validationErrors.push(new Error(util.format('route `%s` has no controller', this.request)));
    return false;
  }
  // check data
  var validData = {};
  var inputRules = this.definitions.input || {};
  _.keys(inputRules).forEach(function(key) {
    var data = self.data[key];
    var rule = inputRules[key];
    if ((_.isUndefined(data) || _.isNull(data)) && !rule.required) {
      return;
    }
    if (!rule.type) {
      return self.validationErrors.push(new Error(util.format('route `%s` definition for input `%s` has no type defined', this.request, key)));
    }
    var validationErrors = validator(data).to(rule);
    // Cast date
    if (rule.type === 'date' && !validationErrors && _.isString(data)) {
      data = moment.tz(data, moment.tz.guess()).toDate();
    }

    if (validationErrors) {
      validationErrors.forEach(function(error) {
        var errMsg = util.format('`%s` should be a %s (instead of "%s", which is a %s)',key, error.rule, error.data, error.actualType);
        self.validationErrors.push(new Error(errMsg));
      });
      return;
    }
    // no error so add data in valid data
    validData[key] = data;
  });
  if (this.validationErrors.length) {
    return false;
  }
  this.data = validData;
  return true;
};

// Initialize middlewares
request.prototype.initializeMiddlewares = function(middlewares, cb) {
  var self = this;
  var middlewaresInit = false;
  if (middlewares && _.isArray(middlewares) && middlewares.length) {
    middlewares.forEach(function(middleware, index) {
      var initMiddleware = function(cb) {
        var timeout = setTimeout(function() {
          var err = new Error(util.format('Middleware %s timeout for route `%s`, %s', index, self.request));
          err.initMiddlewareInternal = true;
          cb(err);
        }, 2000);
        self.fail(function() {
          clearTimeout(timeout);
        });
        middleware(self, function(err) {
          clearTimeout(timeout);
          cb(err);
        });
      };
      if (!middlewaresInit) {
        middlewaresInit = asynk.add(initMiddleware);
      } else {
        middlewaresInit.add(initMiddleware);
      }
    });

    middlewaresInit.serie().done(function() {
      cb();
    }).fail(function(err) {
      if (err.initMiddlewareInternal) {
        cb(err);
      } else {
        cb(new Error(util.format('route `%s` could not initialize middlewares', self.request)));
      }
      self.reject('#INTERNAL_SERVER_ERROR');
    });
  } else {
    cb();
  }
};

module.exports = function(synapps) {
  return function(event) {
    var route = synapps._router.getRoute(event.data.request);
    var req = new request(event, route);
    if (route === void 0) {
      return;
    }
    synapps.debug('info', util.format('Request START for route `%s`', req.request));

    // get synapps config from request
    req.get = function(key) {
      return synapps._config[key];
    };

    // call an other request
    req.emit = function(hostname, req, cb) {
      // invalid arguments
      if (!arguments.length) {
        throw new Error('invalid arguments: req.emit([hostname = String,] request = Object || String [, cb = function ])');
      }

      // if hostname isn't specified, send request to master
      if (arguments.length === 1) {
        req = hostname;
        hostname = 'master';
      }

      if (arguments.length === 2 && _.isFunction(req)) {
        cb = req;
        req = hostname;
        hostname = 'master';
      }

      if (_.isString(req)) {
        req = { request: req };
      }

      if (!_.isString(hostname) || !_.isPlainObject(req)) {
        throw new Error('invalid arguments: req.emit([hostname = String,] request = Object || String [, cb = function ])');
      }

      var promise = synapps._ipc.send(hostname, req, this.requestErrorHandler);

      if (cb && _.isFunction(cb)) {
        return promise.asCallback(cb);
      }

      return promise;
    };

    // add socket handler to request
    req.socket = {
      join: function(room) {
        synapps._ipc.socket.emit('master', 'socket.join', {socketID: event.data.socketID, room: room});
      },
      leave: function(room) {
        synapps._ipc.socket.emit('master', 'socket.leave', {socketID: event.data.socketID, room: room});
      },
      to: function(room) {
        return {
          emit: function(eventName, message) {
            synapps._ipc.socket.emit('master', 'socket.to.emit', {room: room, event: eventName, msg: message});
          }
        };
      }
    };

    // add debug message to log
    req.debug = function() {

      var args = Array.prototype.slice.call(arguments);
      args.forEach(function(arg, index) {
        if (arg instanceof Error) {
          args[index] = arg.stack + os.EOL;
        }
      });
      var msg = args.join(' ');
      synapps.debug('debug', msg);
    };

    var validation = req.validate();
    if (validation) {
      req.requestErrorHandler.run(function() {
        req.initializeMiddlewares(synapps._middlewares, function(err) {
          if (err) {
            synapps.debug('fatal', err);
            return;
          }
          var policies = req.definitions.policy || synapps._config.defaultPolicy || [];
          if (!_.isArray(policies)) {
            policies = [policies];
          }

          var policiesError = [];

          _.each(policies, function(policy, index) {
            switch (typeof policy) {
              case 'string':
                if (synapps._policies[policy]) {
                  policies[index] = synapps._policies[policy];
                } else {
                  policiesError.push(new Error('Unknown policy name: ' + policy + ' on route ' + req.request));
                }
                break;
              case 'function':
                // Nothing to do
                break;
              default:
                policiesError.push(new Error('Invalid policy type: ' + typeof policy + ' on route ' + req.request));
            }
          });

          if (policiesError.length) {
            _.each(policiesError, function(error) {
              synapps.debug('fatal', error);
            });
            return req.reject("#INTERNAL_SERVER_ERROR");
          }

          asynk.each(policies, function(policyFn, cb) {
            policyFn(req, cb);
          }).parallel().done(function() {
            req.controller(req);
          }).fail(function() {
            req.reject("#FORBIDDEN");
          });
        });
      });

    } else {
      // request is invalid
      synapps.debug('info', 'Invalid Request for route `' + req.request + '`');
      req.validationErrors.forEach(function(error) {
        synapps.debug('debug', error);
      });
      req.reject('#INVALID_REQUEST');
    }

    req.done(function() {
      synapps.debug('info', util.format('Request OK for route `%s` after %s ms on worker `%s` with pid %s', req.request, (req.end - req.start), process.env.WORKER_NAME, process.pid));
    });

    req.fail(function() {
      synapps.debug('info', util.format('Request ERROR for route `%s` after %s ms on worker `%s` with pid %s', req.request, (req.end - req.start), process.env.WORKER_NAME, process.pid));
      if (req.requestErrorHandler.executionError) {
        return synapps.debug('warn', req.requestErrorHandler.executionError);
      }
    });

    return req;
  };
};
