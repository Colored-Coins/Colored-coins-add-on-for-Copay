

var module = angular.module('copayAddon.coloredCoins', ['copayAssetViewTemplates']);

module.config(function(addonManagerProvider) {
  addonManagerProvider.registerAddon({
    menuItem: {
      'title': 'Assets',
      'icon': 'icon-pricetag',
      'link': 'assets'
    },
    view: {
      id: 'assets',
      'class': 'assets',
      template: 'colored-coins/views/assets.html'
    }
  });
});
'use strict';

angular.module('copayAddon.coloredCoins')
    .controller('assetsController', function ($rootScope, $modal, coloredCoins) {
      var self = this;

      this.assets = [];

      $rootScope.$on('Local/BalanceUpdated', function (event, balance) {
        self.assets = [];
        balance.byAddress.forEach(function (ba) {
          coloredCoins.getAssets(ba.address, function (assets) {
            self.assets = self.assets.concat(assets);
          })
        });
      });

      this.openAssetModal = function (asset) {
        var ModalInstanceCtrl = function($scope, $modalInstance) {
          $scope.asset = asset;
          $scope.cancel = function() {
            $modalInstance.dismiss('cancel');
          };
        };
        var modalInstance = $modal.open({
          templateUrl: 'colored-coins/views/modals/asset-details.html',
          windowClass: 'full animated slideInUp',
          controller: ModalInstanceCtrl,
        });

        modalInstance.result.finally(function() {
          var m = angular.element(document.getElementsByClassName('reveal-modal'));
          m.addClass('slideOutDown');
        });
      };
    });
'use strict';

angular.module('copayAddon.coloredCoins')
  .filter('stringify', function($sce) {
    return function(json) {
      json = json || [];
      return $sce.trustAsHtml(JSON.stringify(json, null, 4).replace(/\n/g, '<br>'));
    }
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
        assets.push({ address: address, asset: asset, metadata: metadata });
        if (assetsInfo.length == assets.length) {
          return cb(assets);
        }
      });
    });
  });
};

angular.module('copayAddon.coloredCoins').service('coloredCoins', ColoredCoins);

angular.module('copayAssetViewTemplates', ['colored-coins/views/assets.html', 'colored-coins/views/modals/asset-details.html']);

angular.module("colored-coins/views/assets.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/assets.html",
    "<div ng-show=\"assets.assets\" class=\"scroll\" ng-controller=\"assetsController as assets\">\n" +
    "    <div ng-repeat=\"asset in assets.assets\" ng-click=\"assets.openAssetModal(asset)\"\n" +
    "         class=\"row collapse last-transactions-content\">\n" +
    "        <div class=\"small-1 columns text-center\">\n" +
    "            <i class=\"icon-pricetag size-24\" style=\"margin-top:8px;\"></i>\n" +
    "            &nbsp;\n" +
    "        </div>\n" +
    "        <div class=\"small-4 columns\">\n" +
    "            <div ng-if=\"!$root.updatingBalance\">\n" +
    "                <span class=\"text-bold size-16\">{{ asset.metadata.data.assetName }}</span>\n" +
    "            </div>\n" +
    "            <div class=\"ellipsis text-gray size-14\">\n" +
    "                {{ asset.metadata.data.description }}\n" +
    "            </div>\n" +
    "        </div>\n" +
    "        <div class=\"small-2 columns\">\n" +
    "          <span class=\"size-16\">\n" +
    "            {{ asset.asset.amount }} unit{{ asset.asset.amount != 1 ? 's' : '' }}\n" +
    "          </span>\n" +
    "        </div>\n" +
    "        <div class=\"small-4 columns\">\n" +
    "            <span class=\"size-14\"><span translate>Issued by</span>: {{ asset.metadata.data.issuer }}</span>\n" +
    "        </div>\n" +
    "        <div class=\"small-1 columns text-right\">\n" +
    "            <i class=\"icon-arrow-right3 size-18\"></i>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<div class=\"extra-margin-bottom\"></div>\n" +
    "");
}]);

angular.module("colored-coins/views/modals/asset-details.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/modals/asset-details.html",
    "<nav class=\"tab-bar\">\n" +
    "    <section class=\"left-small\">\n" +
    "        <a ng-click=\"cancel()\">\n" +
    "            <i class=\"icon-arrow-left3 icon-back\"></i>\n" +
    "            <span class=\"text-back\" translate>Back</span>\n" +
    "        </a>\n" +
    "    </section>\n" +
    "    <section class=\"middle tab-bar-section\">\n" +
    "        <h1 class=\"title ellipsis\" ng-style=\"{'color':color}\" translate>\n" +
    "            Asset\n" +
    "        </h1>\n" +
    "    </section>\n" +
    "</nav>\n" +
    "\n" +
    "<div class=\"modal-content\">\n" +
    "    <div class=\"header-modal text-center\">\n" +
    "        <div class=\"size-42\">\n" +
    "            {{ asset.metadata.data.assetName }}\n" +
    "        </div>\n" +
    "        <div class=\"size-18 m5t text-gray\" ng-show=\"btx.alternativeAmount\">\n" +
    "            {{ asset.metadata.data.description }}\n" +
    "        </div>\n" +
    "    </div>\n" +
    "\n" +
    "    <h4 class=\"title m0\" translate>Details</h4>\n" +
    "    <ul class=\"no-bullet size-14 m0\">\n" +
    "        <li class=\"line-b p10 oh\">\n" +
    "            <span class=\"text-gray\" translate>Amount</span>:\n" +
    "    <span class=\"right\">\n" +
    "      <time>{{ asset.asset.amount }}</time>\n" +
    "    </span>\n" +
    "        </li>\n" +
    "        <li class=\"line-b p10 oh\">\n" +
    "            <span class=\"text-gray\" translate>Issuer</span>:\n" +
    "    <span class=\"right\">\n" +
    "      {{ asset.metadata.data.issuer }}\n" +
    "    </span>\n" +
    "        </li>\n" +
    "        <li class=\"line-b p10 oh\">\n" +
    "            <span class=\"text-gray\" translate>Raw metadata</span>:\n" +
    "            <pre class=\"right\" ng-bind-html=\"asset.metadata | stringify\"></pre>\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "\n" +
    "    <div class=\"extra-margin-bottom\"></div>\n" +
    "</div>");
}]);
