
var last_tt = undefined;

Chart.defaults.global.customTooltips = function(tooltip)
{
	var obj = (tooltip ? JSON.parse(tooltip.text) : last_tt !== undefined ? JSON.parse(last_tt.text) : undefined);
	var tooltipEl = (obj !== undefined ? $('#chartjs-tooltip-'.concat(obj.shard)) : undefined);

	// Hide if no tooltip
    if (!tooltip)
    {
    	if(tooltipEl !== undefined)
    		tooltipEl.css({ opacity: 0 });

    	return;
    }

    last_tt = tooltip;

    // Set caret Position
    tooltipEl.removeClass('above below');
    tooltipEl.addClass(tooltip.yAlign);
    // Set Text
    tooltipEl.html("<pre>".concat(tooltip.text).concat("</pre>"));
    // Find Y Location on page
    var top;
    if (tooltip.yAlign == 'above') {
        top = tooltip.y - tooltip.caretHeight - tooltip.caretPadding;
    } else {
        top = tooltip.y + tooltip.caretHeight + tooltip.caretPadding;
    }
    // Display, position, and set styles for font
    tooltipEl.css({
        opacity: 1,
        left: tooltip.chart.canvas.offsetLeft + tooltip.x + 'px',
        top: tooltip.chart.canvas.offsetTop + top + 'px',
        fontFamily: tooltip.fontFamily,
        fontSize: tooltip.fontSize,
        fontStyle: tooltip.fontStyle,
    });
};