'use strict';

function ColoredCoins(profileService, configService, bitcore, $http, $log, lodash) {
  var defaultConfig = {
    fee: 49000,
    api: {
      testnet: 'testnet.api.coloredcoins.org',
      livenet: 'api.coloredcoins.org'
    }
  };

  var root = {},
      lockedUtxos = [],
      self = this;

  // UTXOs "cache"
  root.txidToUTXO = {};
  root.assets = [];

  var _config = function() {
    return configService.getSync()['coloredCoins'] || defaultConfig;
  };

  var apiHost = function(network) {
    if (!_config()['api'] || ! _config()['api'][network]) {
      return defaultConfig.api[network];
    } else {
      return _config().api[network];
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
    getFrom('assetmetadata', root.assetUtxoId(asset), network, function(err, metadata){
      if (err) { return cb(err); }
      return cb(null, metadata);
    });
  };

  var getAssetsByAddress = function(address, network, cb) {
    getFrom('addressinfo', address, network, function(err, body) {
      if (err) { return cb(err); }
      return cb(null, extractAssets(body));
    });
  };

  var _updateLockedUtxos = function(cb) {
    var fc = profileService.focusedClient;
    fc.getUtxos(function(err, utxos) {
      if (err) { return cb(err); }
      _setLockedUtxos(utxos);
      cb();
    });
  };

  var _setLockedUtxos = function(utxos) {
    self.lockedUtxos = lodash.chain(utxos)
        .filter('locked')
        .map(function(utxo) { return utxo.txid + ":" + utxo.vout; })
        .value();
  };

  var selectFinanceOutput = function(financeAmount, fc, assets, cb) {
    fc.getUtxos(function(err, utxos) {
      if (err) { return cb(err); }

      _setLockedUtxos(utxos);

      root.txidToUTXO = lodash.reduce(utxos, function(result, utxo) {
        result[utxo.txid + ":" + utxo.vout] = utxo;
        return result;
      }, {});

      var coloredUtxos = root.getColoredUtxos();

      var colorlessUnlockedUtxos = lodash.reject(utxos, function(utxo) {
        return lodash.includes(coloredUtxos, utxo.txid + ":" + utxo.vout) || utxo.locked;
      });

      for (var i = 0; i < colorlessUnlockedUtxos.length; i++) {
        if (colorlessUnlockedUtxos[i].satoshis >= financeAmount) {
          return cb(null, colorlessUnlockedUtxos[i]);
        }
      }
      return cb({ error: "Insufficient funds to finance transfer" });
    });
  };

  var _extractAssetIcon = function(metadata) {
    var icon = lodash.find(lodash.property('metadataOfIssuence.data.urls')(metadata) || [], function(url) { return url.name == 'icon'; });
    return icon ? icon.url : null;
  };

  root.init = function() {};

  root.assetUtxoId = function(asset) {
    return asset.assetId + "/" + asset.utxo.txid + ":" + asset.utxo.index;
  };

  root.defaultFee = function() {
    return _config().fee || defaultConfig.fee;
  };

  root.getColoredUtxos = function() {
    return lodash.map(root.assets, function(asset) { return asset.utxo.txid + ":" + asset.utxo.index; });
  };

  root.fetchAssets = function(addresses, cb) {
    root.assets = [];
    _updateLockedUtxos(function(err) {
      if (err) { return cb(err); }

      var checkedAddresses = 0;
      lodash.each(addresses, function (address) {
        _getAssetsForAddress(address, function (err, addressAssets) {
          if (err) { return cb(err); }

          root.assets = root.assets.concat(addressAssets);

          if (++checkedAddresses == addresses.length) {
            return cb(null, root.assets);
          }
        })
      });
    });
  };

  var _getAssetsForAddress = function(address, cb) {
    var network = profileService.focusedClient.credentials.network;
    getAssetsByAddress(address, network, function(err, assetsInfo) {
      if (err) { return cb(err); }

      $log.debug("Assets for " + address + ": \n" + JSON.stringify(assetsInfo));

      var assets = [];
      assetsInfo.forEach(function(asset) {
        getMetadata(asset, network, function(err, metadata) {
          var isLocked = lodash.includes(self.lockedUtxos, asset.utxo.txid + ":" + asset.utxo.index);
          var a = {
            assetId: asset.assetId,
            utxo: asset.utxo,
            address: address,
            asset: asset,
            network: network,
            divisible: metadata.divisibility,
            icon: _extractAssetIcon(metadata),
            issuanceTxid: metadata.issuanceTxid,
            metadata: metadata.metadataOfIssuence.data,
            locked: isLocked
          };
          assets.push(a);
          if (assetsInfo.length == assets.length) {
            return cb(null, assets);
          }
        });
      });
      if (assetsInfo.length == assets.length) {
        return cb(null, assets);
      }
    });
  };

  root.broadcastTx = function(txHex, cb) {
    var network = profileService.focusedClient.credentials.network;
    postTo('broadcast', { txHex: txHex }, network, cb);
  };

  root.createTransferTx = function(asset, amount, toAddress, assets, cb) {
    if (amount > asset.asset.amount) {
      return cb({ error: "Cannot transfer more assets then available" }, null);
    }

    var fc = profileService.focusedClient;

    var to = [{
      "address": toAddress,
      "amount": amount,
      "assetId": asset.asset.assetId
    }];

    // transfer the rest of asset back to our address
    if (amount < asset.asset.amount) {
      to.push({
        "address": asset.address,
        "amount": asset.asset.amount - amount,
        "assetId": asset.asset.assetId
      });
    }

    // We need extra 600 satoshis if we have change transfer
    var financeAmount = root.defaultFee() + 600 * (to.length - 1);

    selectFinanceOutput(financeAmount, fc, assets, function(err, financeUtxo) {
      if (err) { return cb(err); }

      var transfer = {
        from: asset.address,
        fee: root.defaultFee(),
        to: to,
        financeOutput: {
          value: financeUtxo.satoshis,
          n: financeUtxo.vout,
          scriptPubKey: {
            asm: new bitcore.Script(financeUtxo.scriptPubKey).toString(),
            hex: financeUtxo.scriptPubKey,
            type: 'scripthash'
          }
        },
        financeOutputTxid: financeUtxo.txid
      };

      console.log(JSON.stringify(transfer, null, 2));
      var network = fc.credentials.network;
      postTo('sendasset', transfer, network, cb);
    });
  };

  return root;
}


angular.module('copayAddon.coloredCoins').service('coloredCoins', ColoredCoins);
