

var module = angular.module('copayPlugin.coloredCoins', ['copayAssetViewTemplates']);

module.config(function(pluginManagerProvider) {
  pluginManagerProvider.registerMenuItem({
    'title': 'Assets',
    'icon': 'icon-pricetag',
    'link': 'assets'
  });

  pluginManagerProvider.registerView('assets', 'assets', 'colored-coins/views/assets.html')
});
'use strict';

angular.module('copayPlugin.coloredCoins')
    .controller('assetsController', function ($rootScope, coloredCoins) {
      var self = this;

      this.assets = [];

      $rootScope.$on('Local/BalanceUpdated', function (event, balance) {
        var updatedAssets = [];
        balance.byAddress.forEach(function (ba) {
          coloredCoins.getAssets(ba.address, function (assets) {
            updatedAssets.push(assets);
          })
        });
        self.assets = updatedAssets
      });


      this.openAssetModal = function () {
      };
    });
'use strict';

function ColoredCoins(configService, $http, $log) {
  var defaultConfig = {
    apiHost: 'testnet.api.coloredcoins.org:80'
  };

  var apiHost = (configService.getSync()['coloredCoins'] || defaultConfig)['apiHost'],
      self = this,
      log = $log;

  this.log = $log;

  this.handleResponse = function (data, status, cb) {
    log.debug('Status: ', status);
    log.debug('Body: ', JSON.stringify(data));

    if (status != 200 && status != 201) {
      return cb(data);
    }
    return cb(null, data);
  };

  this.getFrom = function (api_endpoint, param, cb) {
    log.debug('Get from:' + api_endpoint + '/' + param);
    $http.get('http://' + apiHost + '/v2/' + api_endpoint + '/' + param)
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

    self.log.debug("Assets for " + address + ": \n" + JSON.stringify(assetsInfo));

    var assets = [];
    assetsInfo.forEach(function(asset) {
      self.getMetadata(asset, function(err, metadata) {
        metadata.amount = asset.amount;
        assets.push({ asset: asset, metadata: metadata });
        if (assetsInfo.length == assets.length) {
          return cb(metadata);
        }
      });
    });
  });
};

angular.module('copayPlugin.coloredCoins').service('coloredCoins', ColoredCoins);

angular.module('copayAssetViewTemplates', ['colored-coins/views/assets.html']);

angular.module("colored-coins/views/assets.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/assets.html",
    "<div ng-show=\"assets.assets\" class=\"scroll\" ng-controller=\"assetsController as assets\">\n" +
    "    <div ng-repeat=\"asset in assets.assets\" ng-click=\"assets.openAssetModal(asset)\"\n" +
    "         class=\"row collapse last-transactions-content\">\n" +
    "        <div class=\"small-1 columns text-center\">\n" +
    "            <i class=\"icon-circle-active size-10\" ng-style=\"{'color':index.backgroundColor}\" style=\"margin-top:8px;\"></i>\n" +
    "            &nbsp;\n" +
    "        </div>\n" +
    "        <div class=\"small-4 columns\">\n" +
    "            <div ng-if=\"!$root.updatingBalance\">\n" +
    "                <span class=\"text-bold size-16\">{{ asset.metadata.assetName }}</span>\n" +
    "            </div>\n" +
    "            <div class=\"ellipsis text-gray size-14\">\n" +
    "                {{ asset.metadata.description }}\n" +
    "            </div>\n" +
    "        </div>\n" +
    "        <div class=\"small-2 columns\">\n" +
    "          <span class=\"size-16\">\n" +
    "            {{ asset.amount }} unit{{ asset.metadata.amount != 1 ? 's' : '' }}\n" +
    "          </span>\n" +
    "        </div>\n" +
    "        <div class=\"small-4 columns\">\n" +
    "            <span class=\"size-14\"><span translate>Issued by</span>: {{ asset.metadata.issuer }}</span>\n" +
    "        </div>\n" +
    "        <div class=\"small-1 columns text-right\">\n" +
    "            <br>\n" +
    "            <i class=\"icon-arrow-right3 size-18\"></i>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<div class=\"extra-margin-bottom\"></div>\n" +
    "");
}]);
