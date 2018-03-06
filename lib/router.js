var _ = require('lodash');

module.exports = function(synapps) {
  var router = {};
  router._routes = {};

  router.addRoute = function(route, options, handler) {
    var self = this;

    var definition;
    // addRoute(path, [options, handler])
    if (_.isArray(options) && options.length === 2 && !handler) {
      definition = options;
    // addRoute(path, options, handler)
    } else if (_.isObject(options) && _.isFunction(handler)) {
      definition = [options, handler];
    // addRoute(path, handler)
    } else if (_.isFunction(options) && handler === void 0) {
      definition = [{}, options];
    // addRoute(path, { subpath: [options, handler] })
    } else if (_.isObject(options) && handler === void 0) {
      definition = options;
    } else {
      throw new Error('add route invalid arguments:' + JSON.stringify(arguments, null, 2));
    }

    // remove unwanted slashes
    if (route.startsWith('/')) {
      route = route.substr(1);
    }
    if (route.endsWith('/')) {
      route = route.slice(0, route.length -1);
    }

    var chunks = route.split('/');
    var current = this._routes;
    var parameters = [];

    while (chunks.length) {
      var child = chunks.shift();
      if (!child) {
        continue;
      }
      if (child.startsWith(':')) {
        parameters.push(child.substr(1));
        current[':param'] = current[':param'] || {};
        current = current[':param'];
      } else {
        current[child] = current[child] || {};
        current = current[child];
      }
    }

    if (_.isArray(definition)) {
      if (parameters.length) {
        definition.push(parameters);
      }
      current['/'] = definition;
      return;
    }

    (function recusive_route(current_route, definition) {
      for (action_key in definition) {
        var action = definition[action_key];
        current_route[action_key] = current_route[action_key] || {};
        // check if route is a endpoint definition
        if (_.isArray(action)) {
          current_route[action_key]['/'] = action;
        } else if (_.isObject(action)) {
          recusive_route(current_route[action_key], action);
        } else {
          throw new Error('invalid route definition');
        }
      }
    })(current, definition);
  };

  router.getRoute = function(route) {
    var params = [];

    // fix slash as separator
    route = route.replace(/:/g, '/');

    // remove unwanted slashes
    if (route.startsWith('/')) {
      route = route.substr(1);
    }
    if (route.endsWith('/')) {
      route = route.slice(0, route.length -1);
    }

    var chunks = route.split('/');

    var current = this._routes;
    while (chunks.length) {
      var child = chunks.shift();
      var param = current[':param'];
      if (child !== '') {
        current = current[child];
      }
      if (current === void 0) {
        if (param === void 0) {
          return void 0;
        }
        params.push(child);
        current = param;
      }
    }

    current = current['/'];

    if (!_.isArray(current) || current.length < 2) {
      return void 0;
    }

    current = current.slice();
    if (params.length && current[2] && current[2].length === params.length) {
      var paramObject = {};
      params.forEach(function(value, index) {
        var name = current[2][index];
        paramObject[name] = value;
      });
      current[2] = paramObject;
    } else if (current[2]) {
      current.pop();
    }

    return current;
  };

  return router;
};
