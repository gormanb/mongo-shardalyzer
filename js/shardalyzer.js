
var MongoClient = mongodb.MongoClient;

var s = JSON.stringify;

var url = 'mongodb://localhost:27017/config';

var shards = {};
var chunks = {};
var changes = [];

function printTopology()
{
	for(chunk in chunks)
		console.log(chunks[chunk].min);

	for(shard in shards)
		console.log(shards[shard]);

	for(change in changes)
		console.log(changes[change]);
}

function addChunk(chunk)
{
	if(!(chunk.shard in shards))
		shards[chunk.shard] = [];

	shards[chunk.shard].push(chunk);
	chunks[s(chunk.min)] = chunk;
}

function addChange(change)
{
	changes.push(change);
}

// ns-minkey0_val-minkeyN_val
function generateChunkId(ns, minShardKey)
{
	// generate the ID of the new chunk
	var newId = ns;

	// iterates in correct shardkey order
	for(var k in minshardKey)
		newId.concat("-").concat(k).concat("_").concat(s(minShardKey[k]));

	return newId;
}

/*
{
	"_id" : "<hostname>-<timestamp>-<increment>",
	"server" : "<hostname><:port>",
	"clientAddr" : "127.0.0.1:63381",
	"time" : ISODate("2012-12-11T14:09:21.039Z"),
	"what" : "split",
	"ns" : "<database>.<collection>",
	"details" : {
		"before" : {
			"min" : {
				"<database>" : { $minKey : 1 }
			},
			"max" : {
				"<database>" : { $maxKey : 1 }
			},
			"lastmod" : Timestamp(1000, 0),
			"lastmodEpoch" : ObjectId("000000000000000000000000")
			},
    	"left" : {
			"min" : {
				"<database>" : { $minKey : 1 }
			},
			"max" : {
				"<database>" : "<value>"
			},
			"lastmod" : Timestamp(1000, 1),
			"lastmodEpoch" : ObjectId(<...>)
		},
		"right" : {
			min" : {
				"<database>" : "<value>"
			},
			"max" : {
				"<database>" : { $maxKey : 1 }
			},
			"lastmod" : Timestamp(1000, 2),
			"lastmodEpoch" : ObjectId("<...>")
		}
	}
}
 */
function applySplit(chunks, shards, change)
{
	var left = change.details.left;
	var right = change.details.right;
	var before = change.details.before;

	// the original chunk
	var chunk = chunks[s(before.min)];

	// update the source chunk' details
	for(var k in left)
		chunk[k] = left[k];

	// create new chunk based on old
	var newChunk = jQuery.extend(true, {}, chunk);

	// update the new chunk's details
	for(var k in right)
		newChunk[k] = right[k];

	// generate an _id for the new chunk
	newChunk._id = generateChunkId(newChunk.ns, newChunk.min);

	// add new chunk to topology
	shards[newChunk.shard].append(newChunk);
	chunks[s(newChunk.min)] = newChunk;
}

function revertSplit(chunks, shards, change)
{
	var left = change.details.left;
	var right = change.details.right;
	var before = change.details.before;

	var chunk = chunks[s(left.min)];
	var splitChunk = chunks[s(right.min)];

	// remove right chunk...
	shards[splitChunk.shard].pop();
	delete chunks[s(right.min)];

	// ... and revert left
	for(var k in before)
		chunk[k] = before[k];
}

/*
{
	"_id" : "Bernards-MacBook-Pro.local-2015-07-13T12:04:08-55a3a9381e8e9aa0007de5bb",
	"server" : "Bernards-MacBook-Pro.local",
	"clientAddr" : "10.7.31.173:51616",
	"time" : ISODate("2015-07-13T12:04:08.778Z"),
	"what" : "multi-split",
	"ns" : "bootcamp.twitter",
	"details" : {
		"before" : {
			"min" : {
				"user.id" : 371516615
			},
			"max" : {
				"user.id" : 610496671
			}
		},
		"number" : 1,
		"of" : 5,
		"chunk" : {
			"min" : {
				"user.id" : 371516615
			},
			"max" : {
				"user.id" : 418954948
			},
			"lastmod" : Timestamp(3, 10),
			"lastmodEpoch" : ObjectId("55a3a8fc2116282c008491df")
		}
	}
}
 ...
{
	"_id" : "Bernards-MacBook-Pro.local-2015-07-13T12:04:08-55a3a9381e8e9aa0007de5bf",
	"server" : "Bernards-MacBook-Pro.local",
	"clientAddr" : "10.7.31.173:51616",
	"time" : ISODate("2015-07-13T12:04:08.799Z"),
	"what" : "multi-split",
	"ns" : "bootcamp.twitter",
	"details" : {
		"before" : {
			"min" : {
				"user.id" : 371516615
			},
			"max" : {
				"user.id" : 610496671
			}
		},
		"number" : 5,
		"of" : 5,
		"chunk" : {
			"min" : {
				"user.id" : 592098546
			},
			"max" : {
				"user.id" : 610496671
			},
			"lastmod" : Timestamp(3, 14),
			"lastmodEpoch" : ObjectId("55a3a8fc2116282c008491df")
		}
	}
}
 */
function applyMultiSplit(chunks, shards, change)
{
	var before = change.details.before;
	var newMeta = change.details.chunk;

	// the original chunk
	var chunk = chunks[s(before.min)];

	// this split's position in the sequence
	var splitNum = change.details.number;

	if(splitNum == 1) // split 1 of N updates existing chunk
	{
		for(var k in newMeta)
			chunk[k] = newMeta[k];
	}
	else
	{
		// subsequent splits create new chunks
		var newChunk = jQuery.extend(true, {}, chunk);

		for(var k in newMeta)
			newChunk[k] = newMeta[k];

		// generate an ID for the new chunk
		newChunk._id = generateChunkId(newChunk.ns, newChunk.min);

		// add new chunk to topology
		shards[newChunk.shard].append(newChunk);
		chunks[s(newChunk.min)] = newChunk;
	}
}

