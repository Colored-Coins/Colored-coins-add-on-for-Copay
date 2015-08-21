
var module = angular.module('copayAddon.coloredCoins', ['copayAssetViewTemplates', 'ngFileUpload']);

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
    })
    .run(function (addonManager, coloredCoins, $state) {
      addonManager.registerAddon({
        menuItem: {
          title: 'Assets',
          icon: 'cc-menu-icon',
          link: 'assets',
          open: function() {
            $state.go('assets');
          }
        },
        formatPendingTxp: function(txp) {
          if (txp.metadata && txp.metadata.asset) {
            var value = txp.amountStr;
            var asset = txp.metadata.asset;
            txp.amountStr = asset.amount + " unit" + (asset.amount > 1 ? "s" : "") + " of " + asset.assetName + " (" + value + ")";
            txp.showSingle = true;
            txp.toAddress = txp.outputs[0].toAddress; // txproposal
            txp.address = txp.outputs[0].address;     // txhistory
          }
        },
        processCreateTxOpts: function(txOpts) {
          txOpts.utxosToExclude = (txOpts.utxosToExclude || []).concat(coloredCoins.getColoredUtxos());
        },
        txTemplateUrl: function() {
          return 'colored-coins/views/includes/transaction.html';
        }
      });
    });
'use strict';

angular.module('copayAddon.coloredCoins').config(function ($provide) {

  $provide.decorator('logoDirective', function($delegate) {
    var directive = $delegate[0];
    var ctrl = directive.controller;
    directive.controller = function($scope) {
      ctrl.apply(this, arguments);

      // CC logo should be 1.5 times wider than Copay.
      // if width is not specified, show CC logo full size (220px) and scale down Copay logo to maintain
      // 1.5 ratio between logos
      if ($scope.width) {
        var logo_width = $scope.width * 1.5;
        var logo_height = logo_width / (220 / 43);
        $scope.copay_logo_style = 'width: ' + $scope.width + 'px;';
        $scope.logo_style = "background-size: " + logo_width + "px " + logo_height + "px;" +
            "width: " + logo_width + "px; height: " + logo_height + "px;";
      } else {
        var copay_width = 100 / 1.5 + '%';
        $scope.copay_logo_style = 'width: ' + copay_width + '%; max-width: 147px';
        $scope.logo_style = "background-size: 100% auto; width: 100%; max-width: 220px; height: 43px;";
      }
    };
    directive.template = '' +
        '<div class="cc-logo-holder" ng-class="{ \'negative\' : negative }">' +
        '<img ng-src="{{ logo_url }}" alt="Copay" style="{{ copay_logo_style }}">' +
        '<div class="cc-plus">+</div>' +
        '<div class="cc-logo" style="{{ logo_style }}"></div>' +
        '</div>';
    return $delegate;
  });

});
'use strict';

angular.module('copayAddon.coloredCoins')
    .controller('assetsController', function ($rootScope, $scope, $timeout, $modal, isCordova, coloredCoins) {
      var self = this;

      this.assets = coloredCoins.assets;

      var disableAssetListener = $rootScope.$on('ColoredCoins/AssetsUpdated', function (event, assets) {
        self.assets = assets;
      });

      var disableOngoingProcessListener = $rootScope.$on('Addon/OngoingProcess', function(e, name) {
        self.setOngoingProcess(name);
      });

      $scope.$on('$destroy', function () {
        disableAssetListener();
        disableOngoingProcessListener();
      });

      this.setOngoingProcess = function(name) {
        var self = this;
        self.blockUx = !!name;

        if (isCordova) {
          if (name) {
            window.plugins.spinnerDialog.hide();
            window.plugins.spinnerDialog.show(null, name + '...', true);
          } else {
            window.plugins.spinnerDialog.hide();
          }
        } else {
          self.onGoingProcess = name;
          $timeout(function() {
            $rootScope.$apply();
          });
        }
      };

      // show ongoing process if any
      this.setOngoingProcess(coloredCoins.onGoingProcess);

      var hideModal = function () {
        var m = angular.element(document.getElementsByClassName('reveal-modal'));
        m.addClass('slideOutDown');
      };

      this.openTransferModal = function (asset) {
        $scope.asset = asset;

        var modalInstance = $modal.open({
          templateUrl: 'colored-coins/views/modals/send.html',
          scope: $scope,
          windowClass: 'full animated slideInUp',
          controller: AssetTransferController
        });

        modalInstance.result.finally(hideModal);
      };

      this.openAssetModal = function (asset) {
        var ModalInstanceCtrl = function ($rootScope, $scope, $modalInstance, insight) {
          $scope.asset = asset;
          insight = insight.get();
          insight.getTransaction(asset.issuanceTxid, function (err, tx) {
            if (!err) {
              $scope.issuanceTx = tx;
            }
          });
          $scope.openTransferModal = self.openTransferModal;

          $scope.openBlockExplorer = function (asset) {
            $rootScope.openExternalLink(insight.url + '/tx/' + asset.issuanceTxid)
          };

          $scope.cancel = function () {
            $modalInstance.dismiss('cancel');
          };
        };
        var modalInstance = $modal.open({
          templateUrl: 'colored-coins/views/modals/asset-details.html',
          windowClass: 'full animated slideInUp',
          controller: ModalInstanceCtrl
        });

        modalInstance.result.finally(hideModal);
      };

      this.openIssueModal = function () {

        var modalInstance = $modal.open({
          templateUrl: 'colored-coins/views/modals/issue.html',
          windowClass: 'full animated slideInUp',
          controller: AssetIssueController
        });

        modalInstance.result.finally(hideModal);
      };
    });
'use strict';

var AssetIssueController = function ($rootScope, $scope, $modalInstance, $timeout, $log, coloredCoins, gettext,
                                     profileService, feeService, lodash, bitcore, txStatus, ccConfig, Upload) {

  ProcessingTxController.call(this, $rootScope, $scope, $timeout, $log, coloredCoins, gettext, profileService, feeService,
      lodash, bitcore, txStatus, $modalInstance);

  var self = this;

  $scope.issuance = {
    userData: []
  };


  this.txStatusOpts = {
    templateUrl: 'colored-coins/views/modals/issue-status.html'
  };

  $scope.addField = function() {
    $scope.issuance.userData.push({ name: '', value: ''});
  };

  $scope.removeField = function(field) {
    lodash.pull($scope.issuance.userData, field);
  };

  var createAsset = function(issuance, iconData) {
    self.setOngoingProcess(gettext('Creating issuance transaction'));
    coloredCoins.createIssueTx(issuance, function (err, result) {
      if (err) {
        self._handleError(err);
      }

      var metadata = {
        asset: {
          action: 'issue',
          assetName: issuance.assetName,
          icon: iconData ? iconData.url : null,
          amount: issuance.amount
        }
      };
      self._createAndExecuteProposal(result.txHex, result.issuanceUtxo.address, metadata);
    });
  };

  var createAssetWithIcon = function(issuance, icon) {
    Upload.upload({
      url: ccConfig.uploadHost + '/upload',
      file: icon
    }).success(function (iconData, status, headers, config) {
      if (!iconData.url || iconData.url.indexOf('https://s3') != 0) {
        console.log('Error uploading: ' + status + ' ' + iconData);
        return self._handleError({ error: 'Failed to upload icon'});
      }
      console.log('Icon uploaded. URL: ' + iconData);
      issuance.urls = [
        {
          name: "icon",
          url: iconData.url,
          mimeType: iconData.mimeType
        }];
      createAsset(issuance, iconData);
    }).error(function (data, status, headers, config) {
      console.log('error uploading icon: ' + status + " " + data);
      self._handleError({ error: "Failed to upload icon" });
    })
  };

  $scope.issueAsset = function (form) {
    if (form.$invalid) {
      this.error = gettext('Unable to send transaction proposal');
      return;
    }

    var fc = profileService.focusedClient;
    if (fc.isPrivKeyEncrypted()) {
      profileService.unlockFC(function (err) {
        if (err) return self._setError(err);
        return $scope.issueAsset(form);
      });
      return;
    }

    if (this.file) {
      createAssetWithIcon(this.issuance, this.file);
    } else {
      createAsset(this.issuance);
    }
  };
};

AssetIssueController.prototype = Object.create(ProcessingTxController.prototype);

'use strict';

function ProcessingTxController($rootScope, $scope, $timeout, $log, coloredCoins, gettext, profileService, feeService,
                                lodash, bitcore, txStatus, $modalInstance) {
  this.$rootScope = $rootScope;
  this.profileService = profileService;
  this.$log = $log;
  this.gettext = gettext;
  this.bitcore = bitcore;
  this.coloredCoins = coloredCoins;
  this.feeService = feeService;
  this._ = lodash;
  this.$scope = $scope;
  this.$timeout = $timeout;
  this.txStatus = txStatus;
  this.$modalInstance = $modalInstance;

  this.txStatusOpts = {
    templateUrl: 'colored-coins/views/modals/transfer-status.html'
  };

  var self = this;

  $scope.error = '';

  $scope.resetError = function () {
    self.error = self.success = null;
  };

  $scope.cancel = function () {
    self.$modalInstance.dismiss('cancel');
  };
}

ProcessingTxController.prototype.setOngoingProcess = function (name) {
  this.$rootScope.$emit('Addon/OngoingProcess', name);
};

