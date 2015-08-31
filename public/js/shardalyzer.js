
var	OP_SPLIT = "split", OP_MULTI_SPLIT = "multi-split",
	OP_START = "moveChunk.start", OP_TO = "moveChunk.to",
	OP_COMMIT = "moveChunk.commit", OP_FROM = "moveChunk.from";

var	SOURCE = ".source", DESTINATION = ".dest",
	SUCCESS = ".success", FAILURE = ".fail";

var	STATUS_START_SOURCE = OP_START + SOURCE, STATUS_START_DEST = OP_START + DESTINATION,
	STATUS_TO_SOURCE = OP_TO + SOURCE, STATUS_TO_DEST = OP_TO + DESTINATION,
	STATUS_FROM_SUCCESS = OP_FROM + SUCCESS, STATUS_FROM_FAILURE = OP_FROM + FAILURE,
	STATUS_COMMIT = OP_COMMIT;

var	STATUS_SPLIT_SOURCE = OP_SPLIT + SOURCE, STATUS_SPLIT_DEST = OP_SPLIT + DESTINATION,
	STATUS_MULTI_SPLIT_SOURCE = OP_MULTI_SPLIT + SOURCE,
	STATUS_MULTI_SPLIT_DEST = OP_MULTI_SPLIT + DESTINATION;

var statuscolors = {};

statuscolors[STATUS_MULTI_SPLIT_SOURCE] = '#FFB347', statuscolors[STATUS_MULTI_SPLIT_DEST] = '#D19036',
statuscolors[STATUS_SPLIT_SOURCE] = '#FFB347', statuscolors[STATUS_SPLIT_DEST] = '#D19036',
statuscolors[STATUS_START_SOURCE] = '#AAEEAA', statuscolors[STATUS_START_DEST] = '#AAAAAA',
statuscolors[STATUS_TO_SOURCE] = '#55CC55', statuscolors[STATUS_TO_DEST] = '#AAAAAA',
statuscolors[STATUS_FROM_SUCCESS] = '#00AA00', statuscolors[STATUS_FROM_FAILURE] = '#EE0000',
statuscolors[STATUS_COMMIT] = '#0000AA',
statuscolors.undefined = '#AEC6CF';

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

function sortObject(obj)
{
	var sorted = [];

	for(var k in obj)
		sorted.push(k);

	sorted.sort();

	var newObj = {};

	for(var k in sorted)
		newObj[sorted[k]] = obj[sorted[k]];

	return newObj;
}

function success(change)
{
	// absence of "note" field is interpreted as success (as in 2.6)
	return (change.details.note === undefined || change.details.note === "success");
}

