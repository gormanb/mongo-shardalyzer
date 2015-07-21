/**
 * GET shard configuration given host, port, collection name
 */

var mongodb = require('mongodb');

var MongoClient = mongodb.MongoClient;

var s = JSON.stringify;

exports.dbs =
	function(req, res)
	{
		var url =
			req.param('host').concat(':')
				.concat(req.param('port'));

		url = 'mongodb://'.concat(url);

		MongoClient.connect(url, function (err, db)
		{
			if (err)
				res.render('500.jade', {title: '500: Internal Server Error', error: err, stack: err.stack});
			else
			{
				db.admin().listDatabases(function(err, dbs)
				{
					if(err)
						res.render('500.jade', {title: '500: Internal Server Error', error: err, stack: err.stack});
					else
						res.json(dbs);
				});
			}
		});
	};

	exports.collections =
		function(req, res)
		{
			var url = req.param('host').concat(':')
				.concat(req.param('port')).concat('/').concat(req.param('db'));

			url = 'mongodb://'.concat(url);

			MongoClient.connect(url, function (err, db)
			{
				if (err)
					res.render('500.jade', {title: '500: Internal Server Error', error: err, stack: err.stack});
				else
				{
					db.listCollections().toArray(function(err, colls)
					{
						if(err)
							res.render('500.jade', {title: '500: Internal Server Error', error: err, stack: err.stack});
						else
							res.json(colls);
					});
				}
			});
		};

exports.metadata =
	function(req, res)
	{
		var url = req.param('host').concat(':')
			.concat(req.param('port')).concat('/config');

		url = 'mongodb://'.concat(url);

		var namespace = req.param('db')
			.concat('.').concat(req.param('collection'));

		var meta = {};

		meta['chunks'] = [];
		meta['changelog'] = [];

		MongoClient.connect(url, function (err, db)
		{
			if (err)
				res.render('500.jade', {title: '500: Internal Server Error', error: err, stack: err.stack});
			else
			{
				var chunkcoll = db.collection('chunks');
				var stream = chunkcoll.find({ ns : namespace }).stream();

				stream.on("data", function(chunk) { meta['chunks'].push(chunk); });

			    var changecoll = db.collection('changelog');
			    stream = changecoll.find({ ns : namespace, what : /moveChunk|split/ }).sort({ _id : -1 }).stream();

			    stream.on("data", function(change){ meta['changelog'].push(change) });
			    stream.on("end", function(){ res.json(meta) });
			}
		});
	};
