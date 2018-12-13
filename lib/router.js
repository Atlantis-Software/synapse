var _ = require('lodash');

module.exports = function() {
  var router = {};
  router._routes = {};

  router.addRoute = function(route, options, handler) {

    var definition;
    // addRoute(path, [options, handler])
    if (_.isArray(options) && options.length === 2 && !handler) {
      definition = options;
      options = definition[0];
    // addRoute(path, options, handler)
    } else if (_.isObject(options) && _.isFunction(handler)) {
      definition = [options, handler];
    // addRoute(path, handler)
    } else if (_.isFunction(options) && handler === void 0) {
      definition = [{}, options];
      options = definition[0];
    // addRoute(path, { subpath: [options, handler] })
    } else if (_.isObject(options) && handler === void 0) {
      definition = options;
      options = null;
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

    while (chunks.length) {
      var subpath = chunks.shift();
      if (!subpath) {
        continue;
      }
      if (subpath.startsWith(':')) {
        current[':param'] = current[':param'] || { paramName: subpath.substr(1) };
        current = current[':param'];
      } else {
        current[subpath] = current[subpath] || {};
        current = current[subpath];
      }
    }

    if (_.isArray(definition)) {
      if (options && options.method) {
        current[options.method] = definition;
        return;
      }
      current['/'] = definition;
      return;
    }

    (function recusive_route(current_route, definition) {
      for (var action_key in definition) {
        var action = definition[action_key];
        current_route[action_key] = current_route[action_key] || {};
        // check if route is a endpoint definition
        if (_.isArray(action)) {
          options = action[0];
          if (options && options.method) {
            current_route[action_key][options.method] = action;
          } else {
            current_route[action_key]['/'] = action;
          }
        } else if (_.isObject(action)) {
          recusive_route(current_route[action_key], action);
        } else {
          throw new Error('invalid route definition');
        }
      }
    })(current, definition);
  };

  router.getRoute = function(method, route) {
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
    var paramData = {};
    var paramInput = {};


    while (chunks.length) {
      var subpath = chunks.shift();
      if (subpath !== '' && current[subpath]) {
        current = current[subpath];
      } else if (current[':param']) {
        current = current[':param'];
        paramData[current.paramName] = subpath;
        paramInput[current.paramName] = { type: 'string' };
      } else {
        return void 0;
      }
    }

    if (current[method]) {
      current = current[method];
    } else {
      current = current['/'];
    }

    if (!_.isArray(current) || current.length !== 2) {
      return void 0;
    }

    current = _.cloneDeep(current);

    if (_.keys(paramData).length) {
      current[0].input = _.assign(paramInput, current[0].input || {});
      current.push(paramData);
    }

    return current;
  };

  return router;
};

