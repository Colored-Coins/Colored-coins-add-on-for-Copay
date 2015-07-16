'use strict';

function ColoredCoins(profileService, configService, $http, $log, lodash) {
  var defaultConfig = {
    api: {
      testnet: 'testnet.api.coloredcoins.org',
      livenet: 'api.coloredcoins.org'
    }
  };

  var config = (configService.getSync()['coloredCoins'] || defaultConfig),
      root = {};

  var apiHost = function(network) {
    if (!config['api'] || ! config['api'][network]) {
      return defaultConfig.api[network];
    } else {
      return config.api[network];
    }
  };

  var handleResponse = function (data, status, cb) {
    $log.debug('Status: ', status);
    $log.debug('Body: ', JSON.stringify(data));

    if (status != 200 && status != 201) {
      return cb(data);
    }
    return cb(null, data);
  };

  var getFrom = function (api_endpoint, param, network, cb) {
    $log.debug('Get from:' + api_endpoint + '/' + param);
    $http.get('http://' + apiHost(network) + '/v2/' + api_endpoint + '/' + param)
        .success(function (data, status) {
          return handleResponse(data, status, cb);
        })
        .error(function(data, status) {
          return handleResponse(data, status, cb);
        });
  };

  var postTo = function(api_endpoint, json_data, network, cb) {
    $log.debug('Post to:' + api_endpoint + ". Data: " + JSON.stringify(json_data));
    $http.post('http://' + apiHost(network) + '/v2/' + api_endpoint, json_data)
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
          assets.push({ assetId: asset.assetId, amount: asset.amount, utxo: lodash.pick(utxo, [ 'txid', 'index', 'value', 'scriptPubKey']) });
        });
      }
    });

    return assets;
  };

  var getMetadata = function(asset, network, cb) {
    getFrom('assetmetadata', asset.assetId + "/" + asset.utxo.txid + ":" + asset.utxo.index, network, function(err, body){
      if (err) { return cb(err); }
      return cb(null, body.metadataOfIssuence);
    });
  };

  var getAssetsByAddress = function(address, network, cb) {
    getFrom('addressinfo', address, network, function(err, body) {
      if (err) { return cb(err); }
      return cb(null, extractAssets(body));
    });
  };

  root.init = function() {};

  root.getAssets = function(address, cb) {
    var network = profileService.focusedClient.credentials.network;
    getAssetsByAddress(address, network, function(err, assetsInfo) {
      if (err) { return cb(err); }

      $log.debug("Assets for " + address + ": \n" + JSON.stringify(assetsInfo));

      var assets = [];
      assetsInfo.forEach(function(asset) {
        getMetadata(asset, network, function(err, metadata) {
          assets.push({ address: address, asset: asset, metadata: metadata });
          if (assetsInfo.length == assets.length) {
            return cb(assets);
          }
        });
      });
    });
  };

  root.broadcastTx = function(txHex, cb) {
    postTo('broadcast', { txHex: txHex }, cb);
  };

  root.createTransferTx = function(asset, amount, to, txIn, numSigsRequired, cb) {

    var transfer = {
      from: asset.address,
      fee: 1000,
      to: [{
        "address": to,
        "amount": amount,
        "assetId": asset.asset.assetId
      }],
      flags: {
        injectPreviousOutput: true
      },
      financeOutput: {
        value: bitcore.Unit.fromSatoshis(txIn.satoshis).BTC,
        n: txIn.vout,
        scriptPubKey: {
          asm: new bitcore.Script(txIn.scriptPubKey).toString(),
          hex: txIn.scriptPubKey,
          type: 'scripthash', // not sure we can hardcode this
          reqSigs: numSigsRequired
          //addresses: []
        }
      },
      financeOutputTxid: txIn.txid
    };

    console.log(JSON.stringify(transfer, null, 2));

    postTo('sendasset', transfer, cb);
  };

  return root;
}


angular.module('copayAddon.coloredCoins').service('coloredCoins', ColoredCoins);
