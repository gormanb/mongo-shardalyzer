
var shardSegmentTooltipRaw = function(point, event)
{
	var tooltipEl = $('#chartjs-tooltip-shardalyzer');

	if (!point) {
		tooltipEl.css({
			opacity: 0
		});
		return;
	}

	//$(this._chart.canvas).css('cursor', 'pointer');

	// align to cursor
	tooltipEl.removeClass('above below');
	tooltipEl.addClass('center');

	var shards = Shardalyzer.shards;

	var info = point._model.label;

	// "text" field is actually [shard, lowerinc, upperex]
	var	shard = info[0],
		lower = info[1],
		upper = info[2];

	var numChunks = (upper-lower);
	var text;

	if(numChunks == 1)
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

	var idx = point._index;

	var change = Shardalyzer.changes[Shardalyzer.changes.length - (idx+1)];

	var text = { time : change.time, from : change.details.from, to : change.details.to };

	for(var i = 0; i < 6; i++)
		text["F" + (i+1)] = migrations[i][idx];

	text["Total"] = migrations[6][idx];

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