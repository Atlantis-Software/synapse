var asynk = require('asynk');
var validator = require('offshore-validator');
var _ = require('lodash');
var domain = require('domain');
var trycatch = require('trycatch');
var util = require('util');

var request = function(event, route) {
  if (!event || !_.isObject(event) || !event.data ) {
    throw new Error('Invalid event message from IPC');
  }
  var self = this;
  var requestInfo = event.data;
  _.assign(this, asynk.deferred());
  this.headers = {
    'content-type': 'text/json'
  };
  this.start = Date.now();
  this.end = null;
  this.sessionID = requestInfo.sessionID;
  this.request = requestInfo.request;
  this.type = requestInfo.type;
  this.data = requestInfo.data;
  // errors
  this.validationErrors = [];
  this.executionError = null;
  this.middlewareError = null;
  // route
  if (route && _.isArray(route)) {
    this.definitions = route[0];
    this.controller = route[1];
  }

  var result = {
    notification: {
      type: "ERROR",
      msg: "#UNKNOWN_ERROR",
      uid: requestInfo.uid
    },
    data: null,
    headers: self.headers
  };

  if (this.type === 'jsonp') {
    result.callback = requestInfo.callback;
  }

  if (this.type === 'cluster' && event.data.clusterInfo) {
    this.clusterInfo = event.data.clusterInfo;
  }

  this.done(function(data) {
    self.end = Date.now();
    result.headers = self.headers;
    result.notification.type = "SUCCESS";
    result.notification.msg = '#OK';
    result.data = data;
    event.resolve(result);
  });

  this.fail(function(err) {
    self.end = Date.now();
    result.notification.type = "ERROR";
    result.notification.msg = err;
    event.reject(result);
  });

  this.progress(function(data) {
    self.end = Date.now();
    result.notification.type = "SUCCESS";
    result.notification.msg = '#OK';
    result.data = data;
    event.notify(result);
  });
};

request.prototype.setHeader = function(header, value) {
  this.headers[header.toLowerCase()] = value;
};

request.prototype.validate = function() {
  var self = this;
  // check definitions exist
  if (!this.definitions || !_.isObject(this.definitions)) {
    return this.validationErrors.push(new Error(util.format('route `%s` has no definition', this.request)));
    return false;
  }
  // check controller exist
  if (!this.controller || !_.isFunction(this.controller)) {
    return this.validationErrors.push(new Error(util.format('route `%s` has no controller', this.request)));
    return false;
  }
  // check data
  var validData = {};
  var inputRules = this.definitions.input || {};
  _.keys(inputRules).forEach(function(key) {
    var data = self.data[key];
    var rule = inputRules[key];
    if ((_.isUndefined(data) || _.isNull(data)) && rule.required === false) {
      return;
    }
    if (!rule.type) {
      return self.validationErrors.push(new Error(util.format('route `%s` definition for input `%s` has no type defined', this.request, key)));
    }
    var validationErrors = validator(data).to(rule);
    if (validationErrors) {
      validationErrors.forEach(function(error) {
        errMsg = util.format('`%s` should be a %s (instead of "%s", which is a %s)',key, error.rule, error.data, error.actualType);
        self.validationErrors.push(new Error(errMsg));
      });
      return; self.validationErrors.push(validationError);
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
    middlewares.forEach(function(middleware) {
      if (!middlewaresInit) {
        middlewaresInit = asynk.add(middleware).args(self, asynk.callback);
      } else {
        middlewaresInit.add(middleware).args(self, asynk.callback);
      }
    });
    middlewaresInit.serie().done(function() {
      cb();
    }).fail(function(err) {
      self.middlewareError = err;
      cb(new Error(util.format('route `%s` could not initialize middlewares', self.request)));
      self.reject('#INTERNAL_SERVER_ERROR');
    });
  } else {
    cb();
  }
}

// Execute in Producion mode
request.prototype.exec = function() {
  var self = this;
  var d = domain.create();
  d.on('error', function(err) {
    self.executionError = err;
    self.reject("#INTERNAL_SERVER_ERROR");
  });
  d.run(function() {
    self.controller(self);
  });
}

// Execute in Debug mode
request.prototype.execDebug = function() {
  var self = this;
  trycatch.configure({
    'long-stack-traces': false // disabled cause SIGSEGV
  });
  trycatch(function() {
    self.controller(self);
  }, function(err) {
    self.executionError = err;
    self.reject("#INTERNAL_SERVER_ERROR");
  });
};

module.exports = function(synapps) {
  return function(event) {
    var route = synapps._router._routes[event.data.request];
    var req = new request(event, route);
    synapps.debug(5, util.format('Request START for route `%s`', req.request));

    // get synapps config from request
    req.get = function(key) {
      return synapps._config[key];
    };

    // call an other request
    req.emit = function(hostname, req) {
      if (_.isString(hostname) && _.isObject(req)) {
        return synapps._ipc.send(hostname, req);
      } else if (_.isObject(hostname) && _.isUndefined(req)) {
        // if hostname isn't specified, send request to localhost
        req = hostname;
        return synapps._ipc.send('master', req);
      } else {
        // invalid argument
        throw new Error('invalid arguments: req.emit([hostname = String,] request = Object)');
      }
    }

    var validation = req.validate();
    if (validation) {
      req.initializeMiddlewares(synapps._middlewares, function(err) {
        if (err) {
          synapps.debug(0, err);
          synapps.debug(0, req.middlewareError);
          return;
        }
        var policy = req.definitions.policy || synapps._config.defaultPolicy;
        if (_.isFunction(policy)) {
          policy(req, function(err) {
            if (err) {
              return req.reject(err);
            }
            if (synapps._config.debug < 3) {
              req.exec();
            } else {
              req.execDebug();
            }
          });
        } else if (synapps._config.debug < 3) {
          req.exec();
        } else {
          req.execDebug();
        }
      });
    } else {
      // request is invalid
      synapps.debug(2, 'Invalide Request for route `' + req.request + '`');
      req.validationErrors.forEach(function(error) {
        synapps.debug(2, error);
      });
    }

    req.done(function() {
      synapps.debug(5, util.format('Request OK for route `%s` after %s ms', req.request, (req.end - req.start)));
    });

    req.fail(function() {
      synapps.debug(5, util.format('Request ERROR for route `%s` after %s ms', req.request, (req.end - req.start)));
      if (req.executionError) {
        return synapps.debug(0, req.executionError);
      }
    });

    return req;
  }
};
