
var module = angular.module('copayAddon.coloredCoins', ['copayAssetViewTemplates']);

module
    .config(function ($stateProvider) {
      $stateProvider
          .state('assets', {
            url: '/assets',
            walletShouldBeComplete: true,
            needProfile: true,
            views: {
              'main': {
                templateUrl: 'colored-coins/views/assets.html'
              }
            }
          });
      $stateProvider.decorator('views', function (state, parent) {
        var views = parent(state);

        // replace both default 'splash' and 'disclaimer' states with a single one
        if (state.name == 'splash' || state.name == 'disclaimer') {
          views['main@'].templateUrl = 'colored-coins/views/landing.html';
          views['main@'].controller = function($scope, $timeout, $log, profileService, storageService, go) {
            storageService.getCopayDisclaimerFlag(function(err, val) {
              if (val && profileService.profile) {
                  go.walletHome();
              }
            });

            $scope.agreeAndCreate = function(noWallet) {
              storageService.setCopayDisclaimerFlag(function(err) {

                if (profileService.profile) {
                  $timeout(function() {
                    applicationService.restart();
                  }, 1000);
                }

                $scope.creatingProfile = true;

                profileService.create({
                  noWallet: noWallet
                }, function(err) {
                  if (err) {
                    $scope.creatingProfile = false;
                    $log.warn(err);
                    $scope.error = err;
                    $scope.$apply();
                    $timeout(function() {
                      $scope.create(noWallet);
                    }, 3000);
                  }
                });
              });

            };
          }

        }

        return views;
      });
/*      $stateProvider
          .state('splash', {
            url: '/splash',
            needProfile: false,
            views: {
              'main': {
                templateUrl: 'colored-coins/views/landing.html',
                controller: function($scope, $timeout, $log, profileService, storageService, go) {
                  storageService.getCopayDisclaimerFlag(function(err, val) {
                    if (!val) go.path('disclaimer');

                    if (profileService.profile) {
                      go.walletHome();
                    }
                  });

                  $scope.create = function(noWallet) {
                    $scope.creatingProfile = true;

                    profileService.create({
                      noWallet: noWallet
                    }, function(err) {
                      if (err) {
                        $scope.creatingProfile = false;
                        $log.warn(err);
                        $scope.error = err;
                        $scope.$apply();
                        $timeout(function() {
                          $scope.create(noWallet);
                        }, 3000);
                      }
                    });
                  };
                }
              }
            }
          });             */
    })
    .run(function (addonManager, coloredCoins, $state) {
      addonManager.registerAddon({
        menuItem: {
          title: 'Assets',
          icon: 'icon-pricetag',
          link: 'assets',
          open: function() {
            $state.go('assets');
          }
        },
        formatPendingTxp: function (txp) {
          if (txp.metadata && txp.metadata.asset) {
            var value = txp.amountStr;
            var asset = txp.metadata.asset;
            txp.amountStr = asset.amount + " unit" + (asset.amount > 1 ? "s" : "") + " of " + asset.assetName + " (" + value + ")";
            txp.showSingle = true;
            txp.toAddress = txp.outputs[0].toAddress; // txproposal
            txp.address = txp.outputs[0].address;     // txhistory
          }
        },
        processCreateTxOpts: function (txOpts) {
          txOpts.utxosToExclude = (txOpts.utxosToExclude || []).concat(coloredCoins.getColoredUtxos());
        }
      });
    });
'use strict';