ProcessingTxController.prototype._setError = function (err) {
  var fc = this.profileService.focusedClient;
  this.$log.warn(err);
  var errMessage = fc.credentials.m > 1
      ? this.gettext('Could not create transaction proposal')
      : this.gettext('Could not perform transaction');

  //This are abnormal situations, but still err message will not be translated
  //(the should) we should switch using err.code and use proper gettext messages
  err.message = err.error ? err.error : err.message;
  errMessage = errMessage + '. ' + (err.message ? err.message : this.gettext('Check you connection and try again'));

  this.$scope.error = errMessage;

};

ProcessingTxController.prototype._handleError = function(err) {
  this.setOngoingProcess();
  this.profileService.lockFC();
  return this._setError(err);
};

ProcessingTxController.prototype._signAndBroadcast = function (txp, cb) {
  var self = this,
  		fc = self.profileService.focusedClient;
  self.setOngoingProcess(self.gettext('Signing transaction'));
  fc.signTxProposal(txp, function (err, signedTx) {
    self.profileService.lockFC();
    self.setOngoingProcess();
    if (err) {
      err.message = self.gettext('Transaction was created but could not be signed. Please try again from home screen.') + (err.message ? ' ' + err.message : '');
      return cb(err);
    }

    if (signedTx.status == 'accepted') {
      self.setOngoingProcess(self.gettext('Broadcasting transaction'));
      fc.broadcastTxProposal(signedTx, function (err, btx, memo) {
        self.setOngoingProcess();
        if (err) {
          err.message = self.gettext('Transaction was signed but could not be broadcasted. Please try again from home screen.') + (err.message ? ' ' + err.message : '');
          return cb(err);
        }

        return cb(null, btx);
      });
    } else {
      self.setOngoingProcess();
      return cb(null, signedTx);
    }
  });
};

ProcessingTxController.prototype._createAndExecuteProposal = function (txHex, toAddress, metadata) {
  var self = this;
  var fc = self.profileService.focusedClient;
  var tx = new self.bitcore.Transaction(txHex);
  self.$log.debug(JSON.stringify(tx.toObject(), null, 2));

  var inputs = self._.map(tx.inputs, function (input) {
    input = input.toObject();
    input = self.coloredCoins.txidToUTXO[input.prevTxId + ":" + input.outputIndex];
    input.outputIndex = input.vout;
    return input;
  });

  // drop change output provided by CC API. We want change output to be added by BWS in according with wallet's
  // fee settings
  var outputs = self._.chain(tx.outputs)
      .map(function (o) {
        return { script: o.script.toString(), amount: o.satoshis };
      })
      .dropRight()
      .value();

  // for Copay to show recipient properly
  outputs[0].toAddress = toAddress;

  self.setOngoingProcess(self.gettext('Creating tx proposal'));
  self.feeService.getCurrentFeeValue(null, function (err, feePerKb) {
    if (err) self.$log.debug(err);
    fc.sendTxProposal({
      type: 'external',
      inputs: inputs,
      outputs: outputs,
      noOutputsShuffle: true,
      message: '',
      payProUrl: null,
      feePerKb: feePerKb,
      metadata: metadata
    }, function (err, txp) {
      if (err) {
        return self._handleError(err);
      }

      self._signAndBroadcast(txp, function (err, tx) {
        self.setOngoingProcess();
        self.profileService.lockFC();
        if (err) {
          self.error = err.message ? err.message : self.gettext('Transaction proposal was created but could not be completed. Please try again from home screen');
          self.$scope.$emit('Local/TxProposalAction');
          self.$timeout(function() {
            self.$scope.$digest();
          }, 1);
        } else {
          self.txStatus.notify(tx, self.txStatusOpts, function () {
            self.$scope.$emit('Local/TxProposalAction', true);
          });
        }
        self.$scope.cancel();
      });
    });
  });
};

'use strict';

var AssetTransferController = function ($rootScope, $scope, $modalInstance, $timeout, $log, coloredCoins, gettext,
                                        profileService, feeService, lodash, bitcore, txStatus) {

  ProcessingTxController.call(this, $rootScope, $scope, $timeout, $log, coloredCoins, gettext, profileService, feeService,
      lodash, bitcore, txStatus, $modalInstance);

  var self = this;

  $scope.onQrCodeScanned = function (data) {
    this.error = '';
    var form = this.assetTransferForm;
    if (data) {
      form.address.$setViewValue(new bitcore.URI(data).address.toString());
      form.address.$isValid = true;
      form.address.$render();
      $scope.lockAddress = true;
    }

    if (form.address.$invalid) {
      $scope.resetError();
      $scope.lockAddress = false;
      $scope._address = null;
      this.error = gettext('Could not recognize a valid Bitcoin QR Code');
    }
  };

  $scope.transferAsset = function (transfer, form) {
    if ($scope.asset.locked) {
      self._setError({ message: "Cannot transfer locked asset" });
      return;
    }
    $log.debug("Transfering " + transfer._amount + " units(s) of asset " + $scope.asset.asset.assetId + " to " + transfer._address);

    if (form.$invalid) {
      this.error = gettext('Unable to send transaction proposal');
      return;
    }

    var fc = profileService.focusedClient;
    if (fc.isPrivKeyEncrypted()) {
      profileService.unlockFC(function (err) {
        if (err) return self._setError(err);
        return $scope.transferAsset(transfer, form);
      });
      return;
    }

    self.setOngoingProcess(gettext('Creating transfer transaction'));
    coloredCoins.createTransferTx($scope.asset, transfer._amount, transfer._address, function (err, result) {
      if (err) {
        self._handleError(err);
      }

      var metadata = {
        asset: {
          action: 'transfer',
          assetId: $scope.asset.asset.assetId,
          assetName: $scope.asset.metadata.assetName,
          icon: $scope.asset.icon,
          utxo: lodash.pick($scope.asset.utxo, ['txid', 'index']),
          amount: transfer._amount
        }
      };
      self._createAndExecuteProposal(result.txHex, transfer._address, metadata);
    });
  };
};

AssetTransferController.prototype = Object.create(ProcessingTxController.prototype);

'use strict';


angular.module('copayAddon.coloredCoins')
    .service('ccFeeService', function (profileService, feeService, $log) {
      var root = {};

      // from BWS TxProposal.prototype.getEstimatedSize
      var _getEstimatedSize = function(nbInputs, nbOutputs) {
        var credentials = profileService.focusedClient.credentials;
        // Note: found empirically based on all multisig P2SH inputs and within m & n allowed limits.
        var safetyMargin = 0.05;
        var walletM = credentials.m;

        var overhead = 4 + 4 + 9 + 9;
        var inputSize = walletM * 72 + credentials.n * 36 + 44;
        var outputSize = 34;
        nbOutputs = nbOutputs + 1;

        var size = overhead + inputSize * nbInputs + outputSize * nbOutputs;

        return parseInt((size * (1 + safetyMargin)).toFixed(0));
      };

      root.estimateFee = function(nbInputs, nbOutputs, cb) {
        feeService.getCurrentFeeValue(null, function(err, feePerKb) {
          if (err) $log.debug(err);

          var size = _getEstimatedSize(nbInputs, nbOutputs);
          $log.debug("Estimated size: " + size);
          var fee = feePerKb * size / 1000;

          // Round up to nearest bit
          var result = parseInt((Math.ceil(fee / 100) * 100).toFixed(0));
          $log.debug("Estimated fee: " + result);
          return cb(null, result);
        });
      };

      return root;
    });

'use strict';

