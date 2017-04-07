var _ = require('lodash');

module.exports = function(synapse) {
  var router = {};
  router._routes = {};

  router.addRoute = function(route, definition) {
    var self = this;
    (function recusive_route(current_route, definition) {
      for (action_key in definition) {
        var action = definition[action_key];
        var route = current_route + ":" + action_key;
        // check if route is a endpoint controller definition
        if (_.isArray(action)) {
          synapse.debug(3, 'add route => ' + route);
          self._routes[route] = action;
        } else if (_.isObject(action)) {
          recusive_route(route, action);
        } else {
          throw new Error('invalid route definition');
        }
      }
    })(route, definition);
  };

  return router;
};