angular.module('copayAddon.coloredCoins')
    .controller('assetsController', function ($rootScope, $scope, $modal, $controller, $timeout, $log, coloredCoins, gettext,
                                              profileService, feeService, lodash) {
  var self = this;

  this.assets = coloredCoins.assets;

  this.setOngoingProcess = function(name) {
    $rootScope.$emit('Addon/OngoingProcess', name);
  };

  var disableAssetListener = $rootScope.$on('ColoredCoins/AssetsUpdated', function (event, assets) {
    self.assets = assets;
  });

  $scope.$on('$destroy', function() {
    disableAssetListener();
  });

  this.openTransferModal = function(asset) {

    var AssetTransferController = function($rootScope, $scope, $modalInstance, $timeout, $log, coloredCoins, gettext,
                                           profileService, lodash, bitcore, txStatus) {
      $scope.asset = asset;

      $scope.error = '';

      var txStatusOpts = {
        templateUrl: 'colored-coins/views/modals/asset-status.html'
      };

      $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
      };

      $scope.resetError = function() {
        this.error = this.success = null;
      };

      var setOngoingProcess = function(name) {
        $rootScope.$emit('Addon/OngoingProcess', name);
      };

      $scope.onQrCodeScanned = function(data) {
        this.error = '';
        var form = this.assetTransferForm;
        if (data) {
          form.address.$setViewValue(new bitcore.URI(data).address.toString());
          form.address.$isValid = true;
          form.address.$render();
          $scope.lockAddress = true;
        }

        if (form.address.$invalid) {
          $scope.resetForm(form);
          this.error = gettext('Could not recognize a valid Bitcoin QR Code');
        }
      };

      var setTransferError = function(err) {
        var fc = profileService.focusedClient;
        $log.warn(err);
        var errMessage =
            fc.credentials.m > 1 ? gettext('Could not create asset transfer proposal') : gettext('Could not transfer asset');

        //This are abnormal situations, but still err message will not be translated
        //(the should) we should switch using err.code and use proper gettext messages
        err.message = err.error ? err.error : err.message;
        errMessage = errMessage + '. ' + (err.message ? err.message : gettext('Check you connection and try again'));

        $scope.error = errMessage;

        $timeout(function() {
          $scope.$digest();
        }, 1);
      };

      var handleTransferError = function(err) {
        profileService.lockFC();
        setOngoingProcess();
        return setTransferError(err);
      };

      $scope.resetForm = function(form) {
        $scope.resetError();

        $scope.lockAddress = false;
        $scope.lockAmount = false;

        $scope._amount = $scope._address = null;

        if (form && form.amount) {
          form.amount.$pristine = true;
          form.amount.$setViewValue('');
          form.amount.$render();

          form.$setPristine();

          if (form.address) {
            form.address.$pristine = true;
            form.address.$setViewValue('');
            form.address.$render();
          }
        }
        $timeout(function() {
          $rootScope.$digest();
        }, 1);
      };

      var _signAndBroadcast = function(txp, cb) {
        var fc = profileService.focusedClient;
        self.setOngoingProcess(gettext('Signing transaction'));
        fc.signTxProposal(txp, function(err, signedTx) {
          profileService.lockFC();
          setOngoingProcess();
          if (err) {
            $log.debug('Sign error:', err);
            err.message = gettext('Asset transfer was created but could not be signed. Please try again from home screen.') + (err.message ? ' ' + err.message : '');
            return cb(err);
          }

          console.log(signedTx);

          if (signedTx.status == 'accepted') {
            setOngoingProcess(gettext('Broadcasting transaction'));
            fc.broadcastTxProposal(signedTx, function(err, btx, memo) {
              setOngoingProcess();
              if (err) {
                err.message = gettext('Asset transfer was signed but could not be broadcasted. Please try again from home screen.') + (err.message ? ' ' + err.message : '');
                return cb(err);
              }
              if (memo)
                $log.info(memo);

              txStatus.notify(btx, txStatusOpts, function() {
                $scope.$emit('Local/TxProposalAction', true);
                return cb();
              });
            });
          } else {
            setOngoingProcess();
            txStatus.notify(signedTx, txStatusOpts, function() {
              $scope.$emit('Local/TxProposalAction');
              return cb();
            });
          }
        });
      };

      $scope.transferAsset = function(transfer, form) {
        if (asset.locked) {
          setTransferError({ message: "Cannot transfer locked asset" });
          return;
        }
        $log.debug("Transfering " + transfer._amount + " units(s) of asset " + asset.asset.assetId + " to " + transfer._address);

        var fc = profileService.focusedClient;

        if (form.$invalid) {
          this.error = gettext('Unable to send transaction proposal');
          return;
        }

        if (fc.isPrivKeyEncrypted()) {
          profileService.unlockFC(function(err) {
            if (err) return setTransferError(err);
            return $scope.transferAsset(transfer, form);
          });
          return;
        }

        setOngoingProcess(gettext('Creating transfer transaction'));
        coloredCoins.createTransferTx(asset, transfer._amount, transfer._address, self.assets, function(err, result) {
          if (err) { return handleTransferError(err); }

          var tx = new bitcore.Transaction(result.txHex);
          $log.debug(JSON.stringify(tx.toObject(), null, 2));


          var inputs = lodash.map(tx.inputs, function(input) {
            input = input.toObject();
            input = coloredCoins.txidToUTXO[input.prevTxId + ":" + input.outputIndex];
            input.outputIndex = input.vout;
            return input;
          });

          // drop change output provided by CC API. We want change output to be added by BWS in according with wallet's
          // fee settings
          var outputs = lodash.chain(tx.outputs)
              .map(function(o) { return { script: o.script.toString(), amount: o.satoshis }; })
              .dropRight()
              .value();

          // for Copay to show recipient properly
          outputs[0].toAddress = transfer._address;

          setOngoingProcess(gettext('Creating tx proposal'));
          feeService.getCurrentFeeValue(function(err, feePerKb) {
            if (err) $log.debug(err);
            fc.sendTxProposal({
              type: 'external',
              inputs: inputs,
              outputs: outputs,
              noOutputsShuffle: true,
              message: '',
              payProUrl: null,
              feePerKb: feePerKb,
              metadata: {
                asset: {
                  assetId: asset.asset.assetId,
                  assetName: asset.metadata.assetName,
                  icon: asset.icon,
                  utxo: lodash.pick(asset.utxo, ['txid', 'index']),
                  amount: transfer._amount
                }
              }
            }, function(err, txp) {
              if (err) {
                setOngoingProcess();
                profileService.lockFC();
                return setTransferError(err);
              }

              _signAndBroadcast(txp, function(err) {
                setOngoingProcess();
                profileService.lockFC();
                $scope.resetForm();
                if (err) {
                  self.error = err.message ? err.message : gettext('Asset transfer was created but could not be completed. Please try again from home screen');
                  $scope.$emit('Local/TxProposalAction');
                  $timeout(function() {
                    $scope.$digest();
                  }, 1);
                }
                $scope.cancel();
              });
            });
          });
        });
      };
    };

    var modalInstance = $modal.open({
      templateUrl: 'colored-coins/views/modals/send.html',
      windowClass: 'full animated slideInUp',
      controller: AssetTransferController
    });

    modalInstance.result.finally(function() {
      var m = angular.element(document.getElementsByClassName('reveal-modal'));
      m.addClass('slideOutDown');
    });
  };

  this.openAssetModal = function (asset) {
    var ModalInstanceCtrl = function($rootScope, $scope, $modalInstance, insight) {
      $scope.asset = asset;
      insight = insight.get();
      insight.getTransaction(asset.issuanceTxid, function(err, tx) {
        if (!err) {
          $scope.issuanceTx = tx;
        }
      });
      $scope.openTransferModal = self.openTransferModal;

      $scope.openBlockExplorer = function(asset) {
        $rootScope.openExternalLink(insight.url + '/tx/' + asset.issuanceTxid)
      };

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

function ColoredCoins($rootScope, profileService, configService, bitcore, $http, $log, lodash) {
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

  var disableBalanceListener = $rootScope.$on('Local/BalanceUpdated', function (event, balance) {
    root.assets = [];
    var addresses = lodash.pluck(balance.byAddress, 'address');

    $rootScope.$emit('Addon/OngoingProcess', 'Getting assets');
    root.fetchAssets(addresses, function (err, assets) {
      root.assets = assets;
      $rootScope.$emit('ColoredCoins/AssetsUpdated', assets);
      $rootScope.$emit('Addon/OngoingProcess', null);
    });
  });

  $rootScope.$on('$destroy', function() {
    disableBalanceListener();
  });


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

'use strict';


angular.module('copayAddon.coloredCoins').factory('insight', function ($http, profileService) {

  function Insight(opts) {
    this.network = opts.network || 'livenet';
    this.url = opts.url;
  }

  Insight.prototype.getTransaction = function(txid, cb) {
    var url = this.url + '/api/tx/' + txid;

    $http.get(url)
        .success(function (data, status) {
          if (status != 200) return cb(data);
          return cb(null, data);
        })
        .error(function (data, status) {
          return cb(data);
        });
  };

  var testnetInsight = new Insight({ network: 'testnet', url: 'https://test-insight.bitpay.com' });

  var livenetInsight = new Insight({ network: 'livenet', url: 'https://insight.bitpay.com' });

  return {
    get: function() {
      var fc = profileService.focusedClient;
      return fc.credentials.network == 'testnet' ? testnetInsight : livenetInsight;
    }
  };
});

'use strict';

angular.module('copayAddon.coloredCoins')
    .directive('booleanIcon', function() {
      return {
        restrict: 'E',
        scope: {
          value: '='
        },
        replace: true,
        template: '<span>' +
                    '<i class="fi-check" style="color:green" ng-show="value"></i>' +
                    '<i class="fi-x" style="color:red" ng-show="!value"></i>' +
                  '</span>'
      }
    });

angular.module('copayAssetViewTemplates', ['colored-coins/views/assets.html', 'colored-coins/views/includes/topbar.html', 'colored-coins/views/landing.html', 'colored-coins/views/modals/asset-details.html', 'colored-coins/views/modals/asset-status.html', 'colored-coins/views/modals/send.html']);

angular.module("colored-coins/views/assets.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/assets.html",
    "<div class=\"topbar-container\" ng-include=\"'colored-coins/views/includes/topbar.html'\"></div>\n" +
    "\n" +
    "<div ng-show=\"assets.assets\" class=\"scroll\" ng-controller=\"assetsController as assets\">\n" +
    "    <div ng-repeat=\"asset in assets.assets | orderBy:['assetName', 'utxo.txid']\" ng-click=\"assets.openAssetModal(asset)\"\n" +
    "         class=\"row collapse assets-list\">\n" +
    "        <div class=\"small-1 columns text-center\">\n" +
    "            <img ng-src=\"{{ asset.icon }}\" class=\"asset-icon icon\" ng-show=\"asset.icon\"/>\n" +
    "            <img class=\"asset-icon icon default-icon\" ng-hide=\"asset.icon\"/>\n" +
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
    "            {{ asset.asset.amount }} unit{{ asset.asset.amount != 1 ? 's' : '' }}\n" +
    "            <i class=\"fi-lock\" ng-show=\"asset.locked\"></i>\n" +
    "          </span>\n" +
    "        </div>\n" +
    "        <div class=\"small-4 columns\">\n" +
    "            <span class=\"size-14\"><span translate>Issued by</span>: {{ asset.metadata.issuer }}</span>\n" +
    "        </div>\n" +
    "        <div class=\"small-1 columns text-right\">\n" +
    "            <i class=\"icon-arrow-right3 size-18\"></i>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<div class=\"extra-margin-bottom\"></div>\n" +
    "<div ng-include=\"'views/includes/menu.html'\" ng-show=\"!index.noFocusedWallet\"></div>\n" +
    "");
}]);

angular.module("colored-coins/views/includes/topbar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/includes/topbar.html",
    "<nav ng-controller=\"topbarController as topbar\" class=\"tab-bar\">\n" +
    "    <section class=\"left-small\">\n" +
    "        <a id=\"hamburger\" class=\"p10\" ng-show=\"!goBackToState && !closeToHome  && !index.noFocusedWallet\"\n" +
    "           ng-click=\"index.openMenu()\"><i class=\"fi-list size-24\"></i>\n" +
    "        </a>\n" +
    "    </section>\n" +
    "\n" +
    "    <section class=\"right-small\">\n" +
    "\n" +
    "    </section>\n" +
    "\n" +
    "    <section class=\"middle tab-bar-section\">\n" +
    "        <h1 class=\"title ellipsis\" ng-style=\"{'color': noColor ? '#4A90E2' : index.backgroundColor}\">\n" +
    "            {{(titleSection|translate) || (index.alias || index.walletName)}}\n" +
    "        </h1>\n" +
    "    </section>\n" +
    "</nav>\n" +
    "");
}]);

