
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