/**
 * Module dependencies.
 */

var Synapps = require('../..');
var orm = require('@synapps/orm');

var app = module.exports = Synapps();

// config
app.set('staticDir', __dirname + '/www');
app.set('debug', 'ALL');

// middleware
app.use(orm({}));

app.route('todo', {
  add: [{
    input: {
      label: {
        type: 'string',
        required: true
      }
    }
  }, function(req){
    req.debug(JSON.stringify(req.data));
    req.db.todo.create({label: req.data.label}, function(err) {
      if (err) {
        req.debug(err);
        req.reject('database failed');
      }
      req.resolve({msg: 'todo inserted !'});
    });
  }],
  list: [{}, function(req){
    req.db.todo.find(function(err, todos) {
      if (err) {
        req.debug(err);
        req.reject('database failed');
      }
      req.resolve({
        todos: todos,
        msg: 'todo list ok !'
      });
    });
  }]
});

app.listen(3000);
console.log('Visit http://localhost:3000'); // eslint-disable-line no-console