angular.module("colored-coins/views/landing.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/landing.html",
    "<div class=\"text-center cc-landing\" ng-if=\"!index.hasProfile\">\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"medium-6 large-4 medium-centered small-centered large-centered columns m20t\">\n" +
    "            <div class=\"cc-logo\"></div>\n" +
    "            <div class=\"p20\">\n" +
    "                <span class=\"text-bold size-16 text-white\" translate>WELCOME TO COLORED COPAY</span>\n" +
    "                <p class=\"text-gray size-14 m0 text-light\" translate>A multisignature bitcoin wallet with colored coins support</p>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"text-center size-12 text-warning\" ng-show=\"error && !creatingProfile\">\n" +
    "        {{(error)|translate}}. <span translate>Retrying...</span>\n" +
    "    </div>\n" +
    "    <div class=\"onGoingProcess\" ng-show=\"creatingProfile\">\n" +
    "        <div class=\"onGoingProcess-content\" ng-style=\"{'background-color':'#222'}\">\n" +
    "            <div class=\"spinner\">\n" +
    "                <div class=\"rect1\"></div>\n" +
    "                <div class=\"rect2\"></div>\n" +
    "                <div class=\"rect3\"></div>\n" +
    "                <div class=\"rect4\"></div>\n" +
    "                <div class=\"rect5\"></div>\n" +
    "            </div>\n" +
    "            <span translate>Creating Profile...</span>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"gif-splash\">\n" +
    "        <span class=\"text-bold text-gray\" translate>Terms of Use</span>\n" +
    "        <p class=\"enable_text_select text-light text-left size-14 text-black cc-disclaimer\" translate>\n" +
    "            The software you are about to use functions as a free, open source, and multi-signature digital wallet. The software does not constitute an account where BitPay or other third parties serve as financial intermediaries or custodians of your bitcoin.  While the software has undergone beta testing and continues to be improved by feedback from the open-source user and developer community, we cannot guarantee that there will be no bugs in the software. You acknowledge that your use of this software is at your own discretion and in compliance with all applicable laws. You are responsible for safekeeping your passwords, private key pairs, PINs and any other codes you use to access the software. IF YOU LOSE ACCESS TO YOUR COPAY WALLET OR YOUR ENCRYPTED PRIVATE KEYS AND YOU HAVE NOT SEPARATELY STORED A BACKUP OF YOUR WALLET AND CORRESPONDING PASSWORD, YOU ACKNOWLEDGE AND AGREE THAT ANY BITCOIN YOU HAVE ASSOCIATED WITH THAT COPAY  WALLET WILL BECOME INACCESSIBLE. All transaction requests are irreversible.  The authors of the software, employees and affiliates of Bitpay, copyright holders, and BitPay, Inc. cannot retrieve your private keys or passwords if you lose or forget them and cannot guarantee transaction confirmation as they do not have control over the Bitcoin network. To the fullest extent permitted by law, this software is provided “as is” and no representations or warranties can be made of any kind, express or implied, including but not limited to the warranties of merchantability, fitness or a particular purpose and noninfringement. You assume any and all risks associated with the use of the software. In no event shall the authors of the software, employees and affiliates of Bitpay, copyright holders, or BitPay, Inc. be held liable for any claim, damages or other liability, whether in an action of contract, tort, or otherwise, arising from, out of or in connection with the software. We reserve the right to modify this disclaimer from time to time.\n" +
    "        </p>\n" +
    "        <div class=\"columns start-button m10t\" ng-show=\"!creatingProfile\">\n" +
    "            <p class=\"text-light text-gray\" translate>I affirm that I have read, understood, and agree with these terms.</p>\n" +
    "            <button ng-click=\"agreeAndCreate()\" class=\"button black expand round size-12 text-spacing\" translate> OPEN WALLET </button>\n" +
    "            <p class=\"text-gray m5b size-12\" translate>Already have a wallet?</p>\n" +
    "            <button  ng-click=\"agreeAndCreate(true)\" class=\"button round outline dark-gray tiny\" translate>Import backup </button>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n" +
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
    "    <div ng-show=\"asset.locked\">\n" +
    "        <h4 class=\"title m0\">\n" +
    "            <div class=\"asset-alert\">\n" +
    "                <i class=\"fi-info\"></i>\n" +
    "                <span translate>Asset locked by pending transfer</span>\n" +
    "            </div>\n" +
    "        </h4>\n" +
    "    </div>\n" +
    "\n" +
    "    <div class=\"header-modal text-center\">\n" +
    "        <img ng-src=\"{{ asset.icon }}\" class=\"asset-image\" ng-show=\"asset.icon\"/>\n" +
    "        <div class=\"size-42\">\n" +
    "            {{ asset.metadata.assetName }}\n" +
    "        </div>\n" +
    "        <div class=\"size-18 m5t text-gray\">\n" +
    "            {{ asset.metadata.description }}\n" +
    "        </div>\n" +
    "    </div>\n" +
    "\n" +
    "    <div>\n" +
    "        <div class=\"text-center m20t\">\n" +
    "            <button class=\"button outline round light-gray tiny\" ng-click=\"openTransferModal(asset)\" ng-disabled=\"asset.locked\">\n" +
    "                <span class=\"text-primary\" translate>Transfer</span>\n" +
    "            </button>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "\n" +
    "\n" +
    "    <h4 class=\"title m0\" translate>Details</h4>\n" +
    "    <ul class=\"no-bullet size-14 m0\">\n" +
    "        <li class=\"line-b p10 oh\">\n" +
    "            <span class=\"text-gray property-name\" translate>Asset Name</span>:\n" +
    "            <span class=\"right\">\n" +
    "              <time>{{ asset.metadata.assetName }}</time>\n" +
    "            </span>\n" +
    "        </li>\n" +
    "        <li class=\"line-b p10 oh\">\n" +
    "            <span class=\"text-gray property-name\" translate>Asset ID</span>:\n" +
    "            <span class=\"right\">\n" +
    "              <time>{{ asset.metadata.assetId }}</time>\n" +
    "            </span>\n" +
    "        </li>\n" +
    "        <li class=\"line-b p10 oh\">\n" +
    "            <span class=\"text-gray property-name\" translate>Quantity</span>:\n" +
    "            <span class=\"right\">\n" +
    "              <time>{{ asset.asset.amount }}</time>\n" +
    "            </span>\n" +
    "        </li>\n" +
    "        <li class=\"line-b p10 oh\">\n" +
    "            <span class=\"text-gray property-name\" translate>Issuer</span>:\n" +
    "            <span class=\"right\">\n" +
    "              {{ asset.metadata.issuer }}\n" +
    "            </span>\n" +
    "        </li>\n" +
    "        <li class=\"line-b p10 oh\">\n" +
    "            <span class=\"text-gray property-name\" translate>Description</span>:\n" +
    "            <span class=\"right\">\n" +
    "              {{ asset.metadata.description }}\n" +
    "            </span>\n" +
    "        </li>\n" +
    "        <li class=\"line-b p10 oh\" ng-repeat=\"(name, value) in asset.metadata.userData\">\n" +
    "            <span class=\"text-gray property-name\" translate>{{ name }}</span>:\n" +
    "            <span class=\"right\">\n" +
    "              {{ value }}\n" +
    "            </span>\n" +
    "        </li>\n" +
    "        <li class=\"line-b p10 oh\">\n" +
    "            <span class=\"text-gray property-name\" translate>URLs</span>:\n" +
    "            <span class=\"right text-right asset-urls\">\n" +
    "                <span ng-repeat=\"url in asset.metadata.urls\">\n" +
    "                    <a ng-click=\"$root.openExternalLink(url.url)\">{{ url.name }}</a><br/>\n" +
    "                </span>\n" +
    "            </span>\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "\n" +
    "    <div class=\"m10t oh\" ng-init=\"hideAdv=true\">\n" +
    "        <a class=\"button outline light-gray expand tiny\" ng-click=\"hideAdv=!hideAdv\">\n" +
    "            <span translate ng-hide=\"!hideAdv\">Show Advanced</span>\n" +
    "            <span translate ng-hide=\"hideAdv\">Hide Advanced</span>\n" +
    "            <i ng-if=\"hideAdv\" class=\"icon-arrow-down4\"></i>\n" +
    "            <i ng-if=\"!hideAdv\" class=\"icon-arrow-up4\"></i>\n" +
    "        </a>\n" +
    "    </div>\n" +
    "    <div ng-hide=\"hideAdv\" class=\"m10t oh\">\n" +
    "        <ul class=\"no-bullet size-14 m0\">\n" +
    "            <li class=\"line-b p10 oh\">\n" +
    "                <span class=\"text-gray property-name\" translate>Divisible</span>:\n" +
    "                <span class=\"right\">\n" +
    "                    {{ asset.divisible }}\n" +
    "                </span>\n" +
    "            </li>\n" +
    "<!--\n" +
    "            <li class=\"line-b p10 oh\">\n" +
    "                <span class=\"text-gray property-name\" translate>Reissuable</span>:\n" +
    "                <span class=\"right\">\n" +
    "                    <boolean-icon value=\"asset.reissuable\"/>\n" +
    "                </span>\n" +
    "            </li>\n" +
    "-->\n" +
    "            <li class=\"line-b p10 oh\">\n" +
    "                <span class=\"text-gray property-name\" translate>Issuance TX</span>:\n" +
    "                <span class=\"right pointer enable_text_select\" ng-click=\"openBlockExplorer(asset)\">\n" +
    "                  {{ asset.issuanceTxid }}\n" +
    "                </span>\n" +
    "            </li>\n" +
    "            <li class=\"line-b p10 oh\">\n" +
    "                <span class=\"text-gray property-name\" translate>Issuer Address</span>:\n" +
    "                <span class=\"right\">\n" +
    "                    {{ issuanceTx.vin[0].addr }}\n" +
    "                </span>\n" +
    "            </li>\n" +
    "            <li class=\"line-b p10 oh\">\n" +
    "                <span class=\"text-gray property-name\" translate>Issuance Date</span>:\n" +
    "                <span class=\"right\">\n" +
    "                    {{ issuanceTx.time * 1000 | date:'dd MMM yyyy hh:mm'}}\n" +
    "                </span>\n" +
    "            </li>\n" +
    "        </ul>\n" +
    "\n" +
    "        <div ng-show=\"asset.issuanceTxid\">\n" +
    "            <div class=\"text-center m20t\">\n" +
    "                <button class=\"button outline round dark-gray tiny\" ng-click=\"openBlockExplorer(asset)\">\n" +
    "                    <span class=\"text-gray\" translate>See it on the blockchain</span>\n" +
    "                </button>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "\n" +
    "    <div class=\"extra-margin-bottom\"></div>\n" +
    "</div>");
}]);

