/**
 * GET shard configuration given host, port, collection name
 */

var mongodb = require('mongodb');

var MongoClient = mongodb.MongoClient;

var s = JSON.stringify;

exports.list =
	function(req, res)
	{
		var url = req.param('host').concat(':')
			.concat(req.param('port')).concat('/config');

		url = 'mongodb://'.concat(url);

		var ns = req.param('db').concat('.').concat(req.param('collection'));

		chunks = {};
		shards = {};
		changes = [];

		MongoClient.connect(url, function (err, db)
		{
			if (err)
				res('Unable to connect to the mongoDB server. Error:', err);
			else
			{
				var chunkcoll = db.collection('chunks');
				var stream = chunkcoll.find({ ns : "bootcamp.twitter" }).stream();

				stream.on("data", function(chunk)
				{
					if(!(chunk.shard in shards))
						shards[chunk.shard] = [];

					shards[chunk.shard].push(chunk);
					chunks[s(chunk.min)] = chunk;
				});

			    var changecoll = db.collection('changelog');
			    stream = changecoll.find({ ns : "bootcamp.twitter", what : /moveChunk|split/ }).sort({ _id : -1 }).stream();

			    stream.on("data", function(change){ changes.push(change) });
			    stream.on("end", function(){ res.json(chunks) });
			}
		});
	};