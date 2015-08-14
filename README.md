[Copay](https://github.com/bitpay/copay) addon with support for [Colored Coins](http://coloredcoins.org).

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
6. Run services

   For development: run with [foreman](http://ddollar.github.io/foreman/):
   
    ````
    foreman start -f bower_components/copay-colored-coins-plugin/Procfile
    ````

   In production: [export to Upstart](http://ddollar.github.io/foreman/#EXPORTING)

5. Rebuild Copay:

    ````
    grunt
    ````
