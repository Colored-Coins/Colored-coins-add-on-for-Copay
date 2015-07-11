var http = require('http'),
    httpProxy = require('http-proxy');

var proxy = httpProxy.createProxyServer({
  target:'http://testnet.api.coloredcoins.org:80'
});

proxy.listen(8000);

proxy.on('proxyRes', function (proxyRes, req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-type');
});