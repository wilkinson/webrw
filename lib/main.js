//- JavaScript source code

//- server.js ~~
//
//  This is based on Jonas's WebRW implementation, but I have clustered it for
//  use with multicore machines. It has been linted but not fully generalized
//  for asynchronous use yet.
//
//                                                      ~~ (c) SRW, 06 Feb 2013
//                                                  ~~ last updated 12 Mar 2013

(function () {
    'use strict';

 // Pragmas

    /*jslint indent: 4, maxlen: 80, node: true, stupid: true */

 // Declarations

    var cluster, config, corser, handler, http, implementation, openUri;

 // Definitions

    cluster = require('cluster');

    config = {
        port:   8888
    };

    corser = require('corser');

    handler = function (req, res) {
     // This function needs documentation.
        res.writeHead(200, {
            'Content-Type': 'text/javascript'
        });
        var AV, AVs, AVi, chunks, i, len, val;
        AV = {};
        AVs = req.url.slice(2).split('&');
        for (i = 0; i < AVs.length; i += 1) {
            AVi = AVs[i].split('=');
            AV[AVi[0]] = AVi[1];
        }
        if (!AV.callback) {
            AV.callback = 'callback';
        }
        if (AV.set) {
            len = 0;
            if (!AV.key) {
                AV.key = 'UID' + Math.random().toString().slice(2);
            }
            if (AV.set === 'blob') { // get chunks of data in a data blob
                chunks = [];
                req.on('data', function (chunk) {
                 // This function needs documentation.
                    chunks.push(chunk);
                    return;
                });
                req.on('end', function () {
                 // all chunks in
                    var val = chunks.join('');
                    implementation.set(AV.key, val, function (err) {
                     // This function needs documentation.
                        if (err !== null) {
                            implementation.log('production.error', err);
                        }
                        res.end(AV.callback + '(' + AV.key + ')');
                        implementation.log('production.log', {
                            date: new Date(),
                            docID: AV.key,
                            message: 'set'
                        });
                        return;
                    });
                    return;
                });
            } else {
                val = decodeURIComponent(AV.set);
                implementation.set(AV.key, val, function (err) {
                 // This function needs documentation.
                    if (err !== null) {
                        implementation.log('production.error', err);
                    }
                    res.end(AV.callback + '(' + AV.key + ')');
                    implementation.log('production.log', {
                        date: new Date(),
                        docID: AV.key,
                        message: 'set from URL'
                    });
                    return;
                });
            }
        } else { // AV.get OR AV.doc
            if (!AV.get) {
                if (!AV.doc) {
                    res.end('ERROR: neither "doc", "get", nor "set" were ' +
                            'defined for this call');
                } else { // DOC, is this for a key or url?
                    if (!AV.doc.match(/\./g)) { // it is a key
                        implementation.get(AV.doc, function (err, val) {
                         // This function returns the content as-is.
                            if (err !== null) {
                                implementation.log('production.error', err);
                            }
                            res.end(val);
                            implementation.log('production.log', {
                                date: new Date(),
                                docID: AV.key,
                                message: 'doc'
                            });
                            return;
                        });
                    } else {
                     // note silly trick to make sure `res.end` takes a string
                        openUri(AV.doc, function (err, val) {
                         // This function needs documentation.
                            if (err !== null) {
                                implementation.log('production.error', err);
                            }
                            res.end(val.toString());
                            implementation.log('production.log', {
                                date: new Date(),
                                docID: AV.key,
                                message: 'doc from URL'
                            });
                            return;
                        });
                    }
                }
            } else { // GET
             // is this a key or a URL
                if (!AV.get.match(/\./g)) { // it is  KEY
                    implementation.get(AV.get, function (err, val) {
                     // This function needs documentation.
                        if (err !== null) {
                            implementation.log('production.error', err);
                        }
                        var data = val.toString().split('\n').slice(0, -1);
                        res.end(AV.callback + '(' + JSON.stringify(data) + ')');
                        implementation.log('production.log', {
                            date: new Date(),
                            docID: AV.key,
                            message: 'get'
                        });
                        return;
                    });
                } else { // it is a URL
                    openUri(AV.get, function (err, val) {
                     // This function needs documentation.
                        if (err !== null) {
                            implementation.log('production.error', err);
                        }
                        var data = val.toString().split('\n').slice(0, -1);
                        res.end(AV.callback + '(' + JSON.stringify(data) + ')');
                        implementation.log('production.log', {
                            date: new Date(),
                            docID: AV.key,
                            message: 'get from URL'
                        });
                        return;
                    });
                }
            }
        }
        return;
    };

    http = require('http');

    implementation = {
        get: null,
        log: null,
        set: null
    };

    openUri = require('open-uri');

 // Out-of-scope definitions

    exports.def = function (obj) {
     // This function works just like it does in Quanah and QMachine. I will
     // come back and bulletproof it later ...
        var key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (implementation.hasOwnProperty(key)) {
                    implementation[key] = obj[key];
                }
            }
        }
        return;
    };

    exports.launch_server = function () {
     // This function is only temporary!
        var enable_cors;
        if (process.env.PORT !== undefined) {
            config.port = process.env.PORT;
        }
        http.globalAgent.maxSockets = 500;
        if (cluster.isWorker) {
            enable_cors = corser.create({});
            http.createServer(function (request, response) {
             // This function sends `request` and `response` through Corser,
             // which uses a middleware pattern to enable CORS.
                enable_cors(request, response, handler);
                return;
            }).listen(config.port);
            return;
        }
        cluster.on('exit', function (worker, code, signal) {
         // This function needs documentation.
            if (worker.suicide === false) {
                implementation.log('production.error', {
                    message: 'Worker died',
                    code: parseInt(code, 10),
                    signal: signal
                });
                cluster.fork();
            }
            return;
        });
        require('os').cpus().forEach(function () {
         // This function needs documentation.
            cluster.fork();
            return;
        });
        return;
    };

 // That's all, folks!

    return;

}());

//- vim:set syntax=javascript:
