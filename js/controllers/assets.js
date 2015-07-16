'use strict';

angular.module('copayAddon.coloredCoins').controller('assetsController', function ($rootScope, $scope, $modal, $timeout, $log, coloredCoins, gettext, profileService, lodash, bitcore, externalTxSigner, UTXOList) {
  var self = this;

  this.assets = [];
  this.error = '';

  var addressToPath = {};

  this.setOngoingProcess = function(name) {
    $rootScope.$emit('Addon/OngoingProcess', name);
  };

  $rootScope.$on('Local/BalanceUpdated', function (event, balance) {
    self.assets = [];
    addressToPath = lodash.reduce(balance.byAddress, function(result, n) { result[n.address] = n.path; return result; }, {});
    self.setOngoingProcess(gettext('Getting assets'));
    balance.byAddress.forEach(function (ba) {
      coloredCoins.getAssets(ba.address, function (assets) {
        self.assets = self.assets.concat(assets);
        lodash.each(assets, function(a) {
          a.asset.utxo.path = addressToPath[ba.address];
          UTXOList.add(a.asset.utxo.txid, a.asset.utxo);
        });
        self.setOngoingProcess();
      })
    });
  });

  var setTransferError = function(err) {
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

  var handleTransferError = function(err) {
    profileService.lockFC();
    self.setOngoingProcess();
    return setTransferError(err);
  };

  var submitTransfer = function(asset, transfer, form) {
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
        return submitTransfer(asset, transfer, form);
      });
      return;
    }

    self.setOngoingProcess(gettext('Selecting transaction inputs'));
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
          self.setOngoingProcess();
          profileService.lockFC();
          return setTransferError(err);
        }

        $log.debug(txp);

        // save UTXO information from Transaction Proposal
        lodash.each(txp.inputs, function(i) {
          var utxo = { txid: i.txid, path: i.path, index: i.vout, value: i.satoshis,
            publicKeys: i.publicKeys,
            scriptPubKey: { hex: i.scriptPubKey, reqSigs: txp.requiredSignatures } };
          UTXOList.add(i.txid, utxo);
        });

        fc.removeTxProposal(txp, function(err, txpb) {
          if (err) { return handleTransferError(err); }
          self.setOngoingProcess(gettext('Creating transfer transaction'));
          coloredCoins.createTransferTx(asset, amount, address, txp.inputs[0], txp.requiredSignatures, function(err, result) {
            if (err) { return handleTransferError(err); }

            var tx = new bitcore.Transaction(result.txHex);
            $log.debug(JSON.stringify(tx.toObject(), null, 2));

            self.setOngoingProcess(gettext('Signing transaction'));
            externalTxSigner.sign(tx, fc.credentials);

            self.setOngoingProcess(gettext('Broadcasting transaction'));
            coloredCoins.broadcastTx(tx.uncheckedSerialize(), function(err, body) {
              if (err) { return handleTransferError(err); }
              $rootScope.$emit('Colored/TransferSent');
            });
          });
        });
      });
    }, 100);
  };

  this.openTransferModal = function(asset) {
    var ModalInstanceCtrl = function($scope, $modalInstance) {
      $scope.asset = asset;
      $rootScope.$on('Colored/TransferSent', function() {
        $scope.cancel();
        $rootScope.$emit('NewOutgoingTx');
      });
      $scope.setOngoingProcess = self.setOngoingProcess;
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