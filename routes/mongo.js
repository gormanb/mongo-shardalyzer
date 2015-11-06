/**
 * GET shard configuration given host, port, collection name
 */

var mongodb = require('mongodb');

var RJSON = require('relaxed-json');

var MongoClient = mongodb.MongoClient;

var mongoopts = { server : { poolSize : 1 } };

exports.namespaces =
	function(req, res)
	{
		var url = req.param('host').concat(':')
			.concat(req.param('port')).concat('/config');

		url = 'mongodb://'.concat(url);

		MongoClient.connect(url, mongoopts, function(err, db)
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

					db.close();
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

		MongoClient.connect(url, mongoopts, function (err, db)
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

					db.close();
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

		MongoClient.connect(url, mongoopts, function (err, db)
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

					db.close();
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

		MongoClient.connect(url, mongoopts, function (err, db)
		{
			if (err)
				res.status(500).send(err);
			else
			{
			    var changecoll = db.collection('changelog');
				var chunkcoll = db.collection('chunks');

				var shardcoll = db.collection('shards');
				var tagcoll = db.collection('tags');

				// guard against collections that were dropped and recreated; only take changelog entries since the most recent sharding
				changecoll.find({ ns : namespace, what : "shardCollection" }).sort({ time : -1 }).limit(1).toArray(function(err, shardevent)
				{
					var start = new Date(0);

					if(err)
					{
						res.status(500).send(err);
						db.close();

						return;
					}
					else if(shardevent && shardevent.length > 0)
						start = shardevent[0].time;

					var changecursor = changecoll.find({ ns : namespace, what : /moveChunk|split/, time : { $gt : start } }).sort({ time : -1 });
					var chunkcursor = chunkcoll.find({ ns : namespace });

					var tagcursor = tagcoll.find({ ns : namespace });
					var shardcursor = shardcoll.find({});

					changecursor.toArray(function(err, changelog)
					{
						if(err)
						{
							res.status(500).send(err);
							db.close();
						}
						else
						{
							meta.changelog = changelog;

							chunkcursor.toArray(function(err, chunks)
							{
								if(err)
								{
									res.status(500).send(err);
									db.close();
								}
								else
								{
									meta.chunks = chunks;

									shardcursor.toArray(function(err, shards)
									{
										if(err)
										{
											res.status(500).send(err);
											db.close();
										}
										else
										{
											meta.shards = shards;

											tagcursor.toArray(function(err, tags)
											{
												if(err)
													res.status(500).send(err);
												else
												{
													meta.tags = tags;
													res.json(meta);
												}

												db.close();
											})
										}
									});
								}
							});
						}
					});
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

		MongoClient.connect(url, mongoopts, function (err, db)
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
			    stream.on("end", function(){ res.json(result); db.close(); });
			}
		});
	}