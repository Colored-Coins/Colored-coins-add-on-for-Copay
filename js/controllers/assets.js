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