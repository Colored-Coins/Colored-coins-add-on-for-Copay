var http = require('http'),
    httpProxy = require('http-proxy'),
    version = require('../bower.json').version;

var cors = function (proxyRes, req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-type');
};

var userAgent = function (proxyReq, req, res, options) {
  proxyReq.setHeader('User-Agent', req.headers['user-agent'] + ' Copay/' + version);
};


var testnetProxy = httpProxy.createProxyServer({
  target:'http://testnet.api.coloredcoins.org'
});

var mainnetProxy = httpProxy.createProxyServer({
  target:'http://api.coloredcoins.org'
});


testnetProxy
    .on('proxyReq', userAgent)
    .on('proxyRes', cors)
    .listen(8000);

mainnetProxy
    .on('proxyReq', userAgent)
    .on('proxyRes', cors)
    .listen(8100);
