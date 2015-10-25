
Chart.defaults.global.customTooltips = function(tooltip)
{
	var tooltipEl = $('#chartjs-tooltip-shard');

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

	var text;

	if(upper - lower == 1)
		text = JSON.stringify(shards[shard][lower], null, 2);
	else if(upper-lower <= 10)
	{
		var docs = {};
		docs._ids = [];

		for(var i = lower; i < upper; i++)
			docs._ids.push(shards[shard][i]._id);

		text = JSON.stringify(docs, null, 2);
	}
	else
		text = (upper - lower) + " docs";

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