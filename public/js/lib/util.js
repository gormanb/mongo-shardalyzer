
var usingExcanvas = typeof window.G_vmlCanvasManager === 'object' &&
  window.G_vmlCanvasManager !== null &&
  typeof window.G_vmlCanvasManager.initElement === 'function';

function rgba (color, alpha) {
  if (usingExcanvas) {
    // rgba not supported by IE8
    return 'rgb(' + color.join(',') + ')';
  } else {
    return 'rgba(' + color.concat(alpha).join(',') + ')';
  }
}

// Credit: http://stackoverflow.com/a/11508164/1190235
function hexToRgb (hex) {
  var bigint = parseInt(hex, 16),
    r = (bigint >> 16) & 255,
    g = (bigint >> 8) & 255,
    b = bigint & 255;

  return [r, g, b];
}

function sum(arr)
{
	return arr.length == 0 ? NaN :
		arr.reduce(function(a, b) { return (a || 0) + (b || 0) }, 0);
}
