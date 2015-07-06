'use strict';

angular.module('copayColoredCoins')
    .controller('assetsController', function ($rootScope, coloredCoins) {
      var self = this;

      this.assets = [];

      $rootScope.$on('Local/BalanceUpdated', function (event, balance) {
        var updatedAssets = [];
        balance.byAddress.forEach(function (ba) {
          coloredCoins.getAssets(ba.address, function (assets) {
            updatedAssets.push(assets);
          })
        });
        self.assets = updatedAssets
      });


      this.openAssetModal = function () {
      };
    });