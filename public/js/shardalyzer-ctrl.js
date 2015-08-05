
var shardalyze = angular.module('shardalyzer-ui', ["chart.js", "ui.bootstrap-slider"]).run
(
	function($rootScope)
	{
		$rootScope.mongo = {};

		// initial settings
		$rootScope.mongo.host = "localhost";
		$rootScope.mongo.port = 27017;

		$rootScope.mongo.ui = {};

		$rootScope.mongo.ui.selectedchange = "0";
		$rootScope.mongo.ui.errors = [];
		$rootScope.mongo.ui.slider = 0;

		$rootScope.mongo.shardalyzer = Shardalyzer;
	}
);

shardalyze.controller('nsList', function($scope, $http)
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
				$scope.mongo.metadata = {};
				$scope.mongo.shardalyzer.initialize([], []);
			}
		);
	});
});

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
				var label = JSON.stringify(shards[s][chunk]);
				var color = $scope.mongo.shardalyzer.statuscolors[shards[s][chunk].status];

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

			if(change.details !== undefined && change.details.note !== undefined && change.details.note !== "success")
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
	$scope.$watch('mongo.ui.slider', function(value)
	{
		$scope.mongo.ui.selectedchange = value.toString();
	});
});