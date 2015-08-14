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

3. Update Copay's Gruntfile.
    
    Add the following under ``concat.angular.src``:

    ````
    'bower_components/copay-colored-coins-plugin/dist/copayColoredCoins.js'
    ````
    
    And under ``concat.foundation.src``:
    
    ````
    'bower_components/copay-colored-coins-plugin/css/assets.css'
    ````
4. Add the following to Copay config (replace ``localhost`` with your host if deploying for public):

    ````
    coloredCoins: {
      api: {
        testnet: 'http://localhost:8000',
        livenet: 'http://localhost:8100'
      },
      uploadHost: 'http://localhost:8200'
    },
    ````

5. Run services

   For development: run with [foreman](http://ddollar.github.io/foreman/):
   
    ````
    foreman start -f bower_components/copay-colored-coins-plugin/Procfile
    ````

   In production: [export to Upstart](http://ddollar.github.io/foreman/#EXPORTING)

5. Rebuild Copay:

    ````
    grunt
    ````
