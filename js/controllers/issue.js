'use strict';

var AssetIssueController = function ($rootScope, $scope, $modalInstance, $timeout, $log, coloredCoins, gettext,
                                     profileService, feeService, lodash, bitcore, txStatus) {

  ProcessingTxController.call(this, $rootScope, $scope, $timeout, $log, coloredCoins, gettext, profileService, feeService,
      lodash, bitcore, txStatus, $modalInstance);

  var self = this;

  $scope.issueAsset = function (form) {
    var modalScope = this;

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

    self.setOngoingProcess(gettext('Creating issuance transaction'));
    coloredCoins.createIssueTx(modalScope.issuance, function (err, result) {
      if (err) {
        self._handleError(err);
      }

      var metadata = {
        asset: {
          action: 'issue',
          assetName: modalScope.issuance.assetName,
          //icon: $scope.asset.icon,
          amount: modalScope.issuance.amount
        }
      };
      self._createAndExecuteProposal(result.txHex, result.issuanceUtxo.address, metadata);
    });
  };
};

AssetIssueController.prototype = Object.create(ProcessingTxController.prototype);