function revertMultiSplit(chunks, shards, change)
{
	var before = change.details.before;
	var newMeta = change.details.chunk;

	// the original chunk
	var chunk = chunks[s(before.min)];

	// this split's position in the sequence
	var splitNum = change.details.number;

	// get the child chunk
	var newChunk = chunks[s(newMeta.min)];

	if(splitNum == 1)
	{
		// get min and max before split
		// 2.6 {before} includes original lastmod & Epoch
		// 3.0 omits this information, need to recreate
		chunk.lastmod = newMeta.lastmod;
		//chunk.lastmodUnsplit();

		// revert parent chunk
		for(var k in before)
			chunk[k] = before[k];
	}
	else
	{
		// remove the child chunk
		shards[newChunk.shard].pop();
		delete chunks[s(newChunk.min)];
	}
}

/*
{
	"_id" : "Bernards-MacBook-Pro.local-2015-07-13T12:17:12-55a3ac481e8e9aa0007de63d",
	"server" : "Bernards-MacBook-Pro.local",
	"clientAddr" : "10.7.31.173:51616",
	"time" : ISODate("2015-07-13T12:17:12.348Z"),
	"what" : "moveChunk.from",
	"ns" : "bootcamp.twitter",
	"details" : {
		"min" : {
			"user.id" : 939361788
		},
		"max" : {
			"user.id" : 958661575
		},
		"step 1 of 6" : 0,
		"step 2 of 6" : 431,
		"step 3 of 6" : 81,
		"step 4 of 6" : 30010,
		"step 5 of 6" : 238,
		"step 6 of 6" : 0,
		"to" : "shard03",
		"from" : "shard01",
		"note" : "success"
	}
}
*/
function applyMoveFrom(chunks, shards, change)
{
	var chunk = chunks[s(change.details.min)];

	var success =
		(change.details.note == "success");

	if(!success)
	{
		shards[change.details.to].pop();
		shards[change.details.from].push(chunk);

		chunk.shard = change.details.from;
		//chunk.lastmodUnmove(0);
	}
}

function revertMoveFrom(chunks, shards, change)
{
	var chunk = chunks[s(change.details.min)];

	var success =
		(change.details.note == "success");

	if(!success)
	{
		// if !success at [t+1], chunk has already been restored to source shard
		// therefore, revert the change by putting it back on the target shard
		shards[change.details.from].pop();
		shards[change.details.to].push(chunk);

		chunk.shard = change.details.to;
		//chunk.lastmodMove(0);
	}
}

/*
{
	"_id" : "Bernards-MacBook-Pro.local-2015-07-13T12:17:58-55a3ac76dabc7320d7ef6273",
	"server" : "Bernards-MacBook-Pro.local",
	"clientAddr" : "10.7.31.173:51618",
	"time" : ISODate("2015-07-13T12:17:58.092Z"),
	"what" : "moveChunk.start",
	"ns" : "bootcamp.twitter",
	"details" : {
		"min" : {
			"user.id" : 1612021
		},
		"max" : {
			"user.id" : 23516767
		},
		"from" : "shard03",
		"to" : "shard02"
	}
}
*/
function applyMoveStart(chunks, shards, change)
{
	// get relevant chunk
	var chunk = chunks[s(change.details.min)];

	chunk.shard = to;
	//chunk.lastmodMove(0);

	// TODO: dupe chunk, put it in dest shard, tag as START_DEST for vis

	// move the chunk from one shard to the other
	shards[change.details.from] = shards[change.details.from].filter
	(
		function(testChunk)
		{
		  return s(testChunk.min) !== s(chunk.min);
		}
	);

	shards[change.details.to].push(chunk);
}

function revertMoveStart(chunks, shards, change)
{
	// get relevant chunk
	var chunk = chunks[s(change.details.min)];

	chunk.shard = change.details.from;
	//chunk.lastmodUnmove(0);

	// restore the chunk to the original shard
	// move the chunk from one shard to the other
	shards[change.details.to] = shards[change.details.to].filter
	(
		function(testChunk)
		{
		  return s(testChunk.min) !== s(chunk.min);
		}
	);

	shards[change.details.from].push(chunk);
}

function rewind()
{
	for(var k in changes)
	{
		switch(changes[k].what)
		{
			case "moveChunk.start":
				revertMoveStart(chunks, shards, changes[k]);
				break;

			case "moveChunk.from":
				revertMoveFrom(chunks, shards, changes[k]);
				break;

			case "multi-split":
				revertMultiSplit(chunks, shards, changes[k]);
				break;

			case "split":
				revertSplit(chunks, shards, changes[k]);
				break;
		}

		console.log(Object.keys(chunks).length);
	}

	console.log(chunks);
}

MongoClient.connect(url, function (err, db)
{
	chunks = {};
	shards = {};
	changes = [];

	if (err)
		console.log('Unable to connect to the mongoDB server. Error:', err);
	else
	{
		var chunkcoll = db.collection('chunks');
		var stream = chunkcoll.find({ ns : "bootcamp.twitter" }).stream();

		stream.on("data", addChunk);

	    var changecoll = db.collection('changelog');
	    stream = changecoll.find({ ns : "bootcamp.twitter", what : /moveChunk|split/ }).sort({ _id : -1 }).stream();

	    stream.on("data", addChange);
	    stream.on("end", rewind);
	}
});

