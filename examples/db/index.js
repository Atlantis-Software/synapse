/**
 * Module dependencies.
 */

var synapse = require('../..');
var orm = require('synapse-orm');
var memoryDb = require('offshore-memory');

var app = module.exports = synapse();

// config
app.set('staticDir', __dirname + '/www');

// middleware
app.use(orm({

}));

app.listen(8080);