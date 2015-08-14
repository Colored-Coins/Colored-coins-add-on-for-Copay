'use strict';

angular.module('copayAddon.coloredCoins')
    .value('ccConfig', {
        api: {
          testnet: 'http://localhost:8000',
          livenet: 'http://localhost:8100'
        },
        uploadHost: 'http://localhost:8200'
      });
