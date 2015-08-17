
var shardalyze = angular.module('shardalyzer-ui', ['chart.js', 'ui.bootstrap', 'ui.bootstrap-slider', 'jsonFormatter', 'angular-growl', 'ngAnimate']).run
(
	function($rootScope)
	{
		$rootScope.mongo = {};

		// initial settings
		$rootScope.mongo.host = "localhost";
		$rootScope.mongo.port = 27017;

		$rootScope.mongo.ui = {};

		$rootScope.mongo.ui.selectedchange = "0";
		$rootScope.mongo.ui.changelog = [];
		$rootScope.mongo.ui.logwindow = 25;
		$rootScope.mongo.ui.errors = [];
		$rootScope.mongo.ui.slider = 0;

		$rootScope.mongo.shardalyzer = Shardalyzer;
	}
);

shardalyze.config(['growlProvider', function(growlProvider)
{
	growlProvider.globalTimeToLive({success: 5000, error: 5000, warning: 5000, info: 5000});
	growlProvider.globalDisableCountDown(true);
	/*growlProvider.globalReversedOrder(true);*/
	growlProvider.onlyUniqueMessages(true);
}]);

function growlmsg(headline, source, msg)
{
	return "<b>" + headline + "</b><br><b>" + source + "</b><br><i>" + msg + "</i>";
}

shardalyze.controller('nsList', [ '$scope', '$http', 'growl', function($scope, $http, growl)
{
	$scope.mongo.selectedNS = null;
	$scope.mongo.nsList = [];

	var updateNSList = function(selected)
	{
		$scope.mongo.selectedNS = null;

		var url = '/mongo/namespaces/'
			.concat($scope.mongo.host).concat('/').concat($scope.mongo.port);

		$http
		({
			method: 'GET',
			url: url
		})
		.success
		(
			function(result)
			{
				$scope.mongo.nsList = result;
			}
		)
		.error
		(
			function(err)
			{
				growl.error(growlmsg("Failed to get namespace list",
					$scope.mongo.host + ":" + $scope.mongo.port, err.message));

				$scope.mongo.nsList = [];
			}
		);
	};

	$scope.$watch('mongo.host', updateNSList);
	$scope.$watch('mongo.port', updateNSList);

	$scope.$watch('mongo.selectedNS', function(selected)
	{
		var url = '/mongo/metadata/'
			.concat($scope.mongo.host).concat('/')
				.concat($scope.mongo.port).concat('/')
					.concat($scope.mongo.selectedNS);

		$http
		({
			method: 'GET',
			url: url
		})
		.success
		(
			function(result)
			{
				$scope.mongo.metadata = result;
				$scope.mongo.shardalyzer.initialize(result.chunks, result.changelog);
			}
		)
		.error
		(
			function(err)
			{
				growl.error(growlmsg("Failed to retrieve data",
					$scope.mongo.host + ":" + $scope.mongo.port + "/" + $scope.mongo.selectedNS, err.message));
			}
		);
	});
}]);

shardalyze.controller("updateCharts", function($scope)
{
	$scope.chartmeta = {};

	$scope.$watch('mongo.shardalyzer.position', function(position)
	{
		$scope.chartmeta.data = {};
		$scope.chartmeta.labels = {};
		$scope.chartmeta.colors = {};

		var shards = $scope.mongo.shardalyzer.shards;

		for(var s in shards)
		{
			$scope.chartmeta.data[s] = [];
			$scope.chartmeta.labels[s] = [];
			$scope.chartmeta.colors[s] = [];

			for(var chunk in shards[s])
			{
				var color = $scope.mongo.shardalyzer.statuscolors[shards[s][chunk].status];
				var label = JSON.stringify(shards[s][chunk], null, 2);

				$scope.chartmeta.data[s].push(1);
				$scope.chartmeta.labels[s].push(label);
				$scope.chartmeta.colors[s].push(color);
			}

			if($scope.chartmeta.data[s].length == 0)
			{
				$scope.chartmeta.data[s].push(1);
				$scope.chartmeta.labels[s].push('Empty');
				$scope.chartmeta.colors[s].push('#EEEEEE');
			}
		}

		if(position == undefined)
		{
	    	  $scope.chartmeta.options.animateRotate = true;
	    	  $scope.chartmeta.options.animationSteps = 125;
		}
	});

	// Chart.js Options
    $scope.chartmeta.options =
    {
      responsive: true,

      segmentShowStroke : true,
      segmentStrokeColor : '#fff',
      segmentStrokeWidth : 1,

      percentageInnerCutout : 75, // This is 0 for Pie charts

      animationEasing : 'easeOutQuint',
      animationSteps : 125,
      animateRotate : true,
      animateScale : false,

      legendTemplate : '',

      tooltipTemplate : function(label)
      {
    	  return label.label;
      },

      // disable animation after initial loading
      onAnimationProgress : function()
      {
    	  $scope.chartmeta.options.animateRotate = false;
    	  $scope.chartmeta.options.animationSteps = 1;
      }
    };
});

