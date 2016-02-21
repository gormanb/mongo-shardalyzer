
var shardSegmentTooltip = function(tooltip)
{
	var tooltipEl = $('#chartjs-tooltip-shardalyzer');

	if (!tooltip) {
		tooltipEl.css({
			opacity: 0
		});
		return;
	}

	// align to cursor
	tooltipEl.removeClass('above below');
	tooltipEl.addClass('center');

	var shards = Shardalyzer.shards;

	// "text" field is actually [shard, lowerinc, upperex]
	var	shard = tooltip.text[0],
		lower = tooltip.text[1],
		upper = tooltip.text[2];

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

	// get location of tooltip
	var top = tooltip.y + tooltip.caretHeight + tooltip.caretPadding;
	var left = tooltip.x;

	// reposition tooltip based on parent containers' offsets

	top +=
		tooltip.chart.canvas.offsetTop
		+ tooltip.chart.canvas.offsetParent.offsetTop
		- tooltip.chart.canvas.offsetParent.parentElement.parentElement.scrollTop;

	left +=
		tooltip.chart.canvas.offsetLeft
		+ tooltip.chart.canvas.offsetParent.offsetLeft

	// set position and display
	tooltipEl.css({
		opacity: 1,
		visibility: 'visible',
		left: left + 'px',
		top: top + 'px',
		fontFamily: tooltip.fontFamily,
		fontSize: tooltip.fontSize,
		fontStyle: tooltip.fontStyle,
	});
};

var migrateGraphTooltipRaw = function(point, event)
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

	var migrations = Shardalyzer.migrations;

	var text = [];

	for(var i = 0; i < 6; i++)
		text[i] = ("F" + (i+1) + ": " + migrations[i][point.label]);

	text[6] = "Total: " + migrations[6][point.label];

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