'use strict';

function ColoredCoins($http, $log) {
  var apiHost = 'testnet.api.coloredcoins.org',
      self = this;

  this.handleResponse = function (data, status, cb) {
    $log.debug('Status: ', status);
    $log.debug('Body: ', JSON.stringify(data));

    if (status != 200 && status != 201) {
      return cb(data);
    }
    return cb(null, body);
  };

  this.getFrom = function (api_endpoint, param, cb) {
    $log.debug('Get from:' + api_endpoint + '/' + param);
    $http.get('http://' + apiHost + ':80/v2/' + api_endpoint + '/' + param)
        .success(function (data, status) {
          return self.handleResponse(data, status, cb);
        })
        .error(function(data, status) {
          return self.handleResponse(data, status, cb);
        });
  };

  this.extractAssets = function(body) {
    var assets = [];
    if (!body.utxos || body.utxos.length == 0) return assets;

    body.utxos.forEach(function(utxo) {
      if (utxo.assets || utxo.assets.length > 0) {
        utxo.assets.forEach(function(asset) {
          assets.push({ assetId: asset.assetId, amount: asset.amount, utxo: utxo.txid + ':' + utxo.index });
        });
      }
    });

    return assets;
  };

  this.getMetadata = function(asset, cb) {
    this.getFrom('assetmetadata', asset.assetId + "/" + asset.utxo, function(err, body){
      if (err) { return cb(err); }
      return cb(null, body.metadataOfIssuence);
    });
  };

  this.getAssetsByAddress = function(address, cb) {
    this.getFrom('addressinfo', address, function(err, body) {
      if (err) { return cb(err); }
      return cb(null, self.extractAssets(body));
    });
  };

}

ColoredCoins.prototype.init = function() {};

ColoredCoins.prototype.getAssets = function(address, cb) {
  var self = this;
  this.getAssetsByAddress(address, function(err, assetsInfo) {
    if (err) { return cb(err); }

    $log.debug("Assets for " + address + ": \n" + JSON.stringify(assetsInfo));

    var assets = [];
    assetsInfo.forEach(function(asset) {
      self.getMetadata(asset.assetId, asset.utxo, function(err, metadata) {
        metadata.amount = asset.amount;
        assets.push({ asset: asset, metadata: metadata });
        if (assetsInfo.length == assets.length) {
          return cb(metadata);
        }
      });
    });
  });
};

angular.module('copayColoredCoins').service('coloredCoins', ColoredCoins);
