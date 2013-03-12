//- JavaScript source code

//- server.js ~~
//
//  This is based on Jonas's WebRW implementation, but I have clustered it for
//  use with multicore machines. It has been linted but not fully generalized
//  for asynchronous use. Also, it still attempts to log to the filesystem,
//  which doesn't work especially well on Heroku.
//
//                                                      ~~ (c) SRW, 06 Feb 2013
//                                                  ~~ last updated 12 Mar 2013

(function () {
    'use strict';

 // Pragmas

    /*jslint indent: 4, maxlen: 80, node: true, stupid: true */

 // Declarations

    var cluster, config, corser, fs, handler, http, log, openUri;

 // Definitions

    cluster = require('cluster');

    config = {
        port:   8888
    };

    corser = require('corser');

    fs = require('fs');

    handler = function (req, res) {
     // This function needs documentation.
        res.writeHead(200, {
            'Content-Type': 'text/javascript'
        });
        var AV, AVs, AVi, chunks, i, len, log, val;
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
            log = function (docId, docLength) {
             // LOG:  [TIME in mins since 1970] \t [UID] \t [STRING LENGTH]
                var data = [
                    Math.floor(Date.now() / 60000), docId, docLength + '\n'
                ].join('\t');
                fs.appendFile('/home/node/admin/log', data, function (err) {
                 // This function needs documentation.
                    if (err !== null) {
                        log('production.error', err);
                    }
                    return;
                });
                return;
            };
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
                    var data, filename;
                    data = chunks.join('');
                    filename = '/home/node/doc/' + AV.key;
                    fs.appendFile(filename, chunks.join(''), function (err) {
                     // This function needs documentation.
                        if (err !== null) {
                            log('production.error', err);
                        }
                        res.end(AV.callback + '(' + AV.key + ')');

                        log(AV.key, data.length);
                        return;
                    });
                    return;
                });
            } else {
                fs.open('/home/node/doc/' + AV.key, 'a', function (er, fd) {
                 // This function needs documentation.
                    var val = decodeURIComponent(AV.set);
                    fs.write(fd, val + '\n');
                    fs.close(fd);
                    res.end(AV.callback + '(' + AV.key + ')');

                    log(AV.key, val.length);
                    return;
                });
            }
        } else { // AV.get OR AV.doc
            if (!AV.get) {
                if (!AV.doc) {
                    res.end('ERROR: neither set, get or doc were defined ' +
                            'for this call');
                } else { // DOC, is this for a key or url?
                    if (!AV.doc.match(/\./g)) { // it is a key
                        res.end(fs.readFileSync('/home/node/doc/' +
                                AV.doc).toString()); // return content as is
                    } else {
                     // note silly trick to make sure res.end takes a string
                        openUri(AV.doc, function (e, r) {
                         // This function needs documentation.
                            res.end(r.toString());
                            return;
                        });
                    }
                }
            } else { // GET
             // is this a key or a URL
                if (!AV.get.match(/\./g)) { // it is  KEY
                    val = fs.readFileSync('/home/node/doc/' +
                            AV.get).toString().split('\n');
                    if (val[val.length - 1].length === 0) {
                     // remove trailing blanks
                        val = val.slice(0, val.length - 1);
                    }
                 // val[1] is the length of the content, val[0]
                    res.end(AV.callback + '(' + JSON.stringify(val) + ')');
                } else { // it is a URL
                    openUri(AV.get, function (e, val) {
                     // This function needs documentation.
                        val = val.toString().split('\n');
                        if (val[val.length - 1].length === 0) {
                         // remove trailing blanks
                            val = val.slice(0, val.length - 1);
                        }
                        res.end(AV.callback + '(' + JSON.stringify(val) + ')');
                        return;
                    });
                }
            }
        }
        return;
    };

    http = require('http');

    log = function (dbname, obj) {
     // This function writes data to STDOUT in a particular format that can be
     // easily understood by Hadoop. It generalizes Jonas's original log file
     // format for use on platform-as-a-service providers like Heroku.
        console.log('@[' + dbname + '] ' + JSON.stringify(obj));
        return;
    };

    openUri = require('open-uri');

 // Out-of-scope definitions

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
                log('production.error', {
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
