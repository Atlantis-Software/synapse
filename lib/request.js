var moment = require('moment-timezone');
var asynk = require('asynk');
var validator = require('offshore-validator');
var _ = require('lodash');
var domain = require('domain');
var util = require('util');
var requestErrorHandler = require('./requestErrorHandler');

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
  this.requestErrorHandler = new requestErrorHandler(this);
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
    err = err || '#UNKNOWN_ERROR';
    if (_.isObject(err)) {
      if (err instanceof Error) {
        err = err.message;
      } else {
        err = JSON.stringify(err);
      }
    }
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
      cb(new Error(util.format('route `%s` could not initialize middlewares', self.request)));
      self.reject('#INTERNAL_SERVER_ERROR');
    });
  } else {
    cb();
  }
}

module.exports = function(synapps) {
  return function(event) {
    var route = synapps._router._routes[event.data.request];
    var req = new request(event, route);
    synapps.debug('info', util.format('Request START for route `%s`', req.request));

    // get synapps config from request
    req.get = function(key) {
      return synapps._config[key];
    };

    // call an other request
    req.emit = function(hostname, req) {
      if (_.isString(hostname) && _.isObject(req)) {
        return synapps._ipc.send(hostname, req, this.requestErrorHandler);
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
            switch(typeof policy) {
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
          }).fail(function(err) {
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
        return synapps.debug('debug', req.requestErrorHandler.executionError);
      }
    });

    return req;
  }
};
