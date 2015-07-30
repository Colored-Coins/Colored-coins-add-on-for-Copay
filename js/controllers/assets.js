'use strict';

angular.module('copayAddon.coloredCoins').controller('assetsController', function ($rootScope, $scope, $modal, $controller, $timeout, $log, coloredCoins, gettext, profileService, lodash, bitcore, externalTxSigner) {
  var self = this;

  this.assets = [];

  var addressToPath = {};

  this.setOngoingProcess = function(name) {
    $rootScope.$emit('Addon/OngoingProcess', name);
  };

  var disableBalanceListener = $rootScope.$on('Local/BalanceUpdated', function (event, balance) {
    self.assets = [];
    addressToPath = lodash.reduce(balance.byAddress, function(result, n) { result[n.address] = n.path; return result; }, {});
    if (balance.byAddress.length > 0) {
      self.setOngoingProcess(gettext('Getting assets'));
    }

    var checkedAddresses = 0;
    balance.byAddress.forEach(function (ba) {
      coloredCoins.getAssets(ba.address, function (assets) {
        self.assets = self.assets.concat(assets);
        if (++checkedAddresses == balance.byAddress.length) {
          self.setOngoingProcess();
        }
      })
    });
  });

  $scope.$on('$destroy', function() {
    disableBalanceListener();
  });

  this.openTransferModal = function(asset) {

    var AssetTransferController = function($rootScope, $scope, $modalInstance, $timeout, $log, coloredCoins, gettext,
                                           profileService, lodash, bitcore, externalTxSigner) {
      $scope.asset = asset;

      $scope.fee = coloredCoins.defaultFee();

      $scope.error = '';

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

      $scope.transferAsset = function(transfer, form) {
        $log.debug("Asset: " + asset);
        $log.debug("Transfer: " + transfer);

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

          setOngoingProcess(gettext('Signing transaction'));
          externalTxSigner.sign(tx, fc.credentials);

          setOngoingProcess(gettext('Broadcasting transaction'));
          coloredCoins.broadcastTx(tx.uncheckedSerialize(), function(err, body) {
            if (err) { return handleTransferError(err); }
            $scope.cancel();
            $rootScope.$emit('NewOutgoingTx');
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