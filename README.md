Experimental plugin for [Copay](https://github.com/bitpay/copay) adding support for [Colored Coins](http://coloredcoins.org).

## Installation

1. In Copay instance folder:

    ````
    bower install https://github.com/troggy/copay-colored-coins-plugin.git
    ````

2. Add ``copayAddon.coloredCoins`` module to as dependency of ``copayApp.addons`` module:

     ````
     angular.module('copayApp.addons', ['copayAddon.coloredCoins']);
     ````

3. Update Copay's Gruntfile. Add the following under ``concat.angular.src``:

    ````
    'bower_components/copay-colored-coins-plugin/dist/copayColoredCoins.js'
    ````
4. Colored Coins API doesn't have CORS at the moment. To workaround this start API proxy:
   Install:

   ````
   cd bower_components/copay-colored-coins-plugin/ && npm install && cd -
   ````
   
   and run:
   
    ````
    node bower_components/copay-colored-coins-plugin/server/apiProxy.js
    ````
    
    and add the following to Copay config (change <HOST> to the host you are running server at):
    
    ````
    coloredCoins: {
      apiHost: '<HOST>:8000'
    },
    ````
    
