'use strict';


angular.module('copayAddon.coloredCoins')
    .service('ccConfig', function (configService, lodash) {
      var root = {};

      var defaultConfig = {
        api: {
          testnet: 'testnet.api.coloredcoins.org',
          livenet: 'api.coloredcoins.org'
        }
      };

      root.config = function() {
        return lodash.defaults(configService.getSync()['coloredCoins'], defaultConfig);
      };

      return root;
    });
