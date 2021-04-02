var forge = require('node-forge');
var fs = require('fs');
var os = require('os');
var path = require('path');

// Generate certificate
module.exports = function(name, ip, dir) {
  name = name || os.hostname();
  ip = ip || '127.0.0.1';
  dir = dir || process.cwd();
  var keyPair = forge.pki.rsa.generateKeyPair(2048);
  var cert = forge.pki.createCertificate();
  var now = new Date();
  var oneYear = new Date(new Date(now).setFullYear(now.getFullYear() + 1));

  Object.assign(cert, {
    publicKey: keyPair.publicKey,
    serialNumber: '01',
    validity: {
      notBefore: now,
      notAfter: oneYear
    }
  });

  var attrs = [{
   name: "commonName",
   value: name
  }];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([{
    name: 'subjectAltName',
    altNames: [{
      type: 7, // IP
      ip: ip
    }]
  }]);

  cert.sign(keyPair.privateKey, forge.md.sha256.create()); // self signed

  var privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);
  var certificatePem = forge.pki.certificateToPem(cert);

  fs.writeFileSync(path.join(dir, name + '.key'), privateKeyPem);
  fs.writeFileSync(path.join(dir, name + '.crt'), certificatePem);
};
