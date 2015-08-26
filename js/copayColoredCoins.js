
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