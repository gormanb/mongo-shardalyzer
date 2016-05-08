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

  var usingExcanvas = typeof window.G_vmlCanvasManager === 'object' &&
    window.G_vmlCanvasManager !== null &&
    typeof window.G_vmlCanvasManager.initElement === 'function';

  if (usingExcanvas) Chart.defaults.global.animation = false;

  return angular.module('chart.js', [])
    .provider('ChartJs', ChartJsProvider)
    .factory('ChartJsFactory', ['ChartJs', '$timeout', ChartJsFactory])
    .directive('chartBase', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory(); }])
    .directive('chartLine', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('line'); }])
    .directive('chartBar', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('bar'); }])
    .directive('chartRadar', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('radar'); }])
    .directive('chartDoughnut', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('doughnut'); }])
    .directive('chartPie', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('pie'); }])
    .directive('chartPolarArea', ['ChartJsFactory', function (ChartJsFactory) { return new ChartJsFactory('polarArea'); }]);

  /**
   * Wrapper for chart.js
   * Allows configuring chart js using the provider
   *
   * angular.module('myModule', ['chart.js']).config(function(ChartJsProvider) {
   *   ChartJsProvider.setOptions({ responsive: true });
   *   ChartJsProvider.setOptions('Line', { responsive: false });
   * })))
   */
  function ChartJsProvider () {
    var options = {};
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
        options = angular.extend(options, customOptions);
        return;
      }
      // Set options for the specific chart
      options[type] = angular.extend(options[type] || {}, customOptions);
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
          chartYAxes: '=?',
          chartWatch: '=?'
        },
        link: function (scope, elem/*, attrs */) {
          var chart;

          if (usingExcanvas) window.G_vmlCanvasManager.initElement(elem[0]);

          if(!scope.chartWatch)
             scope.watch = { 'chartData' : false, 'chartSeries' : false, 'chartLabels' : false, 'chartOptions' : false, 'chartColors' : false };

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
            createChart(newVal);
          });

          scope.$on('$destroy', function () {
            destroyChart(chart, scope);
          });

          // only used for shard graphs at present
          function refreshChart(newVal, oldVal)
          {
        	  if(chart)
        	  {
        		  // requires that all relevant data has been passed by reference to chart.js
        		  angular.extend(chart.config.options, scope.chartOptions);
        		  chart.update();
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
            createChart(chartType);
          }

          function createChart (type) {
            destroyChart(chart, scope);

            // TODO: check parent?
            if (isResponsive(type, scope) && elem[0].clientHeight === 0) {
              return $timeout(function () {
                createChart(type);
              }, 50, false);
            }
            if (! scope.chartData || ! scope.chartData.length) return;
            scope.chartGetColor = typeof scope.chartGetColor === 'function' ? scope.chartGetColor : getRandomColor;

            var cvs = elem[0], ctx = cvs.getContext('2d');

            var data = Array.isArray(scope.chartData[0]) ?
              getDataSets(scope.chartLabels, scope.chartData, scope.chartSeries || [], getColors(type, scope), scope.chartYAxes) :
            	scope.chartData[0] instanceof Object ? // line
            	  fillDataSets(scope.chartLabels, scope.chartData, scope.chartSeries || [], getColors(type, scope), scope.chartHighlights) :
            	    getData(scope.chartLabels, scope.chartData, scope.chartColors, scope.chartHighlights); // doughnut, bar

            //var options = angular.extend({}, ChartJs.getOptions(type), scope.chartOptions);

            chart = new ChartJs.Chart(ctx, {
              type: type,
              data: data,
              options: scope.chartOptions
            });
            scope.$emit('chart-create', chart);

            // Bind events
            cvs.onclick = scope.chartClick ? getEventHandler(scope, chart, 'chartClick', false) : angular.noop;
            cvs.onmousemove = scope.chartHover ? getEventHandler(scope, chart, 'chartHover', true) : angular.noop;
          }
        }
      };
    };

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

    function getEventHandler (scope, chart, action, triggerOnlyOnChange) {
      var lastState = null;
      return function (evt) {
        var atEvent = chart.getElementsAtEvent || chart.getPointsAtEvent;
        if (atEvent) {
          var activePoints = atEvent.call(chart, evt);
          if (triggerOnlyOnChange === false || angular.equals(lastState, activePoints) === false) {
            lastState = activePoints;
            scope[action](activePoints, evt);
          }
        }
      };
    }

    function getColors (type, scope) {
      if(scope.chartColors[0] instanceof Object)
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
        borderColor: rgba(color, 1),
        pointBackgroundColor: rgba(color, 1),
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: rgba(color, 0.8)
      };
    }

    function getRandomInt (min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

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

    // array of objects [{ data : [] }], fill in colors & labels
    function fillDataSets(labels, data, series, colors, highlights)
    {
    	for(var i in data)
    		angular.extend(data[i], colors[i], (highlights ? highlights[i] : {}), (i in series ? { label : series[i] } : {}));

    	return {
    		labels : labels,
    		datasets : data
    	}
    }

    function getDataSets (labels, data, series, colors, yaxis) {
      return {
        labels: labels,
        datasets: data.map(function (item, i) {
          var dataset = angular.extend({}, colors[i], {
            label: series[i],
            data: item,
            fill: true
          });
          if (yaxis) {
            dataset.yAxisID = 'y-axis-' + (i + 1);
          }
          return dataset;
        })
      };
    }

    // colors is array of hex strings
    function getData (labels, data, colors, highlights) {
      return {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          hoverBackgroundColor: highlights || colors.map(function (color) {
          	return (typeof color === 'string' ? rgba(hexToRgb(color.substr(1)), 0.8) : color.backgroundColor);
          })
        }]
      };
    }

    function updateChart (chart, values, scope) {
      if (Array.isArray(scope.chartData[0])) {
        chart.data.datasets.forEach(function (dataset, i) {
          dataset.data = values[i];
        });
      } else {
        chart.data.datasets[0].data = values;
      }

      chart.update();
      scope.$emit('chart-update', chart);
    }

    function isEmpty (value) {
      return ! value ||
        (Array.isArray(value) && ! value.length) ||
        (typeof value === 'object' && ! Object.keys(value).length);
    }

    function isResponsive (type, scope) {
      var options = angular.extend({}, Chart.defaults.global, ChartJs.getOptions(type), scope.chartOptions);
      return options.responsive;
    }

    function destroyChart(chart, scope) {
      if(! chart) return;
      chart.destroy();
      scope.$emit('chart-destroy', chart);
    }
  }
}));
