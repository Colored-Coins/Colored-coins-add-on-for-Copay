'use strict';

function ColoredCoins(configService, $http, $log, bitcore) {
  var defaultConfig = {
    apiHost: 'testnet.api.coloredcoins.org:80'
  };

  var apiHost = (configService.getSync()['coloredCoins'] || defaultConfig)['apiHost'],
      root = {};

  var handleResponse = function (data, status, cb) {
    $log.debug('Status: ', status);
    $log.debug('Body: ', JSON.stringify(data));

    if (status != 200 && status != 201) {
      return cb(data);
    }
    return cb(null, data);
  };

  var getFrom = function (api_endpoint, param, cb) {
    $log.debug('Get from:' + api_endpoint + '/' + param);
    $http.get('http://' + apiHost + '/v2/' + api_endpoint + '/' + param)
        .success(function (data, status) {
          return handleResponse(data, status, cb);
        })
        .error(function(data, status) {
          return handleResponse(data, status, cb);
        });
  };

  var postTo = function(api_endpoint, json_data, cb) {
    $log.debug('Post to:' + api_endpoint + ". Data: " + JSON.stringify(json_data));
    $http.post('http://' + apiHost + '/v2/' + api_endpoint, json_data)
        .success(function (data, status) {
          return handleResponse(data, status, cb);
        })
        .error(function(data, status) {
          return handleResponse(data, status, cb);
        });
  };


  var extractAssets = function(body) {
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

  var getMetadata = function(asset, cb) {
    getFrom('assetmetadata', asset.assetId + "/" + asset.utxo, function(err, body){
      if (err) { return cb(err); }
      return cb(null, body.metadataOfIssuence);
    });
  };

  var getAssetsByAddress = function(address, cb) {
    getFrom('addressinfo', address, function(err, body) {
      if (err) { return cb(err); }
      return cb(null, extractAssets(body));
    });
  };

  root.init = function() {};

  root.getAssets = function(address, cb) {
    getAssetsByAddress(address, function(err, assetsInfo) {
      if (err) { return cb(err); }

      $log.debug("Assets for " + address + ": \n" + JSON.stringify(assetsInfo));

      var assets = [];
      assetsInfo.forEach(function(asset) {
        getMetadata(asset, function(err, metadata) {
          assets.push({ address: address, asset: asset, metadata: metadata });
          if (assetsInfo.length == assets.length) {
            return cb(assets);
          }
        });
      });
    });
  };

  root.transferAsset = function(asset, amount, to, txIn, numSigsRequired) {

    var transfer = {
      from: asset.address,
      fee: 1000,
      to: [{
        "address": to,
        "amount": amount,
        "assetId": asset.asset.assetId
      }],
      financeOutput: {
        value: txIn.satoshis,
        n: txIn.vout,
        scriptPubKey: {
          asm: new bitcore.Script(txIn.scriptPubKey).toString(),
          hex: txIn.scriptPubKey,
          type: 'scripthash',
          reqSigs: numSigsRequired
          //addresses: []
        }
      },
      financeOutputTxid: txIn.txid
    };
    console.log(transfer);

    postTo('sendasset', transfer, function (err, body) {
      if (err) {
        console.log('error: ', err);
        return;
      }

      console.log(body.txHex);
    });
  };

  return root;
}


angular.module('copayAddon.coloredCoins').service('coloredCoins', ColoredCoins);
