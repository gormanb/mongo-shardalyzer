
var shardSegmentTooltipRaw = function(point, event)
{
	var tooltipEl = $('#chartjs-tooltip-shardalyzer');

	if (!point || !point._model.label) {
		tooltipEl.css({
			opacity: 0
		});
		return;
	}

	//$(this._chart.canvas).css('cursor', 'pointer');

	// align to cursor
	tooltipEl.removeClass('above below');
	tooltipEl.addClass('center');

	var splits = Shardalyzer.splitcount;
	var shards = Shardalyzer.shards;

	var info = point._model.label;

	// "text" field is actually [shard, lowerinc, upperex]
	var	shard = info[0],
		lower = info[1],
		upper = info[2];

	var numChunks = (upper-lower);
	var text;

	// split count dataset has index 1
	if(point._datasetIndex == 1)
		text = JSON.stringify({ splits : splits[shard], of : splits.totalsplits }, null, 2);
	else if(numChunks == 1)
		text = JSON.stringify(shards[shard][lower], null, 2);
	else
	{
		var chunks = {};
		chunks._ids = [];

		for(var i = 0; i < numChunks && i < 10; i++)
			chunks._ids.push(shards[shard][lower+i]._id);

		if(numChunks > 10)
			chunks.more = numChunks-10;

		text = JSON.stringify(chunks, null, 2);
	}

	// set text content
	tooltipEl.html("<pre>" + text + "</pre>");

	// reposition tooltip based on parent containers' offsets
	var top = event.offsetY + event.target.offsetTop;
	var left = event.offsetX + event.target.offsetLeft;

	// reposition tooltip based on parent containers' offsets
	var canvas = point._chart.canvas;

	top +=
		canvas.offsetTop
		+ canvas.offsetParent.offsetTop
		- canvas.offsetParent.parentElement.parentElement.scrollTop;

	left +=
		canvas.offsetLeft + canvas.offsetParent.offsetLeft

	// set position and display
	tooltipEl.css({
		opacity: 1,
		visibility: 'visible',
		left: left + 'px',
		top: top + 'px'
	});
};

var migrateGraphTooltipRaw = function(point, migrations, event)
{
	var tooltipEl = $('#chartjs-tooltip-shardalyzer');

	if (!point) {
		tooltipEl.css({
			opacity: 0
		});
		return;
	}

	// align to cursor
	tooltipEl.removeClass('above below');
	tooltipEl.addClass('above center');

	var idx = Shardalyzer.changes.length - (point._index+1);

	var moveTime = Shardalyzer.migrations[idx][MIGRATE_TIME];
	var moveCommit = Shardalyzer.migrations[idx][OP_COMMIT];
	var moveFrom = Shardalyzer.migrations[idx][OP_FROM];

	var text =
	{
		time : moveFrom.time,
		clonedBytes : moveCommit.details.clonedBytes,
		from : moveFrom.details.from,
		to : moveFrom.details.to
	};

	var steptimes = migratesteps(moveFrom);

	for(var i in steptimes)
		text["F" + i] = steptimes[i];

	text["Total"] = moveTime;

	// set text content
	tooltipEl.html("<pre>" + JSON.stringify(text, null, 2) + "</pre>");

	var caretOffset = 20;

	// reposition tooltip based on parent containers' offsets
	var top = event.offsetY - caretOffset + event.target.offsetTop;
	var left = event.offsetX + event.target.offsetLeft;

	// set position and display
	tooltipEl.css({
		opacity: 1,
		visibility: 'visible',
		left: left + 'px',
		top: top + 'px'
	});
}