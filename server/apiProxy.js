var http = require('http'),
    httpProxy = require('http-proxy');

var cors = function (proxyRes, req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
};


var testnetProxy = httpProxy.createProxyServer({
  target:'http://testnet.api.coloredcoins.org'
});

var mainnetProxy = httpProxy.createProxyServer({
  target:'http://api.coloredcoins.org'
});


testnetProxy
    .on('proxyRes', cors)
    .listen(8000);

mainnetProxy
    .on('proxyRes', cors)
    .listen(8100);

