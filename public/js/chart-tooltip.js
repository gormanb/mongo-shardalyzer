Chart.defaults.global.customTooltips = function(tooltip)
{
	// Tooltip Element
    var tooltipEl = $('#chartjs-tooltip');
    // Hide if no tooltip
    if (!tooltip) {
        tooltipEl.css({
            opacity: 0
        });
        return;
    }
    // Set caret Position
    tooltipEl.removeClass('above below');
    tooltipEl.addClass(tooltip.yAlign);
    // Set Text
    tooltipEl.html(tooltip.text);
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