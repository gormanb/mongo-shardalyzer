
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

    // "text" field is actually chunk object
    var text = JSON.stringify(tooltip.text, null, 2);

    // set text content
    tooltipEl.html("<pre>".concat(text).concat("</pre>"));

    // get y-location of tooltip
    var top = tooltip.y + tooltip.caretHeight + tooltip.caretPadding;

/*
    if (tooltip.yAlign == 'above') {
        top = tooltip.y - tooltip.caretHeight - tooltip.caretPadding;
    } else {
        top = tooltip.y + tooltip.caretHeight + tooltip.caretPadding;
    }
*/

    // set position and display
    tooltipEl.css({
        opacity: 1,
        visibility: 'visible',
        left: tooltip.chart.canvas.offsetParent.offsetLeft + tooltip.chart.canvas.offsetLeft + tooltip.x + 'px',
        top: tooltip.chart.canvas.offsetParent.offsetTop + tooltip.chart.canvas.offsetTop + top + 'px',
        fontFamily: tooltip.fontFamily,
        fontSize: tooltip.fontSize,
        fontStyle: tooltip.fontStyle,
    });
};