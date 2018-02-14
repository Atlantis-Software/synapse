# synapse

[![NPM Version](https://img.shields.io/npm/v/@synapps/core.svg)](https://www.npmjs.com/package/@synapps/core)
[![NPM Downloads](https://img.shields.io/npm/dm/@synapps/core.svg)](https://www.npmjs.com/package/@synapps/core)
[![Linux Build](https://img.shields.io/travis/Atlantis-Software/synapps/master.svg?label=linux)](https://travis-ci.org/Atlantis-Software/synapps)
[![Windows Build](https://img.shields.io/appveyor/ci/atiertant/synapps.svg?label=windows)](https://ci.appveyor.com/project/atiertant/synapps)
[![Coverage Status](https://coveralls.io/repos/github/Atlantis-Software/synapps/badge.svg?branch=master)](https://coveralls.io/github/Atlantis-Software/synapps?branch=master)
[![NSP Status](https://nodesecurity.io/orgs/atlantis/projects/755b3c41-3900-4f1b-bc73-5cde98aa2f11/badge)](https://nodesecurity.io/orgs/atlantis/projects/755b3c41-3900-4f1b-bc73-5cde98aa2f11)
[![Dependencies Status](https://david-dm.org/Atlantis-Software/synapps.svg)](https://david-dm.org/Atlantis-Software/synapps)

```js
var synapps = require('@synapps/core');
var app = synapps();

app.route('hello', {
  world: [
    {},
    function(req) {
      req.resolve('hello world');
    }
  ]
});

app.listen(3000);
```

```bash
$ curl http://127.0.0.1:3000/API/hello:world
hello world
```

## Installation

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/).

Before installing, [download and install Node.js](https://nodejs.org/en/download/).
Node.js 6 or higher is required.

Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```bash
$ npm install @synapps/core
```
