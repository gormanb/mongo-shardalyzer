
/**
 * Module dependencies.
 */

var express = require('express')
  , favicon = require('serve-favicon')
  , logger = require('morgan')
  , bodyParser = require('body-parser')
  , methodOverride = require('method-override')
  , errorhandler = require('errorhandler')
  , routes = require('./routes')
  , user = require('./routes/user')
  , mongo = require('./routes/mongo')
  , http = require('http')
  , path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/bower_components', express.static(path.join(__dirname, 'bower_components')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// development only
if ('development' == app.get('env')) {
  app.use(errorhandler());
}

//app.get('/', routes.index);
//app.get('/users', user.list);
app.get('/mongo/dbs/:host/:port*', mongo.dbs);
app.get('/mongo/namespaces/:host/:port/:configdb*', mongo.namespaces);
app.get('/mongo/collections/:host/:port/:db*', mongo.collections);
app.get('/mongo/metadata/:host/:port/:configdb/:namespace*', mongo.metadata);
app.get('/mongo/query/:host/:port/:db/:collection/:query*', mongo.query);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
