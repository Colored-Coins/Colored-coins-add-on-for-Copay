'use strict';

var MAX_IMAGE_SIZE = 300000;

var formidable = require('formidable'),
    AWS = require('aws-sdk'),
    fs = require('fs'),
    crypto = require("crypto"),
    http = require('http');

var aws_region = process.env.S3_REGION;
var bucket = process.env.S3_BUCKET;

if (!bucket) {
  console.log("Error: Missing S3_BUCKET env variable");
  return 1;
}
if (!aws_region) {
  console.log("Error: Missing S3_REGION env variable");
  return 1;
}

AWS.config.region = aws_region;

var isImage = function(mime) {
  return mime.indexOf('image/') == 0;
};

var sendError = function(res, err) {
  res.writeHead(500, {'content-type': 'text/plain'});
  res.write(err.toString());
  console.log(err);
  res.end();
};

var s3bucket = new AWS.S3({params: {Bucket: bucket}});
http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-type');

  if (req.url.match(/\/+upload/) && req.method.toLowerCase() == 'post') {
    // parse a file upload
    var form = new formidable.IncomingForm();

    var icon;
    var key;
    form.parse(req, function(err, fields, files) {
      icon = files.file;
      if (icon) {
        key = crypto.randomBytes(20).toString('hex') + icon.name.substr(icon.name.lastIndexOf('.'));
      }
    });

    form.on('end', function() {
      if (icon && isImage(icon.type) && icon.size < MAX_IMAGE_SIZE) {
        fs.readFile(icon.path, function(err, data) {
          if (err) {
            return sendError(res, err);
          }
          var params = { Key: key, Body: data };
          s3bucket.putObject(params, function(err, data) {
            if (err) {
              return sendError(res, err);
            } else {
              res.writeHead(200, {'content-type': 'application/json'});
              var iconData = {
                url: 'https://s3.' + AWS.config.region + '.amazonaws.com/' + bucket + '/' + encodeURIComponent(key),
                mimeType: icon.type
              };
              res.write(JSON.stringify(iconData));
              res.end();
            }
          });
        });
      } else {
        res.writeHead(400, {'content-type': 'application/json'});
        res.write("Expected image of size up to " + (MAX_IMAGE_SIZE / 1000) + "Kb");
        res.end();
      }
    });
  } else {
    // show a file upload form
    res.writeHead(200, {'content-type': 'text/html'});
/*
    res.write(
        '<form action="/upload" enctype="multipart/form-data" method="post">'+
            '<input type="text" name="title"><br>'+
            '<input type="file" name="upload" multiple="multiple"><br>'+
            '<input type="submit" value="Upload">'+
            '</form>'
    );
*/
    res.end();
  }

}).listen(8200);