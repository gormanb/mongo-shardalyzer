/*
 * Modified from https://github.com/jtblin/angular-chart.js for Shardalyzer performance.
 * Credit to @jtblin
 */

(function (factory) {
  'use strict';
  if (typeof exports === 'object') {
    // Node/CommonJS
    module.exports = factory(
      typeof angular !== 'undefined' ? angular : require('angular'),
      typeof Chart !== 'undefined' ? Chart : require('chart.js'));
  }  else if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['angular', 'chart'], factory);
  } else {
    // Browser globals
    if (typeof angular === 'undefined' || typeof Chart === 'undefined')
      throw new Error('Chart.js library needs to be included, see http://jtblin.github.io/angular-chart.js/');
    factory(angular, Chart);
  }
}(function (angular, Chart) {
  'use strict';

  Chart.defaults.global.multiTooltipTemplate = '<%if (datasetLabel){%><%=datasetLabel%>: <%}%><%= value %>';
  Chart.defaults.global.colors = [
    '#97BBCD', // blue
    '#DCDCDC', // light grey
    '#F7464A', // red
    '#46BFBD', // green
    '#FDB45C', // yellow
    '#949FB1', // grey
    '#4D5360'  // dark grey
  ];

  var useExcanvas = typeof window.G_vmlCanvasManager === 'object' &&
    window.G_vmlCanvasManager !== null &&
    typeof window.G_vmlCanvasManager.initElement === 'function';

  if (useExcanvas) Chart.defaults.global.animation = false;

  return angular.module('chart.js', [])
    .provider('ChartJs', ChartJsProvider)
    .factory('ChartJsFactory', ['ChartJs', '$timeout', ChartJsFactory])
    .directive('chartBase', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory(); }])
    .directive('chartLine', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('line'); }])
    .directive('chartScatter', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('scatter'); }])
    .directive('chartBar', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('bar'); }])
    .directive('chartHorizontalBar', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('horizontalBar'); }])
    .directive('chartRadar', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('radar'); }])
    .directive('chartDoughnut', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('doughnut'); }])
    .directive('chartPie', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('pie'); }])
    .directive('chartPolarArea', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('polarArea'); }])
    .directive('chartBubble', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('bubble'); }])
    .name;

  /**
   * Wrapper for chart.js
   * Allows configuring chart js using the provider
   *
   * angular.module('myModule', ['chart.js']).config(function(ChartJsProvider) {
   *   ChartJsProvider.setOptions({ responsive: false });
   *   ChartJsProvider.setOptions('Line', { responsive: true });
   * })))
   */
  function ChartJsProvider () {
    var options = { responsive: true };
    var ChartJs = {
      Chart: Chart,
      getOptions: function (type) {
        var typeOptions = type && options[type] || {};
        return angular.extend({}, options, typeOptions);
      }
    };

    /**
     * Allow to set global options during configuration
     */
    this.setOptions = function (type, customOptions) {
      // If no type was specified set option for the global object
      if (! customOptions) {
        customOptions = type;
        options = angular.merge(options, customOptions);
      } else {
        // Set options for the specific chart
        options[type] = angular.merge(options[type] || {}, customOptions);
      }

      angular.merge(ChartJs.Chart.defaults, options);
    };

    this.$get = function () {
      return ChartJs;
    };
  }

  function ChartJsFactory (ChartJs, $timeout) {
    return function chart (type) {
      return {
        restrict: 'CA',
        scope: {
          chartGetColor: '=?',
          chartType: '=',
          chartData: '=?',
          chartLabels: '=?',
          chartOptions: '=?',
          chartSeries: '=?',
          chartColors: '=?',
          chartHighlights: '=?',
          chartClick: '=?',
          chartHover: '=?',
          chartDatasetOverride: '=?',
          chartWatch: '=?'
        },
        link: function (scope, elem/*, attrs */) {
          if (useExcanvas) window.G_vmlCanvasManager.initElement(elem[0]);

          scope.$on('$destroy', function () {
            destroyChart(scope);
          });

          scope.$on('$resize', function () {
            if (scope.chart) scope.chart.resize();
          });

          if(!scope.chartWatch)
             scope.chartWatch = { 'chartData' : {}, 'chartDatasetOverride' : {}, 'chartSeries' : {}, 'chartLabels' : {}, 'chartOptions' : {}, 'chartColors' : {} };

          // series, labels, options, colours
          for(var k in scope.chartWatch)
          {
        	  // type, deep boolean, reset boolean
        	  var opts = scope.chartWatch[k];

        	  var updateFunc =
        		opts.reset ? resetChart : refreshChart;

        	  switch(opts.type)
        	  {
        	  	case 'collection':
        	  		scope.$watchCollection(k, updateFunc);
        	  		break;

        	  	case 'group':
        	  		scope.$watchGroup(k, updateFunc, (opts.deep == true));
        	  		break;

        	  	default:
        	  		scope.$watch(k, updateFunc, (opts.deep == true));
        	  }
          }

          // always watch chartType
          scope.$watch('chartType', function (newVal, oldVal) {
            if (isEmpty(newVal)) return;
            if (angular.equals(newVal, oldVal)) return;
            createChart(newVal, scope, elem);
          });

          // used for shard and migration graphs
          function refreshChart(newVal, oldVal)
          {
            if(scope.chart)
            {
            	// requires that all relevant data has been passed by reference to chart.js
            	angular.merge(scope.chart.config.options, scope.chartOptions);
            	scope.chart.update();
            }
            else
            	resetChart(newVal, oldVal);
          }

      	  function resetChart (newVal, oldVal) {
      		if (isEmpty(newVal)) return;

      		var chartType = type || scope.chartType;
      		if (! chartType) return;

      		// chart.update() doesn't work for series and labels
      		// so we have to re-create the chart entirely
      		createChart(chartType, scope, elem);
      	  }
        }
      };
    };

    function createChart (type, scope, elem) {
      var options = scope.chartOptions; //getChartOptions(type, scope);
      destroyChart(scope);

      if (! hasData(scope) || ! canDisplay(type, scope, elem, options)) return;

      var cvs = elem[0];
      var ctx = cvs.getContext('2d');

      scope.chartGetColor = getChartColorFn(scope);
      var data = getChartData(type, scope);

      scope.chart = new ChartJs.Chart(ctx, {
        type: type,
        data: data,
        options: options
      });
      scope.$emit('chart-create', scope.chart);
      bindEvents(cvs, scope);
    }

    function canUpdateChart (newVal, oldVal) {
      if (newVal && oldVal && newVal.length && oldVal.length) {
        return Array.isArray(newVal[0]) ?
        newVal.length === oldVal.length && newVal.every(function (element, index) {
          return element.length === oldVal[index].length; }) :
          oldVal.reduce(sum, 0) > 0 ? newVal.length === oldVal.length : false;
      }
      return false;
    }

    function sum (carry, val) {
      return carry + val;
    }

    function getEventHandler (scope, action, triggerOnlyOnChange) {
      var lastState = null;
      var mode = (action == 'chartHover' ? (scope.chartOptions && scope.chartOptions.hover && scope.chartOptions.hover.mode) || null : null);
  	  var atEvent = (mode == 'single' ? scope.chart.getElementAtEvent : (mode == 'dataset' ? scope.chart.getDatasetAtEvent : scope.chart.getElementsAtEvent));
      return function (evt) {
        if (atEvent) {
          var activePoints = atEvent.call(scope.chart, evt);
          if (triggerOnlyOnChange === false || angular.equals(lastState, activePoints) === false) {
            lastState = activePoints;
            scope[action](activePoints, evt);
          }
        }
      };
    }

    function getColors (type, scope) {
      // pre-prepared colors blob; return as-is and handle later
      if(Array.isArray(scope.chartColors[0]) || scope.chartColors[0] instanceof Object)
    	  return scope.chartColors;

      var colors = angular.copy(scope.chartColors ||
        ChartJs.getOptions(type).chartColors ||
        Chart.defaults.global.colors
      );
      var notEnoughColors = colors.length < scope.chartData.length;
      while (colors.length < scope.chartData.length) {
        colors.push(scope.chartGetColor());
      }
      // mutate colors in this case as we don't want
      // the colors to change on each refresh
      if (notEnoughColors) scope.chartColors = colors;
      return colors.map(convertColor);
    }

    function convertColor (color) {
      if (typeof color === 'object' && color !== null) return color;
      if (typeof color === 'string' && color[0] === '#') return getColor(hexToRgb(color.substr(1)));
      return getRandomColor();
    }

    function getRandomColor () {
      var color = [getRandomInt(0, 255), getRandomInt(0, 255), getRandomInt(0, 255)];
      return getColor(color);
    }

    function getColor (color) {
      return {
        backgroundColor: rgba(color, 1),
        pointBackgroundColor: rgba(color, 1),
        pointHoverBackgroundColor: '#fff',
        borderColor: rgba(color, 1),
        pointBorderColor: '#fff',
        pointHoverBorderColor: rgba(color, 0.8)
      };
    }

    function getRandomInt (min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function rgba (color, alpha) {
      // rgba not supported by IE8
      return useExcanvas ? 'rgb(' + color.join(',') + ')' : 'rgba(' + color.concat(alpha).join(',') + ')';
    }

    // Credit: http://stackoverflow.com/a/11508164/1190235
    function hexToRgb (hex) {
      var bigint = parseInt(hex, 16),
        r = (bigint >> 16) & 255,
        g = (bigint >> 8) & 255,
        b = bigint & 255;

      return [r, g, b];
    }

    function hasData (scope) {
      return scope.chartData && scope.chartData.length;
    }

    function getChartColorFn (scope) {
      return typeof scope.chartGetColor === 'function' ? scope.chartGetColor : getRandomColor;
    }

    function getChartData (type, scope) {
      var data = Array.isArray(scope.chartData[0]) ? // doughnut
        getDataSets(scope.chartLabels, scope.chartData, scope.chartSeries || [], getColors(type, scope), scope.chartHighlights, scope.chartDatasetOverride || []) :
          scope.chartData[0] instanceof Object ? // line
            fillDataSets(scope.chartLabels, scope.chartData, scope.chartSeries || [], getColors(type, scope), scope.chartHighlights, scope.chartDatasetOverride) :
              getData(scope.chartLabels, scope.chartData, scope.chartColors, scope.chartHighlights, scope.chartDatasetOverride); // bar

      return data;
    }

    // array of objects [{ data : [] }], fill in colors & labels
    function fillDataSets(labels, data, series, colors, highlights, datasetOverride)
    {
    	for(var i in data)
    		angular.extend(data[i], colors[i], (highlights ? highlights[i] : {}), (series && i in series ? { label : series[i] } : {}), (datasetOverride && i in datasetOverride ? datasetOverride[i] : {}));

    	return {
    		labels : labels,
    		datasets : data
    	}
    }

    function getDataSets (labels, data, series, colors, highlights, datasetOverride) {
      return {
        labels: labels,
        datasets: data.map(function (item, i) {
          var dataset = angular.extend({},
        	(Array.isArray(colors[i]) ? { backgroundColor : colors[i] } : colors[i]),
        	(highlights ? (Array.isArray(highlights[i]) ? { hoverBackgroundColor : highlights[i] } : highlights[i]) : {}), {
            label: (series ? series[i] : null),
            data: item
          });
          if (datasetOverride && datasetOverride.length >= i) {
            angular.merge(dataset, datasetOverride[i]);
          }
          return dataset;
        })
      };
    }

    // colors is array of hex strings
    function getData (labels, data, colors, highlights, datasetOverride) {
      var dataset = {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          hoverBackgroundColor: highlights || colors.map(function (color) {
          	return (typeof color === 'string' ? rgba(hexToRgb(color.substr(1)), 0.8) : color.backgroundColor);
          })
        }]
      };
      if (datasetOverride) {
        angular.merge(dataset.datasets[0], datasetOverride);
      }
      return dataset;
    }

    function getChartOptions (type, scope) {
      return angular.extend({}, ChartJs.getOptions(type), scope.chartOptions);
    }

    function bindEvents (cvs, scope) {
      cvs.onclick = scope.chartClick ? getEventHandler(scope, 'chartClick', false) : angular.noop;
      cvs.onmousemove = scope.chartHover ? getEventHandler(scope, 'chartHover', true) : angular.noop;
    }

    function updateChart (values, scope) {
      if (Array.isArray(scope.chartData[0])) {
        scope.chart.data.datasets.forEach(function (dataset, i) {
          dataset.data = values[i];
        });
      } else {
        scope.chart.data.datasets[0].data = values;
      }

      scope.chart.update();
      scope.$emit('chart-update', scope.chart);
    }

    function isEmpty (value) {
      return ! value ||
        (Array.isArray(value) && ! value.length) ||
        (typeof value === 'object' && ! Object.keys(value).length);
    }

    function canDisplay (type, scope, elem, options) {
      // TODO: check parent?
      if (options.responsive && elem[0].clientHeight === 0) {
        $timeout(function () {
          createChart(type, scope, elem);
        }, 50, false);
        return false;
      }
      return true;
    }

    function destroyChart(scope) {
      if(! scope.chart) return;
      scope.chart.destroy();
      scope.$emit('chart-destroy', scope.chart);
    }
  }
}));