shardalyze.controller("sliderControl", function($scope)
{
	$scope.slidermeta = {};

	$scope.slidermeta.min = 0;
	$scope.slidermeta.max = 0;

	$scope.mongo.ui.errors = [];
	$scope.slidermeta.snap = 30;

	$scope.slidermeta.formatter = function(value)
	{
		if($scope.mongo.shardalyzer.changes[value] !== undefined)
			return $scope.mongo.shardalyzer.changes[value].time;
		else
			return value;
	};

	$scope.$watch('mongo.ui.slider', function(position)
	{
		$scope.mongo.shardalyzer.bttf(position);

		var changes = $scope.mongo.shardalyzer.changes;
		var window = $scope.mongo.ui.logwindow;
		var offset = Math.floor(window / 2);

		var start = Math.max(Math.min(position, changes.length-offset)-offset, 0);
		var end = Math.max(Math.min(position+offset, changes.length), window);

		$scope.mongo.ui.selectedchange = (position - start).toString();

		for(var k = 0; k < (end-start); k++)
		{
			if(changes[start + k] !== undefined)
				$scope.mongo.ui.changelog[k] = changes[start + k];
		}
	});

	$scope.$watch('mongo.shardalyzer.changes.length', function(length)
	{
		$scope.slidermeta.max = $scope.mongo.shardalyzer.changes.length;
		$scope.mongo.ui.slider = 0;

		$scope.mongo.ui.errors = [];
		$scope.slidermeta.ticklabels = [];

		for(var i in $scope.mongo.shardalyzer.changes)
		{
			var change = $scope.mongo.shardalyzer.changes[i];

			if(change.details.note === "aborted")
			{
				$scope.mongo.ui.errors.push(i);
				$scope.slidermeta.ticklabels.push(i);
			}
		}

		if($scope.mongo.ui.errors[0] !== 0)
		{
			$scope.slidermeta.ticklabels.unshift("");
			$scope.mongo.ui.errors.unshift(0);
		}

		if($scope.mongo.ui.errors[$scope.mongo.ui.errors.length-1] !== $scope.slidermeta.max)
		{
			$scope.mongo.ui.errors.push($scope.slidermeta.max);
			$scope.slidermeta.ticklabels.push("");
		}
	});
});

shardalyze.controller("playControl", ['$scope', '$interval', function($scope, $interval)
{
	var updateSlider = function(offset)
	{
		var newpos = $scope.mongo.ui.slider + offset;

		if(newpos >= 0 && newpos <= $scope.mongo.shardalyzer.changes.length)
			$scope.mongo.ui.slider = newpos;
	}

	$scope.playctrl =
	{
		playing : 0,
		promise : null,

		cancel : function()
		{
			$interval.cancel(this.promise);
			this.promise = null;
			this.playing = 0;
		},

		play : function(dir)
		{
			if(this.playing == dir)
			{
				// already playing in this direction, so pause and return
				this.cancel();
				return;
			}
			else if(this.playing !== 0) // playing in opposite direction, so cancel
				this.cancel();

			this.promise = $interval(updateSlider, 100, 0, true, dir);
			this.playing = dir;
		},

		start : function()
		{
			this.cancel();
			updateSlider(-$scope.mongo.ui.slider);
		},

		forwardError : function()
		{
			var pos = $scope.mongo.ui.errors.filter(function(value) { return value < $scope.mongo.ui.slider; });

			if(pos.length > 0)
			{
				pos = pos[pos.length-1];
				updateSlider(-($scope.mongo.ui.slider - pos));
			}
		},

		fastforward : function()
		{
			this.play(-1);
		},

		forward : function()
		{
			this.cancel();
			updateSlider(-1);
		},

		back : function()
		{
			this.cancel();
			updateSlider(1);
		},

		rewind : function()
		{
			this.play(1);
		},

		backError : function()
		{
			var pos = $scope.mongo.ui.errors.filter(function(value) { return value > $scope.mongo.ui.slider; });

			if(pos.length > 0)
			{
				pos = pos[0];
				updateSlider(pos - $scope.mongo.ui.slider);
			}
		},

		end : function()
		{
			this.cancel();
			updateSlider($scope.mongo.shardalyzer.changes.length - $scope.mongo.ui.slider)
		}
	}
}]);

shardalyze.controller("changelogControl", function($scope)
{
	// nothing to do at present
});

function quote(jsol)
{
	jsol = jsol.replace(/\s/g, "");

	jsol = jsol.replace(/\{/g, "{\"")
		.replace(/,/g, ",\"")
		.replace(/\:/g, "\":")
		.replace(/\"\"/g, "\"")
		.replace(/,\"\{/g, ",{")
		.replace(/\{\"\}/g, "{}");

	return jsol;
}

shardalyze.controller("queryCtrl", [ '$scope', '$http', 'growl', function($scope, $http, growl)
{
	$scope.query = {};

	$scope.query.result = undefined;
	$scope.query.query = undefined;

	$scope.query.submit = function()
	{
		var url = '/mongo/query/'
			.concat($scope.mongo.host).concat('/').concat($scope.mongo.port)
				.concat('/config/changelog/').concat(quote($scope.query.query));

		$http
		({
			method: 'GET',
			url: url
		})
		.success
		(
			function(result)
			{
				$scope.query.result = JSON.stringify(result, null, 2);
			}
		)
		.error
		(
			function(err)
			{
				growl.error(growlmsg("Query failed", $scope.mongo.host + ":" +
					$scope.mongo.port + "/" + $scope.mongo.selectedNS, err.message));
			}
		);
	};
}]);