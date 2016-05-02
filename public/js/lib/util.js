
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

function rgbToHex(rgb)
{
	var output = "#";

	for(var c in rgb)
	{
		var comp = rgb[c].toString(16);

		output += (comp.length == 1 ? "0" + comp : comp);
	}

	return output;
}

// sum all elements of an array
function sum(arr)
{
	return arr.length == 0 ? NaN :
		arr.reduce(function(a, b) { return (a || 0) + (b || 0) }, 0);
}

// merge one array into another
function merge(arr1, arr2, owfunc)
{
	for(var m in arr2)
	{
		if(!(m in arr1) || !owfunc || owfunc(arr1[m], arr2[m]))
			arr1[m] = arr2[m];
	}
}

function gradient(start, end, percent)
{
	var output = [];

	for(var i = 0; i < 3; i++)
		output[i] = Math.round(start[i] + (end[i] - start[i]) * percent);

	// var alpha = start[3] ? Math.round(start[3] + (end[3] - start[3]) * percent) : 1;

	return rgbToHex(output);
}
