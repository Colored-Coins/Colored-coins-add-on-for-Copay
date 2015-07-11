

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

angular.module('copayAddon.coloredCoins').controller('assetsController', function ($rootScope, $scope, $modal, $timeout, coloredCoins, gettext, profileService) {
  var self = this;

  this.assets = [];

  $rootScope.$on('Local/BalanceUpdated', function (event, balance) {
    self.assets = [];
    //self.setOngoingProcess(gettext('Getting assets'));
    balance.byAddress.forEach(function (ba) {
      coloredCoins.getAssets(ba.address, function (assets) {
        self.assets = self.assets.concat(assets);
        //self.setOngoingProcess();
      })
    });
  });

  this.setTransferError = function(err) {
    var fc = profileService.focusedClient;
    $log.warn(err);
    var errMessage =
        fc.credentials.m > 1 ? gettext('Could not create asset transfer proposal') : gettext('Could not transfer asset');

    //This are abnormal situations, but still err message will not be translated
    //(the should) we should switch using err.code and use proper gettext messages
    errMessage = errMessage + '. ' + (err.message ? err.message : gettext('Check you connection and try again'));

    this.error = errMessage;

    $timeout(function() {
      $scope.$digest();
    }, 1);
  };


  var submitTransfer = function(asset, transfer, form) {
    console.log(asset);
    console.log(transfer);

    var fc = profileService.focusedClient;

    if (form.$invalid) {
      this.error = gettext('Unable to send transaction proposal');
      return;
    }

    if (fc.isPrivKeyEncrypted()) {
      profileService.unlockFC(function(err) {
        if (err) return setTransferError(err);
        return submitTransfer(asset, transfer, form);
      });
      return;
    }

    //self.setOngoingProcess(gettext('Getting transaction'));
    $timeout(function() {
      var address, amount;

      address = transfer._address;
      amount = transfer._amount;

      fc.sendTxProposal({
        toAddress: address,
        amount: 1000,
        message: '',
        payProUrl: null,
        feePerKb: 1000
      }, function(err, txp) {
        if (err) {
          //self.setOngoingProcess();
          profileService.lockFC();
          return setTransferError(err);
        }

        console.log(txp);

        fc.removeTxProposal(txp, function(err, txpb) {
          coloredCoins.transferAsset(asset, amount, address, txp.inputs[0], txp.requiredSignatures);
        });
      });
    }, 100);
  };

  this.openTransferModal = function(asset) {
    var ModalInstanceCtrl = function($scope, $modalInstance) {
      $scope.asset = asset;
      $scope.transferAsset = function(transfer, form) {
        submitTransfer($scope.asset, transfer, form);
      };
      $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
      };
    };
    var modalInstance = $modal.open({
      templateUrl: 'colored-coins/views/modals/send.html',
      windowClass: 'full animated slideInUp',
      controller: ModalInstanceCtrl
    });

    modalInstance.result.finally(function() {
      var m = angular.element(document.getElementsByClassName('reveal-modal'));
      m.addClass('slideOutDown');
    });
  };

  this.openAssetModal = function (asset) {
    var ModalInstanceCtrl = function($scope, $modalInstance) {
      $scope.asset = asset;
      $scope.openTransferModal = self.openTransferModal;
      $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
      };
    };
    var modalInstance = $modal.open({
      templateUrl: 'colored-coins/views/modals/asset-details.html',
      windowClass: 'full animated slideInUp',
      controller: ModalInstanceCtrl
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

function ColoredCoins(configService, $http, $log, bitcore) {
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

  this.postTo = function(api_endpoint, json_data, cb) {
    $log.debug('Post to:' + api_endpoint + ". Data: " + JSON.stringify(json_data));
    $http.post('http://' + apiHost + '/v2/' + api_endpoint, json_data)
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

ColoredCoins.prototype.transferAsset = function(asset, amount, to, txIn, numSigsRequired) {

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

  this.postTo('sendasset', transfer, function (err, body) {
    if (err) {
      console.log('error: ', err);
      return;
    }

    console.log(body.txHex);
  });
};

angular.module('copayAddon.coloredCoins').service('coloredCoins', ColoredCoins);

angular.module('copayAssetViewTemplates', ['colored-coins/views/assets.html', 'colored-coins/views/modals/asset-details.html', 'colored-coins/views/modals/send.html']);

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
    "    <div>\n" +
    "        <div class=\"text-center m20t\">\n" +
    "            <button class=\"button outline round light-gray tiny\">\n" +
    "                <span class=\"text-primary\" ng-click=\"openTransferModal(asset)\" translate>Transfer</span>\n" +
    "            </button>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "\n" +
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

angular.module("colored-coins/views/modals/send.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/modals/send.html",
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
    "    <div class=\"row m20t\">\n" +
    "        <div class=\"large-12 large-centered columns\">\n" +
    "            <form name=\"assetTransferForm\" ng-submit=\"transferAsset(transfer, assetTransferForm)\" ng-disabled=\"home.blockUx || home.onGoingProcess\" novalidate>\n" +
    "                <div class=\"box-notification\" ng-show=\"error\" ng-click=\"resetError()\">\n" +
    "                  <span class=\"text-warning\">\n" +
    "                    {{ error|translate }}\n" +
    "                  </span>\n" +
    "                    <a class=\"close-notification text-warning\">&#215;</a>\n" +
    "                </div>\n" +
    "\n" +
    "                <div ng-hide=\"home.hideAddress\">\n" +
    "                    <div class=\"row collapse\">\n" +
    "                        <label for=\"address\" class=\"left\">\n" +
    "                            <span translate>To</span>\n" +
    "                        </label>\n" +
    "                        <span ng-hide=\"assetTransferForm.address.$pristine\">\n" +
    "                          <span class=\"has-error right size-12\" ng-show=\"assetTransferForm.address.$invalid && transfer._address\">\n" +
    "                            <i class=\"icon-close-circle size-14\"></i>\n" +
    "                            <span class=\"vm\" translate>Not valid</span>\n" +
    "                          </span>\n" +
    "                          <small class=\"right text-primary\" ng-show=\"!assetTransferForm.address.$invalid\">\n" +
    "                              <i class=\"icon-checkmark-circle size-14\"></i>\n" +
    "                          </small>\n" +
    "                        </span>\n" +
    "                    </div>\n" +
    "\n" +
    "                    <div class=\"input\">\n" +
    "                        <input type=\"text\" id=\"address\" name=\"address\" ng-disabled=\"home.blockUx || home.lockAddress\"\n" +
    "                               ng-attr-placeholder=\"{{'Bitcoin address'|translate}}\" ng-model=\"transfer._address\" valid-address\n" +
    "                               required ng-focus=\"home.formFocus('address')\" ng-blur=\"home.formFocus(false)\">\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "\n" +
    "                <div class=\"row\" ng-hide=\"home.hideAmount\">\n" +
    "                    <div class=\"large-12 medium-12 columns\">\n" +
    "                        <div class=\"right\" ng-hide=\"assetTransferForm.amount.$pristine && !assetTransferForm.amount.$modelValue \">\n" +
    "                            <span class=\"has-error right size-12\" ng-if=\"assetTransferForm.amount.$invalid\">\n" +
    "                                <i class=\"icon-close-circle size-14\"></i>\n" +
    "                                <span clas=\"vm\" translate>Not valid</span>\n" +
    "                            </span>\n" +
    "                            <small class=\"text-primary right\" ng-if=\"!assetTransferForm.amount.$invalid\">\n" +
    "                                <i class=\"icon-checkmark-circle size-14\"></i>\n" +
    "                            </small>\n" +
    "                        </div>\n" +
    "                        <div>\n" +
    "                            <label for=\"amount\">\n" +
    "                                <span translate>Amount</span>\n" +
    "                            </label>\n" +
    "\n" +
    "                            <div class=\"input\">\n" +
    "                                <input type=\"number\" id=\"amount\" ng-disabled=\"home.blockUx || home.lockAmount\"\n" +
    "                                       name=\"amount\" ng-attr-placeholder=\"{{'Amount'|translate}}\"\n" +
    "                                       ng-minlength=\"0.00000001\" ng-maxlength=\"10000000000\" ng-model=\"transfer._amount\"\n" +
    "                                       valid-amount required autocomplete=\"off\" ng-focus=\"home.formFocus('amount')\"\n" +
    "                                       ng-blur=\"home.formFocus(false)\">\n" +
    "                                <a class=\"postfix\" translate>units</a>\n" +
    "                            </div>\n" +
    "                        </div>\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div class=\"row\" ng-show=\"!home.onGoingProcess\">\n" +
    "                    <div class=\"large-6 medium-6 small-6 columns\"\n" +
    "                         ng-show=\"!home.blockUx && (home.lockAddress || home.lockAmount)\">\n" +
    "                        <a ng-click=\"cancel()\" class=\"button expand outline dark-gray round\" translate>Cancel</a>\n" +
    "                    </div>\n" +
    "                    <div class=\"columns\"\n" +
    "                         ng-class=\"{'small-6 medium-6 large-6':(home.lockAddress || home.lockAmount)}\">\n" +
    "                        <button type=\"submit\" class=\"button black round expand\"\n" +
    "                                ng-disabled=\"assetTransferForm.$invalid || home.blockUx ||  index.isOffline\"\n" +
    "                                ng-style=\"{'background-color':index.backgroundColor}\" translate>\n" +
    "                            Transfer\n" +
    "                        </button>\n" +
    "                    </div>\n" +
    "\n" +
    "                </div>\n" +
    "            </form>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"extra-margin-bottom\"></div>\n" +
    "</div> <!-- END Send -->");
}]);
