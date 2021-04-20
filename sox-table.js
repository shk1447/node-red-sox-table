module.exports = function(RED) {
  "use strict";
  var bodyParser = require("body-parser");
  var cookieParser = require("cookie-parser");
  var cors = require('cors');
  var onHeaders = require('on-headers');
  
  function createResponseWrapper(node,res) {
      var wrapper = {
          _res: res
      };
      var toWrap = [
          "append",
          "attachment",
          "cookie",
          "clearCookie",
          "download",
          "end",
          "format",
          "get",
          "json",
          "jsonp",
          "links",
          "location",
          "redirect",
          "render",
          "send",
          "sendfile",
          "sendFile",
          "sendStatus",
          "set",
          "status",
          "type",
          "vary"
      ];
      toWrap.forEach(function(f) {
          wrapper[f] = function() {
              node.warn(RED._("httpin.errors.deprecated-call",{method:"msg.res."+f}));
              var result = res[f].apply(res,arguments);
              if (result === res) {
                  return wrapper;
              } else {
                  return result;
              }
          }
      });
      return wrapper;
  }

  var corsHandler = function(req,res,next) { next(); }

  if (RED.settings.httpNodeCors) {
      corsHandler = cors(RED.settings.httpNodeCors);
      RED.httpNode.options("*",corsHandler);
  }

  function SoxTable(n) {
    RED.nodes.createNode(this,n);
    if (RED.settings.httpNodeRoot !== false) {

        if (!n.url) {
            this.warn(RED._("httpin.errors.missing-path"));
            return;
        }
        this.url = n.url;
        if (this.url[0] !== '/') {
            this.url = '/'+this.url;
        }
        this.method = 'get';

        var node = this;

        this.errorHandler = function(err,req,res,next) {
            node.warn(err);
            res.sendStatus(500);
        };

        this.callback = function(req,res) {
            var msgid = RED.util.generateId();
            res._msgid = msgid;
            node.send({_msgid:msgid,req:req,res:createResponseWrapper(node,res),payload:req.query});
        };

        var httpMiddleware = function(req,res,next) { next(); }

        if (RED.settings.httpNodeMiddleware) {
            if (typeof RED.settings.httpNodeMiddleware === "function" || Array.isArray(RED.settings.httpNodeMiddleware)) {
                httpMiddleware = RED.settings.httpNodeMiddleware;
            }
        }

        var maxApiRequestSize = '100mb';
        var jsonParser = bodyParser.json({limit:maxApiRequestSize});
        var urlencParser = bodyParser.urlencoded({limit:maxApiRequestSize,extended:true});

        var metricsHandler = function(req,res,next) { next(); }
        if (this.metric()) {
            metricsHandler = function(req, res, next) {
                var startAt = process.hrtime();
                onHeaders(res, function() {
                    if (res._msgid) {
                        var diff = process.hrtime(startAt);
                        var ms = diff[0] * 1e3 + diff[1] * 1e-6;
                        var metricResponseTime = ms.toFixed(3);
                        var metricContentLength = res.getHeader("content-length");
                        //assuming that _id has been set for res._metrics in HttpOut node!
                        node.metric("response.time.millis", {_msgid:res._msgid} , metricResponseTime);
                        node.metric("response.content-length.bytes", {_msgid:res._msgid} , metricContentLength);
                    }
                });
                next();
            };
        }

        RED.httpNode.get(this.url,cookieParser(),httpMiddleware,corsHandler,metricsHandler,this.callback,this.errorHandler);

        this.on("close",function() {
            var node = this;
            RED.httpNode._router.stack.forEach(function(route,i,routes) {
                if (route.route && route.route.path === node.url && route.route.methods['get']) {
                    routes.splice(i,1);
                }
            });
        });
    } else {
        this.warn(RED._("httpin.errors.not-created"));
    }
  }
  RED.nodes.registerType("sox-table",SoxTable);
}