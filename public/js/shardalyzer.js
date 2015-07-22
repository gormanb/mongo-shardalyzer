
var s = JSON.stringify;

function peekBack(array)
{
	return array[array.length-1];
}

function remove(array, object)
{
	var pos = array.indexOf(object);

	if(pos >= 0)
		array.splice(pos, 1);
}

function clone(orig)
{
	return jQuery.extend(true, {}, orig);
}

function putAll(to, from)
{
	for(var prop in from)
	{
	    if(from.hasOwnProperty(prop))
	        to[prop] = from[prop];
	}
}

var Shardalyzer =
{
	shards : {},
	chunks : {},
	changes : [],
	position : 0,
	chunklist : [],

	initialize : function(chunkdata, changedata)
	{
		this.changes = changedata;

		this.shards = {};
		this.chunks = {};

		this.chunklist = [];

		this.position = 0;

		for(var k in chunkdata)
		{
			var chunk = chunkdata[k];

			if(!(chunk.shard in this.shards))
				this.shards[chunk.shard] = [];

			this.shards[chunk.shard].push(chunk);
			this.chunks[s(chunk.min)] = chunk;
		}

		while(this.canRewind())
			this.rewind();

//		while(this.canFastForward())
//			this.fastforward();

		for(var k in this.chunks)
			this.chunklist.push(this.chunks[k]);
	},

	// ns-minkey0_val-minkeyN_val
	generateChunkId : function(ns, minShardKey)
	{
		// generate the ID of the new chunk
		var newId = ns;

		// iterates in correct shardkey order
		for(var k in minShardKey)
			newId = newId.concat("-").concat(k).concat("_").concat(s(minShardKey[k]));

		return newId;
	},

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
	applySplit : function(chunks, shards, change)
	{
		var left = change.details.left;
		var right = change.details.right;
		var before = change.details.before;

		// the original chunk
		var chunk = chunks[s(before.min)];

		// update the source chunk' details
		putAll(chunk, left);

		// create new chunk based on old
		var newChunk = clone(chunk);

		// update the new chunk's details
		putAll(newChunk, right);

		// generate an _id for the new chunk
		newChunk._id = this.generateChunkId(newChunk.ns, newChunk.min);

		// add new chunk to topology
		shards[newChunk.shard].push(newChunk);
		chunks[s(newChunk.min)] = newChunk;
	},

	revertSplit : function(chunks, shards, change)
	{
		var left = change.details.left;
		var right = change.details.right;
		var before = change.details.before;

		var chunk = chunks[s(left.min)];
		var splitChunk = chunks[s(right.min)];

		// remove right chunk...
		remove(shards[splitChunk.shard], splitChunk);
		delete chunks[s(right.min)];

		// ... and revert left
		putAll(chunk, before);
	},

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
	applyMultiSplit : function(chunks, shards, change)
	{
		// the original chunk's metadata
		var before = change.details.before;

		// the original chunk
		var chunk = chunks[s(before.min)];

		// this split's position in the sequence
		var splitNum = change.details.number;

		// get the metadata of the new chunk
		var newMeta = change.details.chunk;
		var newMin = newMeta.min;

		if(splitNum == 1)
			putAll(chunk, newMeta); // split 1 of N updates existing chunk
		else
		{
			// subsequent splits create new chunks
			var newChunk = clone(chunk);
			putAll(newChunk, newMeta);

			// generate an ID for the new chunk
			newChunk._id = this.generateChunkId(chunk.ns, newMin);

			// add new chunk to topology
			shards[newChunk.shard].push(newChunk);
			chunks[s(newChunk.min)] = newChunk;
		}
	},

	revertMultiSplit : function(chunks, shards, change)
	{
		// the original chunk's metadata
		var before = change.details.before;

		// the original chunk
		var chunk = chunks[s(before.min)];

		// this split's position in the sequence
		var splitNum = change.details.number;

		// get the metadata of the new chunk
		var newMeta = change.details.chunk;
		var newMin = newMeta.min;

		// get the child chunk
		var newChunk = chunks[s(newMin)];

		if(splitNum == 1)
		{
			// 2.6 {before} includes original lastmod & Epoch
			// 3.0 omits this information, need to recreate
			chunk.lastmod = newMeta.lastmod;
			//chunk.lastmodUnsplit();

			// revert parent chunk
			putAll(chunk, before);
		}
		else
		{
			// remove the child chunk
			remove(shards[newChunk.shard], newChunk);
			delete chunks[s(newMin)];
		}
	},

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
	applyMoveFrom : function(chunks, shards, change)
	{
		var from = change.details.from;
		var to = change.details.to;

		var chunk = chunks[s(change.details.min)];

		var success =
			(change.details.note == "success");

		if(!success)
		{
			remove(shards[to], chunk);
			shards[from].push(chunk);
			chunk.shard = from;
			//chunk.lastmodUnmove(0);
		}
	},

	revertMoveFrom : function(chunks, shards, change)
	{
		var from = change.details.from;
		var to = change.details.to

		var chunk = chunks[s(change.details.min)];

		var success =
			(change.details.note == "success");

		if(!success)
		{
			// if !success at [t+1], chunk has already been restored to source shard
			// therefore, revert the change by putting it back on the target shard
			remove(shards[from], chunk);
			shards[to].push(chunk);
			chunk.shard = to;
			//chunk.lastmodMove(0);
		}
	},

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
	applyMoveStart : function(chunks, shards, change)
	{
		var from = change.details.from;
		var to = change.details.to;

		// get relevant chunk
		var chunk = chunks[s(change.details.min)];
		chunk.shard = to;
		//chunk.lastmodMove(0);

		// TODO: dupe chunk, put it in dest shard, tag as START_DEST for vis

		// move the chunk from one shard to the other
		remove(shards[from], chunk);
		shards[to].push(chunk);
	},

	revertMoveStart : function(chunks, shards, change)
	{
		var from = change.details.from;
		var to = change.details.to;

		// get relevant chunk
		var chunk = chunks[s(change.details.min)];
		chunk.shard = from;
		//chunk.lastmodUnmove(0);

		// restore the chunk to the original shard
		remove(shards[to], chunk);
		shards[from].push(chunk);
	},

	canFastForward : function()
	{
		return this.changes.length > 0 && this.position > 0;
	},

	canRewind : function()
	{
		return this.changes.length > 0 && this.position < this.changes.length;
	},

	rewind : function()
	{
		if(this.canRewind())
		{
			switch(this.changes[this.position].what)
			{
				case "moveChunk.start":
					this.revertMoveStart(this.chunks, this.shards, this.changes[this.position]);
					break;

				case "moveChunk.from":
					this.revertMoveFrom(this.chunks, this.shards, this.changes[this.position]);
					break;

				case "moveChunk.to":
					//this.revertMoveTo(this.chunks, this.shards, this.changes[this.position]);
					break;

				case "moveChunk.commit":
					//this.revertMoveCommit(this.chunks, this.shards, this.changes[this.position]);
					break;

				case "multi-split":
					this.revertMultiSplit(this.chunks, this.shards, this.changes[this.position]);
					break;

				case "split":
					this.revertSplit(this.chunks, this.shards, this.changes[this.position]);
					break;
			}

			this.position++;
		}
	},

	fastforward : function()
	{
		if(this.canFastForward())
		{
			switch(this.changes[--this.position].what)
			{
				case "moveChunk.start":
					this.applyMoveStart(this.chunks, this.shards, this.changes[this.position]);
					break;

				case "moveChunk.from":
					this.applyMoveFrom(this.chunks, this.shards, this.changes[this.position]);
					break;

				case "moveChunk.to":
					//this.applyMoveTo(this.chunks, this.shards, this.changes[this.position]);
					break;

				case "moveChunk.commit":
					//this.applyMoveCommit(this.chunks, this.shards, this.changes[this.position]);
					break;

				case "multi-split":
					this.applyMultiSplit(this.chunks, this.shards, this.changes[this.position]);
					break;

				case "split":
					this.applySplit(this.chunks, this.shards, this.changes[this.position]);
					break;
			}
		}
	}
};