var Shardalyzer =
{
	shards : {},
	chunks : {},
	changes : [],
	position : undefined,

	initialize : function(chunkdata, changedata)
	{
		this.changes = changedata;

		this.shards = {};
		this.chunks = {};

		var currentmove = {};

		for(var k in chunkdata)
		{
			var chunk = chunkdata[k];

			if(!(chunk.shard in this.shards))
				this.shards[chunk.shard] = [];

			this.shards[chunk.shard].push(chunk);
			this.chunks[s(chunk.min)] = chunk;
		}

		// iterate from end to start, i.e. in chronological order
		// populate "from" & "to" fields in 2.6 moveChunk.from
		for(var i = this.changes.length-1; i >= 0; i--)
		{
			if(this.changes[i].what == OP_COMMIT)
			{
				currentmove.from = this.changes[i].details.from;
				currentmove.to = this.changes[i].details.to;

				// chunks may have been on shards in past that are empty
				// in current chunklist; add them to the shard list
				if(!(currentmove.from in this.shards))
					this.shards[currentmove.from] = [];

				if(!(currentmove.to in this.shards))
					this.shards[currentmove.to] = [];
			}
			else if(this.changes[i].what == OP_FROM && this.changes[i].details.from == undefined)
			{
				if(currentmove.from !== undefined)
				{
					this.changes[i].details.from = currentmove.from;
					this.changes[i].details.to = currentmove.to;

					currentmove.from = currentmove.to = undefined;
				}
				else if(success(this.changes[i])) // change is not reproducible
					this.changes.splice(i, 1);
			}
		}

		// sort shard map by shard name
		this.shards = sortObject(this.shards);

		this.position = (changedata.length > 0 ? 0 : undefined);
		this.statuscolors = statuscolors;

		if(this.canRewind())
			this.tag(this.chunks, this.changes[0]);
	},

	reset : function()
	{
		this.initialize([], []);
	},

	// ns-minkey0_val-minkeyN_val
	generateChunkId : function(ns, minShardKey)
	{
		// generate the ID of the new chunk
		var newId = ns;

		// iterates in correct shardkey order
		for(var k in minShardKey)
			newId = newId.concat("-").concat(k).concat("_").concat(s(minShardKey[k]));

		newId = newId.replace(/"/g, "");

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

		if(success(change))
		{
			remove(shards[from], chunk);
			shards[to].push(chunk);
			chunk.shard = to;
			//chunk.lastmodUnmove(0);
		}
	},

	revertMoveFrom : function(chunks, shards, change)
	{
		var from = change.details.from;
		var to = change.details.to

		var chunk = chunks[s(change.details.min)];

		if(success(change))
		{
			remove(shards[to], chunk);
			shards[from].unshift(chunk);
			chunk.shard = from;
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
/*		var from = change.details.from;
		var to = change.details.to;

		// get relevant chunk
		var chunk = chunks[s(change.details.min)];
		chunk.shard = to;
		//chunk.lastmodMove(0);

		// TODO: dupe chunk, put it in dest shard, tag as START_DEST for vis

		// move the chunk from one shard to the other
		remove(shards[from], chunk);
		shards[to].push(chunk);
*/
	},

	revertMoveStart : function(chunks, shards, change)
	{
/*
		var from = change.details.from;
		var to = change.details.to;

		// get relevant chunk
		var chunk = chunks[s(change.details.min)];
		chunk.shard = from;
		//chunk.lastmodUnmove(0);

		// restore the chunk to the original shard
		remove(shards[to], chunk);
		shards[from].push(chunk);
*/
	},

	applyMoveTo : function(chunks, shards, change)
	{
		// nothing to do here at present
	},

	revertMoveTo : function(chunks, shards, change)
	{
		// nothing to do here at present
	},

	applyMoveCommit : function(chunks, shards, change)
	{
		// nothing to do here at present
	},

	revertMoveCommit : function(chunks, shards, change)
	{
		// nothing to do here at present
	},

	tag : function(chunks, change)
	{
		switch(change.what)
		{
			case OP_START:
				chunks[s(change.details.min)].status = STATUS_START_SOURCE;
				break;

			case OP_FROM:
				chunks[s(change.details.min)].status =
					(success(change) ? STATUS_FROM_SUCCESS : STATUS_FROM_FAILURE);

				break;

			case OP_TO:
				chunks[s(change.details.min)].status = STATUS_TO_SOURCE;
				break;

			case OP_COMMIT:
				chunks[s(change.details.min)].status = STATUS_COMMIT;
				break;

			case OP_MULTI_SPLIT:

				var before = change.details.before;
				var newMeta = change.details.chunk;

				chunks[s(before.min)].status = STATUS_MULTI_SPLIT_SOURCE;

				// don't tag if splitNum == 1; both chunk refs same
				if(change.details.number > 1)
					chunks[s(newMeta.min)].status = STATUS_MULTI_SPLIT_DEST;

				break;

			case OP_SPLIT:

				var left = change.details.left;
				var right = change.details.right;

				chunks[s(left.min)].status = STATUS_SPLIT_SOURCE;
				chunks[s(right.min)].status = STATUS_SPLIT_DEST;

				break;
		}
	},

	untag : function(chunks, change)
	{
		switch(change.what)
		{
			case OP_START:
				delete chunks[s(change.details.min)].status;
				break;

			case OP_FROM:
				delete chunks[s(change.details.min)].status;
				break;

			case OP_TO:
				delete chunks[s(change.details.min)].status;
				break;

			case OP_COMMIT:
				delete chunks[s(change.details.min)].status;
				break;

			case OP_MULTI_SPLIT:

				var before = change.details.before;
				var newMeta = change.details.chunk;

				delete chunks[s(before.min)].status;
				delete chunks[s(newMeta.min)].status;

				break;

			case OP_SPLIT:

				var left = change.details.left;
				var right = change.details.right;

				delete chunks[s(left.min)].status;
				delete chunks[s(right.min)].status;

				break;
		}
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
			this.untag(this.chunks, this.changes[this.position]);

			switch(this.changes[this.position].what)
			{
				case OP_START:
					this.revertMoveStart(this.chunks, this.shards, this.changes[this.position]);
					break;

				case OP_FROM:
					this.revertMoveFrom(this.chunks, this.shards, this.changes[this.position]);
					break;

				case OP_TO:
					this.revertMoveTo(this.chunks, this.shards, this.changes[this.position]);
					break;

				case OP_COMMIT:
					this.revertMoveCommit(this.chunks, this.shards, this.changes[this.position]);
					break;

				case OP_MULTI_SPLIT:
					this.revertMultiSplit(this.chunks, this.shards, this.changes[this.position]);
					break;

				case OP_SPLIT:
					this.revertSplit(this.chunks, this.shards, this.changes[this.position]);
					break;
			}

			this.position++;

			if(this.position < this.changes.length)
				this.tag(this.chunks, this.changes[this.position]);
		}
	},

	fastforward : function()
	{
		if(this.canFastForward())
		{
			if(this.position < this.changes.length)
				this.untag(this.chunks, this.changes[this.position]);

			switch(this.changes[--this.position].what)
			{
				case OP_START:
					this.applyMoveStart(this.chunks, this.shards, this.changes[this.position]);
					break;

				case OP_FROM:
					this.applyMoveFrom(this.chunks, this.shards, this.changes[this.position]);
					break;

				case OP_TO:
					this.applyMoveTo(this.chunks, this.shards, this.changes[this.position]);
					break;

				case OP_COMMIT:
					this.applyMoveCommit(this.chunks, this.shards, this.changes[this.position]);
					break;

				case OP_MULTI_SPLIT:
					this.applyMultiSplit(this.chunks, this.shards, this.changes[this.position]);
					break;

				case OP_SPLIT:
					this.applySplit(this.chunks, this.shards, this.changes[this.position]);
					break;
			}

			this.tag(this.chunks, this.changes[this.position]);
		}
	},

	bttf : function(instant)
	{
		while(this.position !== undefined && instant >= 0 && instant <= this.changes.length && instant !== this.position)
		{
			if(instant > this.position)
				this.rewind();
			else
				this.fastforward();
		}
	}
};
