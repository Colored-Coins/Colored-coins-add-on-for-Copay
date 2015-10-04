[Copay](https://github.com/bitpay/copay) addon with support for [Colored Coins](http://coloredcoins.org).

## Installation

This addon requires extra features from Copay and BWS to be supported. Some of these features [aren't pulled yet in Copay and BWS master branches](https://github.com/Colored-Coins/Colored-coins-add-on-for-Copay/blob/master/STATUS.md), so you have to use custom Copay and BWS.

0. Install Copay and BWS from the following code trees:
    
    Copay: https://github.com/troggy/copay/tree/wip

    ````
    git clone -b wip https://github.com/troggy/copay && cd copay && bower i && npm i && cd -
    ````

    Bitcore Wallet Service: https://github.com/troggy/bitcore-wallet-service/tree/wip
    
    ````
    git clone -b wip https://github.com/troggy/bitcore-wallet-service && cd bitcore-wallet-service && npm install && cd -
    ````

1. In Copay instance folder execute the following. This will install addon and it's dependencies:

    ````
    bower install Colored-Coins/Colored-coins-add-on-for-Copay && cd bower_components/copay-colored-coins-plugin && npm i && cd -
    ````

2. Add ``copayAddon.coloredCoins`` module to as dependency of ``copayApp.addons`` module (in ``copay/src/js/app.js``):

     ````
     angular.module('copayApp.addons', ['copayAddon.coloredCoins']);
     ````
     
2. Instruct you Copay to use local BWS. In ``copay/src/js/services/configService.js``:

    Change
    ````
    // Bitcore wallet service URL
    bws: {
      url: 'https://bws.bitpay.com/bws/api',
    },
    ````
    
    to
    
    ````
    // Bitcore wallet service URL
    bws: {
      url: 'http://localhost:3232/bws/api',
    },
    ````


3. Update Copay's Gruntfile (``copay/Grunfile.js``).
    
    Add the following under ``concat.angular.src``:

    ````
    'bower_components/copay-colored-coins-plugin/dist/copayColoredCoins.js',
    'bower_components/copay-colored-coins-plugin/config.js'
    ````
    
    And under ``concat.foundation.src``:
    
    ````
    'bower_components/copay-colored-coins-plugin/css/assets.css'
    ````
    
4. If you are installing this addon on public Copay (in other words, not for development purposes), change
``bower_components/copay-colored-coins-plugin/config.js`` so that it has your copay's host name intead of ``localhost``.
You need to have ports 8000, 8100, 8200 to be open for incoming connections for that host.

5. Addon uses S3 bucket to store uploaded asset icons. Configuration:
   - [Configure AWS profile](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html). It should have ``PutObject`` permission on you bucket.
   - Change profile, bucket and region names in ``bower_components/copay-colored-coins-plugin/Procfile``

5. Rebuild Copay:

    ````
    grunt
    ````
    
6. Run services

   For development: run with [foreman](http://ddollar.github.io/foreman/):
   
    ````
    foreman start -f bower_components/copay-colored-coins-plugin/Procfile
    ````

   In production: [export to Upstart](http://ddollar.github.io/foreman/#EXPORTING)

7. Start bitcore-wallet-service. In ``bitcore-wallet-service`` folder:
    
    ````
    npm start
    ````
   
8. Start Copay. In ``copay`` folder:

    ````
    npm start
    ````

