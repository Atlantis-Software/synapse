/**
 * Module dependencies.
 */

var Synapps = require('../..');
var session = require('@synapps/session');
var hash = require('./pass').hash;

var app = module.exports = Synapps();

// config
app.set('staticDir', __dirname + '/www');

// middleware
app.use(session());

// dummy database

var users = {
  foo: { name: 'foo' }
};

// when you create a user, generate a salt
// and hash the password ('foobar' is the pass here)

hash('foobar', function(err, salt, hash){
  if (err) {
    throw err;
  }
  // store the salt & hash in the "db"
  users.foo.salt = salt;
  users.foo.hash = hash;
});


// Authenticate using our plain-object database of doom!

function authenticate(name, pass, fn) {
  var user = users[name];
  // query the db for the given username
  if (!user) return fn(new Error('cannot find user'));
  // apply the same algorithm to the given password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user
  hash(pass, user.salt, function(err, hash){
    if (err) return fn(err);
    if (hash == user.hash) return fn(null, user);
    fn(new Error('invalid password'));
  });
}

function restrict(req, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    next('Access denied!');
  }
}

app.route('user', {
  restricted: [
    {
      policy: restrict
    }, function(req){
      req.resolve({msg: 'Wahoo! restricted area'});
    }
  ],
  logout: [
    {
      policy: restrict
    }, function(req){
      // destroy the user's session to log them out
      // will be re-created next request
      req.session.destroy(function(){
        req.resolve({msg: 'logged out'});
      });
    }
  ],
  login: [
    {
      input: {
        username: {
          type: 'string'
        },
        password: {
          type: 'string'
        }
      }
    }, function(req){
      authenticate(req.data.username, req.data.password, function(err, user){
        if (user) {
          req.session.user = user;
          req.session.save();
          req.resolve({
            sessionID: req.session.id,
            msg: 'Authenticated as ' + user.name
          });
        } else {
          var error = 'Authentication failed, please check your '
            + ' username and password.'
            + ' (use "foo" and "foobar")';
          req.reject(error);
        }
      });
    }
  ]
});

app.listen(3000);
console.log('Visit http://localhost:3000'); // eslint-disable-line no-console
