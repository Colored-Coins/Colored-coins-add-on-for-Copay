
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
          if (txp.customData && txp.customData.asset) {
            var value = txp.amountStr;
            var asset = txp.customData.asset;
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