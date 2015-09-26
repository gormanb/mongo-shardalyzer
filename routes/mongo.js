/**
 * GET shard configuration given host, port, collection name
 */

var mongodb = require('mongodb');

var RJSON = require('relaxed-json');

var MongoClient = mongodb.MongoClient;

exports.namespaces =
	function(req, res)
	{
		var url = req.param('host').concat(':')
			.concat(req.param('port')).concat('/config');

		url = 'mongodb://'.concat(url);

		MongoClient.connect(url, function(err, db)
		{
			if (err)
				res.status(500).send(err);
			else
			{
				var chunkcoll = db.collection('chunks');

				chunkcoll.distinct('ns', function(err, namespaces)
				{
					if(err)
						res.status(500).send(err);
					else
						res.json(namespaces);
				});
			}
		})
	};

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
				res.status(500).send(err);
			else
			{
				db.admin().listDatabases(function(err, dbs)
				{
					if(err)
						res.status(500).send(err);
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
				res.status(500).send(err);
			else
			{
				db.listCollections().toArray(function(err, colls)
				{
					if(err)
						res.status(500).send(err);
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

		var namespace = req.param('namespace');

		var meta = {};

		MongoClient.connect(url, function (err, db)
		{
			if (err)
				res.status(500).send(err);
			else
			{
			    var changecoll = db.collection('changelog');
				var chunkcoll = db.collection('chunks');

				var changecursor = changecoll.find({ ns : namespace, what : /moveChunk|split/ }).sort({ time : -1 });
				var chunkcursor = chunkcoll.find({ ns : namespace });

				changecursor.toArray(function(err, changelog)
				{
					if(err)
						res.status(500).send(err);
					else
					{
						meta.changelog = changelog;

						chunkcursor.toArray(function(err, chunks)
						{
							if(err)
								res.status(500).send(err);
							else
							{
								meta.chunks = chunks;
								res.json(meta);
							}
						});
					}
				});
			}
		});
	};

exports.query =
	function(req, res)
	{
		var url = req.param('host').concat(':')
			.concat(req.param('port')).concat('/').concat(req.param('db'));

		url = 'mongodb://'.concat(url);

		try
		{
			var query = RJSON.parse(req.param('query'));
		}
		catch(err)
		{
			res.status(500).json({ stack : err.stack, message : err.message });
			throw err;
		}

		var collection = req.param('collection');

		var result = [];

		MongoClient.connect(url, function (err, db)
		{
			if (err)
				res.status(500).send(err);
			else
			{
				var coll = db.collection(collection);

				var stream = undefined;

				if(Array.isArray(query))
					stream = coll.aggregate(query).stream();
				else
					stream = coll.find(query).stream();

				stream.on("data", function(document) { result.push(document) });
			    stream.on("end", function(){ res.json(result) });
			}
		});
	}