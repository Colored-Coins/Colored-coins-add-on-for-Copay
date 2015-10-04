[Copay](https://github.com/bitpay/copay) addon with support for [Colored Coins](http://coloredcoins.org).

## Installation

This addon requires extra features from Copay and BWS to be supported. Some of these features [aren't pulled yet in Copay and BWS master branches](https://github.com/Colored-Coins/Colored-coins-add-on-for-Copay/blob/master/STATUS.md), so you have to use custom Copay and BWS.

0. Install Copay and BWS from the following code trees:
    
    Copay: https://github.com/troggy/copay/tree/wip

    Bitcore Wallet Service: https://github.com/troggy/bitcore-wallet-service/tree/wip

1. In Copay instance folder:

    ````
    bower install https://github.com/Colored-Coins/Colored-coins-add-on-for-Copay
    ````

2. Add ``copayAddon.coloredCoins`` module to as dependency of ``copayApp.addons`` module:

     ````
     angular.module('copayApp.addons', ['copayAddon.coloredCoins']);
     ````

3. Update Copay's Gruntfile.
    
    Add the following under ``concat.angular.src``:

    ````
    'bower_components/Colored-coins-add-on-for-Copay/dist/copayColoredCoins.js',
    'bower_components/Colored-coins-add-on-for-Copay/config.js'
    ````
    
    And under ``concat.foundation.src``:
    
    ````
    'bower_components/Colored-coins-add-on-for-Copay/css/assets.css'
    ````
4. If you are installing this addon on public Copay (in other words, not for development purposes), change
``bower_components/Colored-coins-add-on-for-Copay/config.js`` so that it has your copay's host name intead of ``localhost``.
You need to have ports 8000, 8100, 8200 to be open for incoming connections for that host.

5. Addon uses S3 bucket to store uploaded asset icons. Configuration:
   - [Configure AWS profile](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html). It should have ``PutObject`` permission on you bucket.
   - Change profile, bucket and region names in ``bower_components/Colored-coins-add-on-for-Copay/Procfile``
6. Run services

   For development: run with [foreman](http://ddollar.github.io/foreman/):
   
    ````
    foreman start -f bower_components/Colored-coins-add-on-for-Copay/Procfile
    ````

   In production: [export to Upstart](http://ddollar.github.io/foreman/#EXPORTING)

5. Rebuild Copay:

    ````
    grunt
    ````
