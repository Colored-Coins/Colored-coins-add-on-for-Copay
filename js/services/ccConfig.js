'use strict';


angular.module('copayAddon.coloredCoins')
    .service('ccConfig', function (configService, lodash) {
      var root = {},
          configObject;

      var defaultConfig = {
        api: {
          testnet: 'testnet.api.coloredcoins.org',
          livenet: 'api.coloredcoins.org'
        }
      };

      root.config = function() {
        if (!configObject) {
          configObject = lodash.defaults(configService.getSync()['coloredCoins'], defaultConfig);
        }
        return configObject;
      };

      return root;
    });
