'use strict';


angular.module('copayAddon.coloredCoins')
    .service('ccConfig', function (configService) {
      var root = {};

      var defaultConfig = {
        api: {
          testnet: 'testnet.api.coloredcoins.org',
          livenet: 'api.coloredcoins.org'
        }
      };

      var _config = function() {
        return configService.getSync()['coloredCoins'] || defaultConfig;
      };

      root.apiHost = function(network) {
        if (!_config()['api'] || ! _config()['api'][network]) {
          return defaultConfig.api[network];
        } else {
          return _config().api[network];
        }
      };

      return root;
    });
