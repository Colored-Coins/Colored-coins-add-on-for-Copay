'use strict';

angular.module('copayAddon.coloredCoins')
    .controller('assetsController', function ($rootScope, $scope, $modal, coloredCoins) {
      var self = this;

      this.assets = coloredCoins.assets;

      var disableAssetListener = $rootScope.$on('ColoredCoins/AssetsUpdated', function (event, assets) {
        self.assets = assets;
      });

      $scope.$on('$destroy', function () {
        disableAssetListener();
      });

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