function ColoredCoins($rootScope, profileService, ccConfig, ccFeeService, bitcore, $http, $log, lodash) {
  var SATOSHIS_FOR_ISSUANCE_COLORING = 1300;
  var SATOSHIS_FOR_TRANSFER_COLORING = 600;

  var root = {},
      lockedUtxos = [],
      self = this;

  // UTXOs "cache"
  root.txidToUTXO = {};
  root.assets = null;

  var disableFocusListener = $rootScope.$on('Local/NewFocusedWallet', function() {
    root.assets = null;
  });

  var _setOngoingProcess = function(name) {
    $rootScope.$emit('Addon/OngoingProcess', name);
    root.onGoingProcess = name;
  };

  var disableBalanceListener = $rootScope.$on('Local/BalanceUpdated', function (event, balance) {
    root.assets = null;
    var addresses = lodash.pluck(balance.byAddress, 'address');

    _setOngoingProcess('Getting assets');
    _fetchAssets(addresses, function (err, assets) {
      if (err) {
        $log.error(err.error || err.message);
      } else {
        root.assets = assets;
        $rootScope.$emit('ColoredCoins/AssetsUpdated', assets);
      }
      _setOngoingProcess();
    });
  });

  $rootScope.$on('$destroy', function() {
    disableBalanceListener();
    disableFocusListener();
  });

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
    $http.get(ccConfig.api[network] + '/v2/' + api_endpoint + '/' + param)
        .success(function (data, status) {
          return handleResponse(data, status, cb);
        })
        .error(function(data, status) {
          return handleResponse(data, status, cb);
        });
  };

  var postTo = function(api_endpoint, json_data, network, cb) {
    $log.debug('Post to:' + api_endpoint + ". Data: " + JSON.stringify(json_data));
    $http.post(ccConfig.api[network] + '/v2/' + api_endpoint, json_data)
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

  var selectFinanceOutput = function(financeAmount, fc, cb) {
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

  root.getColoredUtxos = function() {
    return lodash.map(root.assets, function(asset) { return asset.utxo.txid + ":" + asset.utxo.index; });
  };

  var _fetchAssets = function(addresses, cb) {
    var assets = [];
    if (addresses.length == 0) {
      return cb(null, assets);
    }
    _updateLockedUtxos(function(err) {
      if (err) { return cb(err); }

      var checkedAddresses = 0;
      lodash.each(addresses, function (address) {
        _getAssetsForAddress(address, function (err, addressAssets) {
          if (err) { return cb(err); }

          assets = assets.concat(addressAssets);

          if (++checkedAddresses == addresses.length) {
            return cb(null, assets);
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
          if (err) { return cb(err); }
          var isLocked = lodash.includes(self.lockedUtxos, asset.utxo.txid + ":" + asset.utxo.index);
          var a = {
            assetId: asset.assetId,
            utxo: asset.utxo,
            address: address,
            asset: asset,
            network: network,
            divisible: metadata.divisibility,
            reissuable: metadata.lockStatus == false,
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

  root.createTransferTx = function(asset, amount, toAddress, cb) {
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

    var nInputs = 2; // asset address + finance utxo
    var nOutputs = to.length == 2 ? 3 : 2; // outputs for transfer coloring scheme

    ccFeeService.estimateFee(nInputs, nOutputs, function(err, fee) {
      // We need extra satoshis if we have change transfer
      var financeAmount = fee + SATOSHIS_FOR_TRANSFER_COLORING * (to.length - 1);
      $log.debug("Funds required for transfer: " + financeAmount);

      selectFinanceOutput(financeAmount, fc, function(err, financeUtxo) {
        if (err) { return cb(err); }

        var transfer = {
          from: asset.address,
          fee: fee,
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
    });
  };

  root.createIssueTx = function(issuance, cb) {

    var nInputs = 1; // issuing address
    var nOutputs = 3; // outputs for issuance coloring scheme

    ccFeeService.estimateFee(nInputs, nOutputs, function(err, fee) {
      var fc = profileService.focusedClient;
      var financeAmount = fee + SATOSHIS_FOR_ISSUANCE_COLORING;
      $log.debug("Funds required for issuance: " + financeAmount);

      selectFinanceOutput(financeAmount, fc, function(err, financeUtxo) {
        if (err) { return cb(err); }

        var metadata = lodash.pick(issuance, ['assetName', 'description', 'issuer', 'urls', 'userData']);
        // convert { name: 'Color', value: 'Blue' } to { "Color" : "Blue" }
        metadata.userData = lodash.reduce(metadata.userData, function(result, field) {
          if (field.name != '' && field.value != '') {
            result[field.name] = field.value;
          }
          return result;
        }, {});

        var issuanceOpts = {
          issueAddress: financeUtxo.address,
          fee: fee,
          divisibility: 0,
          amount: issuance.amount,
          reissueable: false,
          transfer: [{
            'address': financeUtxo.address,
            'amount': issuance.amount
          }],
          metadata: metadata
        };

        console.log(JSON.stringify(issuanceOpts, null, 2));
        var network = fc.credentials.network;
        postTo('issue', issuanceOpts, network, function (err, data) {
          if (data) {
            data.issuanceUtxo = financeUtxo;
          }
          return cb(err, data);
        });
      });
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

angular.module('copayAssetViewTemplates', ['colored-coins/views/assets.html', 'colored-coins/views/includes/asset-status.html', 'colored-coins/views/includes/topbar.html', 'colored-coins/views/includes/transaction.html', 'colored-coins/views/landing.html', 'colored-coins/views/modals/asset-details.html', 'colored-coins/views/modals/issue-status.html', 'colored-coins/views/modals/issue.html', 'colored-coins/views/modals/send.html', 'colored-coins/views/modals/transfer-status.html']);

angular.module("colored-coins/views/assets.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/assets.html",
    "<div class=\"oh\" ng-controller=\"assetsController as assets\">\n" +
    "    <div class=\"onGoingProcess\" ng-show=\"index.isOffline\">\n" +
    "        <div class=\"onGoingProcess-content\" ng-style=\"{'background-color':'#222'}\">\n" +
    "            <div class=\"spinner\">\n" +
    "                <div class=\"rect1\"></div>\n" +
    "                <div class=\"rect2\"></div>\n" +
    "                <div class=\"rect3\"></div>\n" +
    "                <div class=\"rect4\"></div>\n" +
    "                <div class=\"rect5\"></div>\n" +
    "            </div>\n" +
    "            <span translate>Reconnecting to Wallet Service...</span>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "\n" +
    "    <div class=\"onGoingProcess\" ng-show=\"index.anyOnGoingProcess && !index.isOffline\">\n" +
    "        <div class=\"onGoingProcess-content\" ng-style=\"{'background-color':index.backgroundColor}\">\n" +
    "            <div class=\"spinner\">\n" +
    "                <div class=\"rect1\"></div>\n" +
    "                <div class=\"rect2\"></div>\n" +
    "                <div class=\"rect3\"></div>\n" +
    "                <div class=\"rect4\"></div>\n" +
    "                <div class=\"rect5\"></div>\n" +
    "            </div>\n" +
    "      <span translate ng-show=\"\n" +
    "        index.onGoingProcessName == 'openingWallet'\n" +
    "        || index.onGoingProcessName == 'updatingStatus'\n" +
    "        || index.onGoingProcessName == 'updatingBalance'\n" +
    "        || index.onGoingProcessName == 'updatingPendingTxps'\n" +
    "        \"> Updating Wallet... </span>\n" +
    "            <span translate ng-show=\"index.onGoingProcessName == 'scanning'\">Scanning Wallet funds...</span>\n" +
    "            <span translate ng-show=\"index.onGoingProcessName == 'recreating'\">Recreating Wallet...</span>\n" +
    "            <span translate ng-show=\"index.onGoingProcessName == 'generatingCSV'\">Generating .csv file...</span>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "\n" +
    "    <div class=\"onGoingProcess\" ng-show=\"assets.onGoingProcess && !index.anyOnGoingProces && !index.isOffline\">\n" +
    "        <div class=\"onGoingProcess-content\" ng-style=\"{'background-color':index.backgroundColor}\">\n" +
    "            <div class=\"spinner\">\n" +
    "                <div class=\"rect1\"></div>\n" +
    "                <div class=\"rect2\"></div>\n" +
    "                <div class=\"rect3\"></div>\n" +
    "                <div class=\"rect4\"></div>\n" +
    "                <div class=\"rect5\"></div>\n" +
    "            </div>\n" +
    "            {{assets.onGoingProcess|translate}}...\n" +
    "        </div>\n" +
    "    </div>\n" +
    "\n" +
    "    <div class=\"topbar-container\" ng-include=\"'colored-coins/views/includes/topbar.html'\"></div>\n" +
    "    <div class=\"cc-assets-list\" ng-show=\"assets.assets\">\n" +
    "        <div ng-repeat=\"asset in assets.assets | orderBy:['assetName', 'utxo.txid']\" ng-click=\"assets.openAssetModal(asset)\"\n" +
    "             class=\"row collapse cc-assets-list-item\">\n" +
    "            <div class=\"small-1 columns text-center\">\n" +
    "                <img ng-src=\"{{ asset.icon }}\" class=\"asset-icon icon\" ng-show=\"asset.icon\"/>\n" +
    "                <img class=\"asset-icon icon cc-default-icon\" ng-hide=\"asset.icon\"/>\n" +
    "                &nbsp;\n" +
    "            </div>\n" +
    "            <div class=\"small-4 columns\">\n" +
    "                <div ng-if=\"!$root.updatingBalance\">\n" +
    "                    <span class=\"text-bold size-16\">{{ asset.metadata.assetName }}</span>\n" +
    "                </div>\n" +
    "                <div class=\"ellipsis text-gray size-14\">\n" +
    "                    {{ asset.metadata.description }}\n" +
    "                </div>\n" +
    "            </div>\n" +
    "            <div class=\"small-2 columns\">\n" +
    "              <span class=\"size-16\">\n" +
    "                {{ asset.asset.amount }} unit{{ asset.asset.amount != 1 ? 's' : '' }}\n" +
    "                <i class=\"fi-lock\" ng-show=\"asset.locked\"></i>\n" +
    "              </span>\n" +
    "            </div>\n" +
    "            <div class=\"small-4 columns\">\n" +
    "                <span class=\"size-14\"><span translate>Issued by</span>: {{ asset.metadata.issuer }}</span>\n" +
    "            </div>\n" +
    "            <div class=\"small-1 columns text-right\">\n" +
    "                <i class=\"icon-arrow-right3 size-18\"></i>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"cc-no-assets\" ng-show=\"assets.assets && assets.assets.length == 0\">\n" +
    "        <h3>You don't have any assets.</h3>\n" +
    "        <div>Click <a ng-click=\"assets.openIssueModal()\">here</a> to issue you first!</div>\n" +
    "        <span class=\"nb\">(This requires some Bitcoins for the miner fee)</span>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<div class=\"extra-margin-bottom\"></div>\n" +
    "<div ng-include=\"'views/includes/menu.html'\" ng-show=\"!index.noFocusedWallet\"></div>\n" +
    "");
}]);

angular.module("colored-coins/views/includes/asset-status.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/includes/asset-status.html",
    "<div ng-if=\"type == 'broadcasted'\" class=\"popup-txsent\">\n" +
    "    <i class=\"small-centered columns fi-check m20tp\"></i>\n" +
    "    <div class=\"text-center size-18 text-white text-bold tu p20\">\n" +
    "        <span translate>{{ status.broadcasted }}</span>\n" +
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
    "        <span translate>{{ status.created }}</span>\n" +
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
    "        <span translate>{{ status.accepted }}</span>\n" +
    "    </div>\n" +
    "    <div class=\"text-center\">\n" +
    "        <a class=\"button outline round light-gray tiny small-4\" ng-click=\"cancel()\" translate>OKAY</a>\n" +
    "    </div>\n" +
    "</div>\n" +
    "\n" +
    "<div ng-if=\"type=='rejected'\" class=\"popup-txrejected\">\n" +
    "    <i class=\"fi-x small-centered columns m20tp\"></i>\n" +
    "    <div class=\"text-center size-18 tu text-warning text-bold p20\">\n" +
    "        <span translate>{{ status.rejected }}</span>\n" +
    "    </div>\n" +
    "    <div class=\"text-center\">\n" +
    "        <a class=\"button outline light-gray round tiny small-4\" ng-click=\"cancel()\" translate>OKAY</a>\n" +
    "    </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("colored-coins/views/includes/topbar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/includes/topbar.html",
    "<nav class=\"tab-bar\">\n" +
    "    <section class=\"left-small\">\n" +
    "        <a id=\"hamburger\" class=\"p10\" ng-show=\"!goBackToState && !closeToHome  && !index.noFocusedWallet\"\n" +
    "           ng-click=\"index.openMenu()\"><i class=\"fi-list size-24\"></i>\n" +
    "        </a>\n" +
    "    </section>\n" +
    "\n" +
    "    <section class=\"right-small\">\n" +
    "        <a class=\"p10\" ng-click=\"assets.openIssueModal()\">\n" +
    "            <i class=\"icon-plus-circle size-24\"></i>\n" +
    "        </a>\n" +
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

angular.module("colored-coins/views/includes/transaction.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/includes/transaction.html",
    "<div class=\"ng-animate-disabled row collapse last-transactions-content line-b\"\n" +
    "     ng-class=\"{'text-gray':!tx.pendingForUs}\"\n" +
    "     ng-click=\"home.openTxpModal(tx, index.copayers)\"\n" +
    "     ng-init=\"isIssuance = tx.metadata.asset.action == 'issue'\">\n" +
    "    <div class=\"small-1 columns text-center\" >\n" +
    "        <i class=\"icon-circle-active size-10\" ng-show=\"tx.pendingForUs\" ng-style=\"{'color':index.backgroundColor}\" style=\"margin-top:8px;\"></i>\n" +
    "        &nbsp;\n" +
    "    </div>\n" +
    "    <div class=\"small-10 columns\">\n" +
    "        <div ng-if=\"!$root.updatingBalance\">\n" +
    "            <span class=\"text-bold size-16\">\n" +
    "                <span ng-show=\"isIssuance\" translate>Issue</span>\n" +
    "                <span ng-hide=\"isIssuance\" translate>Send</span>\n" +
    "                {{tx.amountStr}}\n" +
    "            </span>\n" +
    "            <time class=\"right size-12 text-gray m5t\">{{ (tx.ts || tx.createdOn ) * 1000 | amTimeAgo}}</time>\n" +
    "        </div>\n" +
    "        <div class=\"ellipsis size-14\">\n" +
    "        <span ng-if=\"!tx.showSingle && !isIssuance\">\n" +
    "          <span translate>Recipients</span>:\n" +
    "          <span>{{tx.outputs.length}}</span>\n" +
    "        </span>\n" +
    "        <span ng-if=\"tx.showSingle && !isIssuance\">\n" +
    "          <span translate>To</span>:\n" +
    "          <span ng-if=\"tx.merchant\">\n" +
    "            <span ng-show=\"tx.merchant.pr.ca\"><i class=\"fi-lock\"></i> {{tx.merchant.domain}}</span>\n" +
    "            <span ng-show=\"!tx.merchant.pr.ca\"><i class=\"fi-unlock\"></i> {{tx.merchant.domain}}</span>\n" +
    "          </span>\n" +
    "          <contact address=\"{{tx.toAddress}}\" ng-hide=\"tx.merchant\"> </contact>\n" +
    "          {{tx.toAddress}}\n" +
    "        </span>\n" +
    "        </div>\n" +
    "        <div class=\"ellipsis text-gray size-14\">\n" +
    "            {{tx.message}}\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"small-1 columns text-right\">\n" +
    "        <br>\n" +
    "        <i class=\"icon-arrow-right3 size-18\"></i>\n" +
    "    </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("colored-coins/views/landing.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/landing.html",
    "<div class=\"text-center cc-landing\" ng-if=\"!index.hasProfile\">\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"medium-6 large-4 medium-centered small-centered large-centered columns m20t\">\n" +
    "            <logo negative=\"true\"></logo>\n" +
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
    "        <div class=\"enable_text_select text-light text-left size-14 text-black cc-disclaimer\">\n" +
    "            <p>The Copay Colored Coins wallet is meant for testing purposes and provided AS-IS.</p>\n" +
    "\n" +
    "            <p>USE AT YOUR OWN RISK.</p>\n" +
    "\n" +
    "            <p><b>No Warranty:</b> Colored Coins does not warrant for Software and supplies it on an “as-is” and “as-available” basis. Your Use of Software is at your own risk and under your liability. Colored Coins makes no warranty that (i) the Software will meet your requirements, including providing you with any relevant information or reaching a relevant audience and (ii) the Software will be uninterrupted, timely, secure, or error-free and (iii) the results that may be obtained from the Use of the Software will be accurate or reliable and (iv) the quality of any products, services, information, or other material purchased or obtained by You through Software will meet your expectations, or (v) any errors in the Software will be corrected.</p>\n" +
    "\n" +
    "            <p><b>Liability:</b> For no case and for no reason shall Colored Coins be held liable for any damage, direct or indirect, consequential, exemplary, physical or special, to You, any User or any 3rd party due to its misperformance of duties herein. Colored Coins provides the Software on an AS-IS basis and shall not be held liable, to the extent permitted by law, by any case of misconduct, negligence, gross negligence, malice or any other mean, to any damages or loss of property, including damages to: virtual property, reputation and business reputation, user account information including login information, loss of profit, loss of good name, all resulting from the use or inability to use Software rendered by Colored Coins.</p>\n" +
    "        </div>\n" +
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
    "        <div class=\"cc-asset-icon\">\n" +
    "            <img ng-src=\"{{ asset.icon }}\" ng-show=\"asset.icon\"/>\n" +
    "            <div class=\"cc-default-icon\" ng-show=\"!asset.icon\"></div>\n" +
    "        </div>\n" +
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
    "            <li class=\"line-b p10 oh\">\n" +
    "                <span class=\"text-gray property-name\" translate>Reissuable</span>:\n" +
    "                <span class=\"right\">\n" +
    "                    <boolean-icon value=\"asset.reissuable\"/>\n" +
    "                </span>\n" +
    "            </li>\n" +
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
    "                    <span ng-show=\"issuanceTx.time\">{{ issuanceTx.time * 1000 | date:'dd MMM yyyy hh:mm'}}</span>\n" +
    "                    <span class=\"text-warning\" ng-show=\"!issuanceTx.time\">Unconfirmed</span>\n" +
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

angular.module("colored-coins/views/modals/issue-status.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/modals/issue-status.html",
    "{{ status = {\n" +
    "    created: 'Asset Issuance Proposal Created',\n" +
    "    broadcasted: 'Asset Issued',\n" +
    "    accepted: 'Asset Issuance Accepted',\n" +
    "    rejected: 'Asset Issuance Rejected'\n" +
    "   };\"\" }}\n" +
    "<div ng-include=\"'colored-coins/views/includes/asset-status.html'\"></div>");
}]);

angular.module("colored-coins/views/modals/issue.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/modals/issue.html",
    "<nav class=\"tab-bar\">\n" +
    "    <section class=\"left-small\">\n" +
    "        <a ng-click=\"cancel()\">\n" +
    "            <i class=\"icon-arrow-left3 icon-back\"></i>\n" +
    "            <span class=\"text-back\" translate>Back</span>\n" +
    "        </a>\n" +
    "    </section>\n" +
    "    <section class=\"middle tab-bar-section\">\n" +
    "        <h1 class=\"title ellipsis\" ng-style=\"{'color':color}\" translate>\n" +
    "            Issue new asset\n" +
    "        </h1>\n" +
    "    </section>\n" +
    "\n" +
    "    <section class=\"right-small\">\n" +
    "    </section>\n" +
    "</nav>\n" +
    "\n" +
    "<div class=\"modal-content\">\n" +
    "    <div class=\"row m20t\">\n" +
    "        <div class=\"large-12 large-centered columns\">\n" +
    "            <form name=\"assetIssueForm\" ng-submit=\"issueAsset(assetIssueForm)\" ng-disabled=\"home.blockUx || home.onGoingProcess\" novalidate>\n" +
    "                <div class=\"box-notification\" ng-show=\"error\" ng-click=\"resetError()\">\n" +
    "                  <span class=\"text-warning\">\n" +
    "                    {{ error|translate }}\n" +
    "                  </span>\n" +
    "                    <a class=\"close-notification text-warning\">&#215;</a>\n" +
    "                </div>\n" +
    "\n" +
    "                <div class=\"text-center m10b\">\n" +
    "                    <div class=\"cc-icon-dropbox cc-asset-icon\" ngf-drop ngf-select ngf-accept=\"'image/*'\" ng-model=\"file\"\n" +
    "                         ngf-drag-over-class=\"dragover\" ngf-multiple=\"false\" ngf-allow-dir=\"false\">\n" +
    "                        <img ngf-src=\"file\" ng-show=\"file\">\n" +
    "                        <span ng-hide=\"file\">Add icon</span>\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "\n" +
    "                <div>\n" +
    "                    <div class=\"row collapse\">\n" +
    "                        <label for=\"assetName\" class=\"left\">\n" +
    "                            <span translate>Name</span>\n" +
    "                        </label>\n" +
    "                    </div>\n" +
    "                    <div class=\"input\">\n" +
    "                        <input type=\"text\" id=\"assetName\" name=\"assetName\" ng-disabled=\"home.blockUx\"\n" +
    "                               ng-attr-placeholder=\"{{'Asset Name' | translate}}\" ng-model=\"issuance.assetName\"\n" +
    "                               required ng-focus=\"home.formFocus('assetName')\" ng-blur=\"home.formFocus(false)\">\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div>\n" +
    "                    <div class=\"row collapse\">\n" +
    "                        <label for=\"issuer\" class=\"left\">\n" +
    "                            <span translate>Issuer</span>\n" +
    "                        </label>\n" +
    "                    </div>\n" +
    "                    <div class=\"input\">\n" +
    "                        <input type=\"text\" id=\"issuer\" name=\"issuer\" ng-disabled=\"home.blockUx\"\n" +
    "                               ng-attr-placeholder=\"{{'Issuer' | translate}}\" ng-model=\"issuance.issuer\"\n" +
    "                               required ng-focus=\"home.formFocus('issuer')\" ng-blur=\"home.formFocus(false)\">\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div class=\"row\">\n" +
    "                    <div class=\"large-12 medium-12 columns\">\n" +
    "                        <div class=\"right\" ng-hide=\"assetIssueForm.amount.$pristine && !assetIssueForm.amount.$modelValue \">\n" +
    "                            <span class=\"has-error right size-12\" ng-show=\"assetIssueForm.amount.$invalid\">\n" +
    "                                <i class=\"icon-close-circle size-14\"></i>\n" +
    "                                <span clas=\"vm\" translate>Not valid</span>\n" +
    "                            </span>\n" +
    "                            <small class=\"text-primary right\" ng-show=\"!assetIssueForm.amount.$invalid\">\n" +
    "                                <i class=\"icon-checkmark-circle size-14\"></i>\n" +
    "                            </small>\n" +
    "                        </div>\n" +
    "                        <div>\n" +
    "                            <label for=\"amount\">\n" +
    "                                <span translate>Quantity</span>\n" +
    "                            </label>\n" +
    "\n" +
    "                            <div class=\"input\">\n" +
    "                                <input type=\"number\" id=\"amount\" ng-disabled=\"home.blockUx || home.lockAmount\" name=\"amount\"\n" +
    "                                       ng-attr-placeholder=\"{{'Quantity'|translate}}\"\n" +
    "                                       min=\"1\" ng-pattern=\"/^\\d*$/\"\n" +
    "                                       ng-model=\"issuance.amount\" required autocomplete=\"off\"\n" +
    "                                       ng-focus=\"home.formFocus('amount')\" ng-blur=\"home.formFocus(false)\">\n" +
    "                                <a class=\"postfix\" translate>units</a>\n" +
    "                            </div>\n" +
    "                        </div>\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div>\n" +
    "                    <div class=\"row collapse\">\n" +
    "                        <label for=\"description\" class=\"left\">\n" +
    "                            <span translate>Description</span>\n" +
    "                        </label>\n" +
    "                    </div>\n" +
    "                    <div class=\"input\">\n" +
    "                        <input type=\"text\" id=\"description\" name=\"description\" ng-disabled=\"home.blockUx\"\n" +
    "                               ng-attr-placeholder=\"{{'Description' | translate}}\" ng-model=\"issuance.description\"\n" +
    "                               ng-focus=\"home.formFocus('description')\" ng-blur=\"home.formFocus(false)\">\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "\n" +
    "                <h4 class=\"title\" translate>Metadata</h4>\n" +
    "                <div>\n" +
    "                    <div class=\"row\" ng-repeat=\"field in issuance.userData\">\n" +
    "                        <div class=\"small-6 columns\">\n" +
    "                            <input type=\"text\" ng-disabled=\"assets.blockUx\"\n" +
    "                                   ng-attr-placeholder=\"{{'Name' | translate}}\" ng-model=\"field.name\">\n" +
    "                        </div>\n" +
    "                        <div class=\"small-6 columns\">\n" +
    "                            <input type=\"text\" id=\"description\" name=\"description\" ng-disabled=\"assets.blockUx\"\n" +
    "                                   ng-attr-placeholder=\"{{'Value' | translate}}\" ng-model=\"field.value\">\n" +
    "                            <a class=\"postfix size-12 m0 text-gray\" ng-click=\"removeField(field)\">\n" +
    "                                <i class=\"fi-minus-circle size-18\"></i>\n" +
    "                            </a>\n" +
    "                        </div>\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div class=\"text-center\">\n" +
    "                    <a ng-click=\"addField()\" class=\"button outline round light-gray tiny cc-add-field-button\">\n" +
    "                        <i class=\"fi-plus size-18 vm\"></i>\n" +
    "                        <span translate>Add field</span>\n" +
    "                    </a>\n" +
    "                </div>\n" +
    "\n" +
    "                <div class=\"row\" ng-show=\"!home.onGoingProcess\">\n" +
    "                    <div class=\"columns\"\n" +
    "                         ng-class=\"{'small-6 medium-6 large-6':(home.lockAddress || home.lockAmount)}\">\n" +
    "                        <button type=\"submit\" class=\"button black round expand\"\n" +
    "                                ng-disabled=\"assetIssueForm.$invalid || home.blockUx ||  index.isOffline\"\n" +
    "                                ng-style=\"{'background-color':index.backgroundColor}\" translate>\n" +
    "                            Issue\n" +
    "                        </button>\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "            </form>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"extra-margin-bottom\"></div>\n" +
    "</div> <!-- END Send -->");
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
    "                            <span class=\"has-error right size-12\" ng-show=\"assetTransferForm.amount.$invalid\">\n" +
    "                                <i class=\"icon-close-circle size-14\"></i>\n" +
    "                                <span clas=\"vm\" translate>Not valid</span>\n" +
    "                            </span>\n" +
    "                            <small class=\"text-primary right\" ng-show=\"!assetTransferForm.amount.$invalid\">\n" +
    "                                <i class=\"icon-checkmark-circle size-14\"></i>\n" +
    "                            </small>\n" +
    "                        </div>\n" +
    "                        <div>\n" +
    "                            <label for=\"amount\">\n" +
    "                                <span translate>Amount</span>\n" +
    "                            </label>\n" +
    "\n" +
    "                            <div class=\"input\">\n" +
    "                                <input type=\"number\" id=\"amount\" ng-disabled=\"home.blockUx || home.lockAmount\" name=\"amount\"\n" +
    "                                       ng-attr-placeholder=\"{{'Amount'|translate}}\"\n" +
    "                                       ng-model=\"transfer._amount\" min=\"1\" max=\"{{ asset.asset.amount }}\" ng-pattern=\"/^\\d*$/\" required autocomplete=\"off\"\n" +
    "                                       ng-focus=\"home.formFocus('amount')\" ng-blur=\"home.formFocus(false)\">\n" +
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

angular.module("colored-coins/views/modals/transfer-status.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("colored-coins/views/modals/transfer-status.html",
    "{{ status = {\n" +
    "    created: 'Asset Transfer Proposal Created',\n" +
    "    broadcasted: 'Asset Transferred',\n" +
    "    accepted: 'Asset Transfer Accepted',\n" +
    "    rejected: 'Asset Transfer Rejected'\n" +
    "   };\"\" }}\n" +
    "<div ng-include=\"'colored-coins/views/includes/asset-status.html'\"></div>");
}]);

/**!
 * AngularJS file upload/drop directive and service with progress and abort
 * @author  Danial  <danial.farid@gmail.com>
 * @version 6.1.1
 */

if (window.XMLHttpRequest && !(window.FileAPI && FileAPI.shouldLoad)) {
  window.XMLHttpRequest.prototype.setRequestHeader = (function (orig) {
    return function (header, value) {
      if (header === '__setXHR_') {
        var val = value(this);
        // fix for angular < 1.2.0
        if (val instanceof Function) {
          val(this);
        }
      } else {
        orig.apply(this, arguments);
      }
    };
  })(window.XMLHttpRequest.prototype.setRequestHeader);
}

var ngFileUpload = angular.module('ngFileUpload', []);

ngFileUpload.version = '6.1.1';
ngFileUpload.defaults = {};

ngFileUpload.service('Upload', ['$http', '$q', '$timeout', function ($http, $q, $timeout) {
  function sendHttp(config) {
    config.method = config.method || 'POST';
    config.headers = config.headers || {};

    var deferred = $q.defer();
    var promise = deferred.promise;

    config.headers.__setXHR_ = function () {
      return function (xhr) {
        if (!xhr) return;
        config.__XHR = xhr;
        if (config.xhrFn) config.xhrFn(xhr);
        xhr.upload.addEventListener('progress', function (e) {
          e.config = config;
          if (deferred.notify) {
            deferred.notify(e);
          } else if (promise.progressFunc) {
            $timeout(function () {
              promise.progressFunc(e);
            });
          }
        }, false);
        //fix for firefox not firing upload progress end, also IE8-9
        xhr.upload.addEventListener('load', function (e) {
          if (e.lengthComputable) {
            e.config = config;
            if (deferred.notify) {
              deferred.notify(e);
            } else if (promise.progressFunc) {
              $timeout(function () {
                promise.progressFunc(e);
              });
            }
          }
        }, false);
      };
    };

    $http(config).then(function (r) {
      deferred.resolve(r);
    }, function (e) {
      deferred.reject(e);
    }, function (n) {
      deferred.notify(n);
    });

    promise.success = function (fn) {
      promise.then(function (response) {
        fn(response.data, response.status, response.headers, config);
      });
      return promise;
    };

    promise.error = function (fn) {
      promise.then(null, function (response) {
        fn(response.data, response.status, response.headers, config);
      });
      return promise;
    };

    promise.progress = function (fn) {
      promise.progressFunc = fn;
      promise.then(null, null, function (update) {
        fn(update);
      });
      return promise;
    };
    promise.abort = function () {
      if (config.__XHR) {
        $timeout(function () {
          config.__XHR.abort();
        });
      }
      return promise;
    };
    promise.xhr = function (fn) {
      config.xhrFn = (function (origXhrFn) {
        return function () {
          if (origXhrFn) origXhrFn.apply(promise, arguments);
          fn.apply(promise, arguments);
        };
      })(config.xhrFn);
      return promise;
    };

    return promise;
  }

  this.upload = function (config) {
    function addFieldToFormData(formData, val, key) {
      if (val !== undefined) {
        if (angular.isDate(val)) {
          val = val.toISOString();
        }
        if (angular.isString(val)) {
          formData.append(key, val);
        } else if (config.sendFieldsAs === 'form') {
          if (angular.isObject(val)) {
            for (var k in val) {
              if (val.hasOwnProperty(k)) {
                addFieldToFormData(formData, val[k], key + '[' + k + ']');
              }
            }
          } else {
            formData.append(key, val);
          }
        } else {
          val = angular.isString(val) ? val : JSON.stringify(val);
          if (config.sendFieldsAs === 'json-blob') {
            formData.append(key, new Blob([val], {type: 'application/json'}));
          } else {
            formData.append(key, val);
          }
        }
      }
    }

    config.headers = config.headers || {};
    config.headers['Content-Type'] = undefined;
    config.transformRequest = config.transformRequest ?
      (angular.isArray(config.transformRequest) ?
        config.transformRequest : [config.transformRequest]) : [];
    config.transformRequest.push(function (data) {
      var formData = new FormData();
      var allFields = {};
      var key;
      for (key in config.fields) {
        if (config.fields.hasOwnProperty(key)) {
          allFields[key] = config.fields[key];
        }
      }
      if (data) allFields.data = data;
      for (key in allFields) {
        if (allFields.hasOwnProperty(key)) {
          var val = allFields[key];
          if (config.formDataAppender) {
            config.formDataAppender(formData, key, val);
          } else {
            addFieldToFormData(formData, val, key);
          }
        }
      }

      if (config.file != null) {
        var fileFormName = config.fileFormDataName || 'file';

        if (angular.isArray(config.file)) {
          var isFileFormNameString = angular.isString(fileFormName);
          for (var i = 0; i < config.file.length; i++) {
            formData.append(isFileFormNameString ? fileFormName : fileFormName[i], config.file[i],
              (config.fileName && config.fileName[i]) || config.file[i].name);
          }
        } else {
          formData.append(fileFormName, config.file, config.fileName || config.file.name);
        }
      }
      return formData;
    });

    return sendHttp(config);
  };

  this.http = function (config) {
    config.transformRequest = config.transformRequest || function (data) {
        if ((window.ArrayBuffer && data instanceof window.ArrayBuffer) || data instanceof Blob) {
          return data;
        }
        return $http.defaults.transformRequest[0](arguments);
      };
    return sendHttp(config);
  };

  this.dataUrl = function (file, callback, disallowObjectUrl) {
    if (window.FileReader && file &&
      (!window.FileAPI || navigator.userAgent.indexOf('MSIE 8') === -1 || file.size < 20000) &&
      (!window.FileAPI || navigator.userAgent.indexOf('MSIE 9') === -1 || file.size < 4000000)) {
      $timeout(function () {
        //prefer URL.createObjectURL for handling refrences to files of all sizes
        //since it doesn´t build a large string in memory
        var URL = window.URL || window.webkitURL;
        if (URL && URL.createObjectURL && !disallowObjectUrl) {
          callback(URL.createObjectURL(file));
        } else {
          var fileReader = new FileReader();
          fileReader.readAsDataURL(file);
          fileReader.onload = function (e) {
            $timeout(function () {
              callback(e.target.result);
            });
          };
        }
      });
    } else {
      callback(null);
    }
  };

  this.setDefaults = function(defaults) {
    ngFileUpload.defaults = defaults || {};
  };
}

]);

(function () {
  ngFileUpload.getAttrWithDefaults = function(attr, name) {
    return attr[name] != null ? attr[name] :
      (ngFileUpload.defaults[name] == null ?
        ngFileUpload.defaults[name] : ngFileUpload.defaults[name].toString());
  };

  var getAttr = ngFileUpload.getAttrWithDefaults;

  ngFileUpload.directive('ngfSelect', ['$parse', '$timeout', '$compile',
    function ($parse, $timeout, $compile) {
      return {
        restrict: 'AEC',
        require: '?ngModel',
        link: function (scope, elem, attr, ngModel) {
          linkFileSelect(scope, elem, attr, ngModel, $parse, $timeout, $compile);
        }
      };
    }]);

  function linkFileSelect(scope, elem, attr, ngModel, $parse, $timeout, $compile) {
    /** @namespace attr.ngfSelect */
    /** @namespace attr.ngfChange */
    /** @namespace attr.ngModel */
    /** @namespace attr.ngModelRejected */
    /** @namespace attr.ngfModel */
    /** @namespace attr.ngfMultiple */
    /** @namespace attr.ngfCapture */
    /** @namespace attr.ngfAccept */
    /** @namespace attr.ngfValidate */
    /** @namespace attr.ngfMaxSize */
    /** @namespace attr.ngfMinSize */
    /** @namespace attr.ngfResetOnClick */
    /** @namespace attr.ngfResetModelOnClick */
    /** @namespace attr.ngfKeep */
    /** @namespace attr.ngfKeepDistinct */

    if (elem.attr('__ngf_gen__')) {
      return;
    }

    scope.$on('$destroy', function () {
      if (elem.$$ngfRefElem) elem.$$ngfRefElem.remove();
    });

    var disabled = false;
    if (getAttr(attr, 'ngfSelect').search(/\W+\$files\W+/) === -1) {
      scope.$watch(getAttr(attr, 'ngfSelect'), function (val) {
        disabled = val === false;
      });
    }
    function isInputTypeFile() {
      return elem[0].tagName.toLowerCase() === 'input' && attr.type && attr.type.toLowerCase() === 'file';
    }

    var isUpdating = false;

    function changeFn(evt) {
      if (!isUpdating) {
        isUpdating = true;
        try {
          var fileList = evt.__files_ || (evt.target && evt.target.files);
          var files = [], rejFiles = [];

          for (var i = 0; i < fileList.length; i++) {
            var file = fileList.item(i);
            if (validate(scope, $parse, attr, file, evt)) {
              files.push(file);
            } else {
              rejFiles.push(file);
            }
          }
          updateModel($parse, $timeout, scope, ngModel, attr,
            getAttr(attr, 'ngfChange') || getAttr(attr, 'ngfSelect'), files, rejFiles, evt);
          if (files.length === 0) evt.target.value = files;
//                if (evt.target && evt.target.getAttribute('__ngf_gen__')) {
//                    angular.element(evt.target).remove();
//                }
        } finally {
          isUpdating = false;
        }
      }
    }

    function bindAttrToFileInput(fileElem) {
      if (getAttr(attr, 'ngfMultiple')) fileElem.attr('multiple', $parse(getAttr(attr, 'ngfMultiple'))(scope));
      if (getAttr(attr, 'ngfCapture')) fileElem.attr('capture', $parse(getAttr(attr, 'ngfCapture'))(scope));
      if (getAttr(attr, 'accept')) fileElem.attr('accept', getAttr(attr, 'accept'));
      for (var i = 0; i < elem[0].attributes.length; i++) {
        var attribute = elem[0].attributes[i];
        if ((isInputTypeFile() && attribute.name !== 'type') ||
          (attribute.name !== 'type' && attribute.name !== 'class' &&
          attribute.name !== 'id' && attribute.name !== 'style')) {
          if (attribute.value == null || attribute.value === '') {
            if (attribute.name === 'required') attribute.value = 'required';
            if (attribute.name === 'multiple') attribute.value = 'multiple';
          }
          fileElem.attr(attribute.name, attribute.value);
        }
      }
    }

    function createFileInput(evt, resetOnClick) {
      if (!resetOnClick && (evt || isInputTypeFile())) return elem.$$ngfRefElem || elem;
      if (elem.$$ngfProgramClick) return elem;

      var fileElem = angular.element('<input type="file">');
      bindAttrToFileInput(fileElem);

      if (isInputTypeFile()) {
        elem.replaceWith(fileElem);
        elem = fileElem;
        fileElem.attr('__ngf_gen__', true);
        $compile(elem)(scope);
      } else {
        fileElem.css('visibility', 'hidden').css('position', 'absolute').css('overflow', 'hidden')
          .css('width', '0px').css('height', '0px').css('border', 'none')
          .css('margin', '0px').css('padding', '0px').attr('tabindex', '-1');
        if (elem.$$ngfRefElem) {
          elem.$$ngfRefElem.remove();
        }
        elem.$$ngfRefElem = fileElem;
        document.body.appendChild(fileElem[0]);
      }

      return fileElem;
    }

    function resetModel(evt) {
      updateModel($parse, $timeout, scope, ngModel, attr,
        getAttr(attr, 'ngfChange') || getAttr(attr, 'ngfSelect'), [], [], evt, true);
    }

    var initialTouchStartY = 0;
    function clickHandler(evt) {
      if (elem.attr('disabled') || disabled) return false;

      if (evt != null) {
        var touches = evt.changedTouches || (evt.originalEvent && evt.originalEvent.changedTouches);
        if (evt.type === 'touchstart') {
          initialTouchStartY = touches ? touches[0].clientY : 0;
          return true; // don't block event default
        } else {
          evt.stopPropagation();
          evt.preventDefault();

          // prevent scroll from triggering event
          if (evt.type === 'touchend') {
            var currentLocation = touches ? touches[0].clientY : 0;
            if (Math.abs(currentLocation - initialTouchStartY) > 20) return false;
          }
        }
      }

      var resetOnClick = $parse(getAttr(attr, 'ngfResetOnClick'))(scope) !== false;
      var fileElem = createFileInput(evt, resetOnClick);

      function clickAndAssign(evt) {
        if (evt && !elem.$$ngfProgramClick) {
          elem.$$ngfProgramClick = true;
          fileElem[0].click();
          $timeout(function() {
            delete elem.$$ngfProgramClick;
          }, 500);
        }
        if ((isInputTypeFile() || !evt) && resetOnClick) {
          elem.bind('click touchstart touchend', clickHandler);
        }
      }

      if (fileElem) {
        if (!evt || resetOnClick) fileElem.bind('change', changeFn);
        if (evt && resetOnClick && $parse(getAttr(attr, 'ngfResetModelOnClick'))(scope) !== false) {
          resetModel(evt);
        }

        // fix for android native browser < 4.4
        if (shouldClickLater(navigator.userAgent)) {
          setTimeout(function () {
            clickAndAssign(evt);
          }, 0);
        } else {
          clickAndAssign(evt);
        }
      }

      return false;
    }

    if (window.FileAPI && window.FileAPI.ngfFixIE) {
      window.FileAPI.ngfFixIE(elem, createFileInput, bindAttrToFileInput, changeFn);
    } else {
      clickHandler();
      //if (!isInputTypeFile()) {
      //  elem.bind('click touchend', clickHandler);
      //}
    }
  }

  function shouldClickLater(ua) {
    // android below 4.4
    var m = ua.match(/Android[^\d]*(\d+)\.(\d+)/);
    if (m && m.length > 2) {
      var v = ngFileUpload.defaults.androidFixMinorVersion || 4;
      return parseInt(m[1]) < 4 || (parseInt(m[1]) === v && parseInt(m[2]) < v);
    }

    // safari on windows
    return ua.indexOf('Chrome') === -1 && /.*Windows.*Safari.*/.test(ua);
  }

  ngFileUpload.validate = function (scope, $parse, attr, file, evt) {
    if (file == null) {
      return false;
    }
    function globStringToRegex(str) {
      if (str.length > 2 && str[0] === '/' && str[str.length - 1] === '/') {
        return str.substring(1, str.length - 1);
      }
      var split = str.split(','), result = '';
      if (split.length > 1) {
        for (var i = 0; i < split.length; i++) {
          result += '(' + globStringToRegex(split[i]) + ')';
          if (i < split.length - 1) {
            result += '|';
          }
        }
      } else {
        if (str.indexOf('.') === 0) {
          str = '*' + str;
        }
        result = '^' + str.replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + '-]', 'g'), '\\$&') + '$';
        result = result.replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
      }
      return result;
    }

    var custom = $parse(getAttr(attr, 'ngfValidate'))(scope, {$file: file, $event: evt});
    if (custom != null && (custom === false || custom.length > 0)) {
      file.$error = custom ? custom : 'validate';
      return false;
    }
    var accept = $parse(getAttr(attr, 'ngfAccept'))(scope, {$file: file, $event: evt});
    var fileSizeMax = $parse(getAttr(attr, 'ngfMaxSize'))(scope, {$file: file, $event: evt}) || 9007199254740991;
    var fileSizeMin = $parse(getAttr(attr, 'ngfMinSize'))(scope, {$file: file, $event: evt}) || -1;
    if (accept != null && angular.isString(accept)) {
      var regexp = new RegExp(globStringToRegex(accept), 'gi');
      accept = (file.type != null && regexp.test(file.type.toLowerCase())) ||
        (file.name != null && regexp.test(file.name.toLowerCase()));
      if (!accept) {
        file.$error = 'accept';
        return false;
      }
    } else {
      if (accept === false) {
        file.$error = 'accept';
        return false;
      }
    }
    if (file.size == null) return true;
    if (file.size > fileSizeMax) {
      file.$error = 'maxSize';
      return false;
    }
    if (file.size < fileSizeMin) {
      file.$error = 'minSize';
      return false;
    }
    return true;
  };

  ngFileUpload.updateModel = function ($parse, $timeout, scope, ngModel, attr, fileChange,
                                       files, rejFiles, evt, noDelay) {
    function update() {
      var keep = $parse(getAttr(attr, 'ngfKeep'))(scope);
      if (keep === true) {
        var prevFiles = (ngModel.$modelValue || []).slice(0);
        if (!files || !files.length) {
          files = prevFiles;
        } else if ($parse(getAttr(attr, 'ngfKeepDistinct'))(scope) === true) {
          var len = prevFiles.length;
          for (var i = 0; i < files.length; i++) {
            for (var j = 0; j < len; j++) {
              if (files[i].name === prevFiles[j].name) break;
            }
            if (j === len) {
              prevFiles.push(files[i]);
            }
          }
          files = prevFiles;
        } else {
          files = prevFiles.concat(files);
        }
      }
      var file = files && files.length ? files[0] : null;
      if (ngModel) {
        var singleModel = !$parse(getAttr(attr, 'ngfMultiple'))(scope) && ! getAttr(attr, 'multiple') && !keep;
        $parse(getAttr(attr, 'ngModel')).assign(scope, singleModel ? file : files);
        $timeout(function () {
          if (ngModel) {
            ngModel.$setViewValue(singleModel ? file : (files != null && files.length === 0 ? null : files));
          }
        });
      }
      var ngfModel = getAttr(attr, 'ngfModel');
      if (ngfModel) {
        $parse(ngfModel).assign(scope, files);
      }

      if (getAttr(attr, 'ngModelRejected')) {
        $parse(getAttr(attr, 'ngModelRejected')).assign(scope, rejFiles);
      }
      if (fileChange) {
        $parse(fileChange)(scope, {
          $files: files,
          $file: file,
          $rejectedFiles: rejFiles,
          $event: evt
        });
      }
    }

    if ((!files || files.length === 0) && (!ngModel.$modelValue || ngModel.$modelValue.length === 0)) {
      return;
    }
    if (noDelay) {
      update();
    } else {
      $timeout(function () {
        update();
      });
    }
  };

  var validate = ngFileUpload.validate;
  var updateModel = ngFileUpload.updateModel;

})();

(function () {
  var validate = ngFileUpload.validate;
  var updateModel = ngFileUpload.updateModel;
  var getAttr = ngFileUpload.getAttrWithDefaults;

  ngFileUpload.directive('ngfDrop', ['$parse', '$timeout', '$location', function ($parse, $timeout, $location) {
    return {
      restrict: 'AEC',
      require: '?ngModel',
      link: function (scope, elem, attr, ngModel) {
        linkDrop(scope, elem, attr, ngModel, $parse, $timeout, $location);
      }
    };
  }]);

  ngFileUpload.directive('ngfNoFileDrop', function () {
    return function (scope, elem) {
      if (dropAvailable()) elem.css('display', 'none');
    };
  });

  ngFileUpload.directive('ngfDropAvailable', ['$parse', '$timeout', function ($parse, $timeout) {
    return function (scope, elem, attr) {
      if (dropAvailable()) {
        var fn = $parse(getAttr(attr, 'ngfDropAvailable'));
        $timeout(function () {
          fn(scope);
          if (fn.assign) {
            fn.assign(scope, true);
          }
        });
      }
    };
  }]);

  function linkDrop(scope, elem, attr, ngModel, $parse, $timeout, $location) {
    var available = dropAvailable();
    if (getAttr(attr, 'dropAvailable')) {
      $timeout(function () {
        if (scope[getAttr(attr, 'dropAvailable')]) {
          scope[getAttr(attr, 'dropAvailable')].value = available;
        } else {
          scope[getAttr(attr, 'dropAvailable')] = available;
        }
      });
    }
    if (!available) {
      if ($parse(getAttr(attr, 'ngfHideOnDropNotAvailable'))(scope) === true) {
        elem.css('display', 'none');
      }
      return;
    }

    var disabled = false;
    if (getAttr(attr, 'ngfDrop').search(/\W+\$files\W+/) === -1) {
      scope.$watch(getAttr(attr, 'ngfDrop'), function(val) {
        disabled = val === false;
      });
    }

    var leaveTimeout = null;
    var stopPropagation = $parse(getAttr(attr, 'ngfStopPropagation'));
    var dragOverDelay = 1;
    var actualDragOverClass;

    elem[0].addEventListener('dragover', function (evt) {
      if (elem.attr('disabled') || disabled) return;
      evt.preventDefault();
      if (stopPropagation(scope)) evt.stopPropagation();
      // handling dragover events from the Chrome download bar
      if (navigator.userAgent.indexOf('Chrome') > -1) {
        var b = evt.dataTransfer.effectAllowed;
        evt.dataTransfer.dropEffect = ('move' === b || 'linkMove' === b) ? 'move' : 'copy';
      }
      $timeout.cancel(leaveTimeout);
      if (!scope.actualDragOverClass) {
        actualDragOverClass = calculateDragOverClass(scope, attr, evt);
      }
      elem.addClass(actualDragOverClass);
    }, false);
    elem[0].addEventListener('dragenter', function (evt) {
      if (elem.attr('disabled') || disabled) return;
      evt.preventDefault();
      if (stopPropagation(scope)) evt.stopPropagation();
    }, false);
    elem[0].addEventListener('dragleave', function () {
      if (elem.attr('disabled') || disabled) return;
      leaveTimeout = $timeout(function () {
        elem.removeClass(actualDragOverClass);
        actualDragOverClass = null;
      }, dragOverDelay || 1);
    }, false);
    elem[0].addEventListener('drop', function (evt) {
      if (elem.attr('disabled') || disabled) return;
      evt.preventDefault();
      if (stopPropagation(scope)) evt.stopPropagation();
      elem.removeClass(actualDragOverClass);
      actualDragOverClass = null;
      extractFiles(evt, function (files, rejFiles) {
        updateModel($parse, $timeout, scope, ngModel, attr,
          getAttr(attr, 'ngfChange') || getAttr(attr, 'ngfDrop'), files, rejFiles, evt);
      }, $parse(getAttr(attr, 'ngfAllowDir'))(scope) !== false,
        getAttr(attr, 'multiple') || $parse(getAttr(attr, 'ngfMultiple'))(scope));
    }, false);
    elem[0].addEventListener('paste', function (evt) {
      if (elem.attr('disabled') || disabled) return;
      extractFiles(evt, function (files, rejFiles) {
        updateModel($parse, $timeout, scope, ngModel, attr,
          getAttr(attr, 'ngfChange') || getAttr(attr, 'ngfDrop'), files, rejFiles, evt);
      }, false, getAttr(attr, 'multiple') || $parse(getAttr(attr, 'ngfMultiple'))(scope));
    }, false);

    function calculateDragOverClass(scope, attr, evt) {
      var accepted = true;
      var items = evt.dataTransfer.items;
      if (items != null) {
        for (var i = 0; i < items.length && accepted; i++) {
          accepted = accepted &&
            (items[i].kind === 'file' || items[i].kind === '') &&
            validate(scope, $parse, attr, items[i], evt);
        }
      }
      var clazz = $parse(getAttr(attr, 'ngfDragOverClass'))(scope, {$event: evt});
      if (clazz) {
        if (clazz.delay) dragOverDelay = clazz.delay;
        if (clazz.accept) clazz = accepted ? clazz.accept : clazz.reject;
      }
      return clazz || getAttr(attr, 'ngfDragOverClass') || 'dragover';
    }

    function extractFiles(evt, callback, allowDir, multiple) {
      var files = [], rejFiles = [], processing = 0;

      function addFile(file) {
        if (validate(scope, $parse, attr, file, evt)) {
          files.push(file);
        } else {
          rejFiles.push(file);
        }
      }

      function traverseFileTree(files, entry, path) {
        if (entry != null) {
          if (entry.isDirectory) {
            var filePath = (path || '') + entry.name;
            addFile({name: entry.name, type: 'directory', path: filePath});
            var dirReader = entry.createReader();
            var entries = [];
            processing++;
            var readEntries = function () {
              dirReader.readEntries(function (results) {
                try {
                  if (!results.length) {
                    for (var i = 0; i < entries.length; i++) {
                      traverseFileTree(files, entries[i], (path ? path : '') + entry.name + '/');
                    }
                    processing--;
                  } else {
                    entries = entries.concat(Array.prototype.slice.call(results || [], 0));
                    readEntries();
                  }
                } catch (e) {
                  processing--;
                  console.error(e);
                }
              }, function () {
                processing--;
              });
            };
            readEntries();
          } else {
            processing++;
            entry.file(function (file) {
              try {
                processing--;
                file.path = (path ? path : '') + file.name;
                addFile(file);
              } catch (e) {
                processing--;
                console.error(e);
              }
            }, function () {
              processing--;
            });
          }
        }
      }

      if (evt.type === 'paste') {
        var clipboard = evt.clipboardData || evt.originalEvent.clipboardData;
        if (clipboard && clipboard.items) {
          for (var k = 0; k < clipboard.items.length; k++) {
            if (clipboard.items[k].type.indexOf('image') !== -1) {
              addFile(clipboard.items[k].getAsFile());
            }
          }
          callback(files, rejFiles);
        }
      } else {
        var items = evt.dataTransfer.items;

        if (items && items.length > 0 && $location.protocol() !== 'file') {
          for (var i = 0; i < items.length; i++) {
            if (items[i].webkitGetAsEntry && items[i].webkitGetAsEntry() && items[i].webkitGetAsEntry().isDirectory) {
              var entry = items[i].webkitGetAsEntry();
              if (entry.isDirectory && !allowDir) {
                continue;
              }
              if (entry != null) {
                traverseFileTree(files, entry);
              }
            } else {
              var f = items[i].getAsFile();
              if (f != null) addFile(f);
            }
            if (!multiple && files.length > 0) break;
          }
        } else {
          var fileList = evt.dataTransfer.files;
          if (fileList != null) {
            for (var j = 0; j < fileList.length; j++) {
              addFile(fileList.item(j));
              if (!multiple && files.length > 0) {
                break;
              }
            }
          }
        }
        var delays = 0;
        (function waitForProcess(delay) {
          $timeout(function () {
            if (!processing) {
              if (!multiple && files.length > 1) {
                i = 0;
                while (files[i].type === 'directory') i++;
                files = [files[i]];
              }
              callback(files, rejFiles);
            } else {
              if (delays++ * 10 < 20 * 1000) {
                waitForProcess(10);
              }
            }
          }, delay || 0);
        })();
      }
    }
  }

  function dropAvailable() {
    var div = document.createElement('div');
    return ('draggable' in div) && ('ondrop' in div);
  }

})();

(function () {

  function fileToSrc(Upload, scope, $parse, attr, name, defaultName, callback) {
      if (defaultName) {
        callback($parse(defaultName)(scope));
      }
      scope.$watch(name, function (file) {
        if (!angular.isString(file)) {
          if (window.FileReader && ngFileUpload.validate(scope, $parse, attr, file, null)) {
            Upload.dataUrl(file, function (url) {
              if (callback) {
                callback(url);
              } else {
                file.dataUrl = url || $parse(defaultName)(scope);
              }
            }, $parse(attr.ngfNoObjectUrl)(scope));
          }
        } else {
          callback(file);
        }
      });
  }

  /** @namespace attr.ngfSrc */
  /** @namespace attr.ngfDefaultSrc */
  /** @namespace attr.ngfNoObjectUrl */
  ngFileUpload.directive('ngfSrc', ['$parse', 'Upload', function ($parse, Upload) {
    return {
      restrict: 'AE',
      link: function (scope, elem, attr) {
        fileToSrc(Upload, scope, $parse, attr, attr.ngfSrc, attr.ngfDefaultSrc, function (url) {
          elem.attr('src', url);
        });
      }
    };
  }]);

  /** @namespace attr.ngfBackground */
  /** @namespace attr.ngfDefaultBackground */
  /** @namespace attr.ngfNoObjectUrl */
  ngFileUpload.directive('ngfBackground', ['$parse', 'Upload', function ($parse, Upload) {
    return {
      restrict: 'AE',
      link: function (scope, elem, attr) {
        fileToSrc(Upload, scope, $parse, attr, attr.ngfBackground, attr.ngfDefaultBackground, function (url) {
          elem.css('background-image', 'url(' + url + ')');
        });
      }
    };
  }]);

  /** @namespace attr.ngfDataUrl */
  /** @namespace attr.ngfDefaultDataUrl */
  /** @namespace attr.ngfNoObjectUrl */
  ngFileUpload.directive('ngfDataUrl', ['$parse', 'Upload', function ($parse, Upload) {
    return {
      restrict: 'AE',
      link: function (scope, elem, attr) {

        fileToSrc(Upload, scope, $parse, attr, attr.ngfDataUrl, attr.ngfDefaultDataUrl);
      }
    };
  }]);
})();