angular.module("colored-coins/views/modals/asset-status.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/modals/asset-status.html",
    "<div ng-if=\"type == 'broadcasted'\" class=\"popup-txsent\">\n" +
    "    <i class=\"small-centered columns fi-check m20tp\"></i>\n" +
    "    <div class=\"text-center size-18 text-white text-bold tu p20\">\n" +
    "        <span translate>Asset Transferred</span>\n" +
    "    </div>\n" +
    "    <div class=\"text-center\">\n" +
    "        <a class=\"button outline round white tiny small-4\" ng-click=\"cancel()\" translate>OKAY</a>\n" +
    "    </div>\n" +
    "</div>\n" +
    "\n" +
    "\n" +
    "<div ng-if=\"type == 'created'\" class=\"popup-txsigned\">\n" +
    "    <i class=\"small-centered columns fi-check m20tp\"></i>\n" +
    "    <div class=\"text-center size-18 text-primary tu text-bold p20\">\n" +
    "        <span translate>Asset Transfer Proposal Created</span>\n" +
    "    </div>\n" +
    "    <div class=\"text-center\">\n" +
    "        <a class=\"button outline round light-gray tiny small-4\" ng-click=\"cancel()\" translate>OKAY</a>\n" +
    "    </div>\n" +
    "</div>\n" +
    "\n" +
    "\n" +
    "\n" +
    "<div ng-if=\"type == 'accepted'\" class=\"popup-txsigned\">\n" +
    "    <i class=\"small-centered columns fi-check m20tp\"></i>\n" +
    "    <div class=\"text-center size-18 text-primary tu text-bold p20\">\n" +
    "        <span translate>Asset Transfer Accepted</span>\n" +
    "    </div>\n" +
    "    <div class=\"text-center\">\n" +
    "        <a class=\"button outline round light-gray tiny small-4\" ng-click=\"cancel()\" translate>OKAY</a>\n" +
    "    </div>\n" +
    "</div>\n" +
    "\n" +
    "<div ng-if=\"type=='rejected'\" class=\"popup-txrejected\">\n" +
    "    <i class=\"fi-x small-centered columns m20tp\"></i>\n" +
    "    <div class=\"text-center size-18 tu text-warning text-bold p20\">\n" +
    "        <span translate>Asset Transfer Rejected</span>\n" +
    "    </div>\n" +
    "    <div class=\"text-center\">\n" +
    "        <a class=\"button outline light-gray round tiny small-4\" ng-click=\"cancel()\" translate>OKAY</a>\n" +
    "    </div>\n" +
    "</div>\n" +
    "");
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
    "\n" +
    "    <section class=\"right-small\">\n" +
    "        <qr-scanner on-scan=\"onQrCodeScanned(data)\" />\n" +
    "    </section>\n" +
    "</nav>\n" +
    "\n" +
    "<div class=\"modal-content\">\n" +
    "    <div class=\"header-modal text-center\">\n" +
    "        <div class=\"size-42\">\n" +
    "            {{ asset.metadata.assetName }}\n" +
    "        </div>\n" +
    "        <div class=\"size-18 m5t text-gray\">\n" +
    "            {{ asset.metadata.description }}\n" +
    "        </div>\n" +
    "        <div class=\"size-14 m20t\">\n" +
    "          <span class=\"db text-bold\">\n" +
    "            <span translate>Quantity</span>:\n" +
    "            {{ asset.asset.amount }}\n" +
    "          </span>\n" +
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
    "                        <input type=\"text\" id=\"address\" name=\"address\" ng-disabled=\"home.blockUx || lockAddress\"\n" +
    "                               ng-attr-placeholder=\"{{'Bitcoin address'|translate}}\" ng-model=\"transfer._address\" valid-address\n" +
    "                               required ng-focus=\"home.formFocus('address')\" ng-blur=\"home.formFocus(false)\">\n" +
    "                    </div>\n" +
    "                </div>\n" +
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
    "                                <input type=\"number\" id=\"amount\" ng-disabled=\"home.blockUx || lockAmount\"\n" +
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
    "                             ng-show=\"!home.blockUx && (home.lockAddress || home.lockAmount)\">\n" +
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
