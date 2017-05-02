# Synapps

Synapps is a node module aimed to ease communication between processes.

## Installation
From NPM :
`npm install synapps`

## Starting up

First, require synapps and create a node
```javascript
var synapps = require('synapps');
var basicApp = synapps();
```

Then, set the various properties of the node ( with [set()](#set) )
```javascript
basicApp.set('name', 'basicApp');
basicApp.set('ipcLocalPort', 8001);
basicApp.set('debug', 0);
```

You can then optionally set middlewares... ( with [use()](#use) )
```javascript
basicApp.use(function(req, next) {
  req.data.msg += ' - part added by middleware';
});
```

...or policies ( with [policy()](#policy) )
```javascript
basicApp.policy('checkToken', function(req, next) {
  if (req.data.token === 'let me pass') {
    return next();
  }
  next('forbidden');
});
```

Add the routes ( with [route()](#route) )
```javascript
basicApp.route('test', {
  ping: [
    {
      input: {
        msg: {
          type: 'string',
          required: true
        }
      }
    },
    function(req) {
      req.resolve({response: 'PONG'});
    }
  ]
});
```

Finally, start the node ( with [listen()](#listen) )

```javascript
basicApp.listen(8050);
```

## Methods

#### Set()
`.set(parameterName<string>, parameterValue<mixed>)`
Used to set options for a node.
The differents parameterName and their corresponding arguments type are :
* `name<string>` Name of the node
* `ipcLocalPort<integer>` Internal port for communicating with other nodes
* `debug<integer>` Set the node verbose level
* `tls<object>` Used to set up tls. See [here](#setting_up_tls) for more details

#### Use()
`.use(middleware<function>)`
Add a middleware to the node.
The parameter function takes two arguments : the request and a callback

#### Policy()
`.policy(policyName<string>, policy<function>)`
Add a policy to the node.
The parameter function takes two arguments : the request and a callback.
Calling the callback with a parameter will reject the request.

#### Route()
`.route(routePath<string>, routeMethods<object>)`
Add a route to the node.
Each property of `routeMethods` is a method of your route, and is an array with two entries :
The first is an object containing your method options (it can be an empty object if there is no options), such as :
* `policy<mixed>` Takes either a string referencing a pre-declared policy, or a function, or an array of those
* `input<object>` Each property of this object is a possible value allowed  in input and its options (`type` and optionally `required`). For example :
```
input: {
  name: {
    type: 'string',
    required: true
  },
  zipCode: {
    type: 'integer'
  }
}
```
The second entry is a function (your route method) and takes the request as a parameter.

#### Listen()
`.listen(port<integer>)`
Start the node.

## Setting up TLS

You'll need a private key and a public key files. You can generate them with openssl :
```
openssl req  -newkey rsa:2048 -nodes -keyout domain.key -out domain.csr
openssl req  -newkey rsa:2048 -nodes -keyout domain.key -x509 -days 365 -out domain.crt -subj /CN=localhost
```

Then just set the tls property of your node :
```
basicApp.set('tls', {
  publicKey: '/home/synapps/tls/domain.crt',
  privateKey: '/home/synapps/tls/domain.key',
  trusted: ['/home/synapps/tls/domain.crt'],
  port: 8100
});
```
Parameters are pretty self-explanatory :
* `publicKey` is an absolute path to your public key file
* `privateKey` is an absolute path to your private key file
* `trusted` is an array of absolute path of your trusted keys
* `port` is the listening port

## Example

Init :
```javascript
var synapps = require('synapps');

// Set the node
var basicApp = synapps();
basicApp.set('name', 'basicApp');
basicApp.set('ipcLocalPort', 8001);
basicApp.set('debug', 0);

// Set a middleware
basicApp.use(function(req, next) {
  // do something here
  next();
});

basicApp.policy('guard', function(req, next) {
  // do some guard stuff here
  if (isAValidUser()) {
    return next();
  }
  return next('not allowed');
});

basicApp.route('example', {
  ping: [
    {
      policy: 'guard',
      input: {
        ping: {
          type: 'string',
          required: true
        }
      }
    },
    function(req) {
      if (req.data.ping === 'ping') {
        req.resolve({response: 'PONG'});
      } else {
        req.reject('That is not a ping');
      }
    }
  ]
});

basicApp.listen(8050);
```

Use :

```javascript
$.ajax({
  method: "POST",
  url: "/API/example:ping",
  data: { ping: 'ping' }
}).done(function(data) {
  console.log(data); // { response: 'ping'}
}).fail(function(err) {
  /* treat errors here */
});
```
