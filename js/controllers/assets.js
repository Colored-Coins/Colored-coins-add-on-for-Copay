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