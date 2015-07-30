
var shardalyze = angular.module('shard-vis', ["chart.js", "rzModule"]).run
(
	function($rootScope)
	{
		$rootScope.mongo = {};

		// initial settings
		$rootScope.mongo.host = "localhost";
		$rootScope.mongo.port = 27017;

		$rootScope.mongo.slider = 0;

		$rootScope.mongo.shardalyzer = Shardalyzer;
	}
);

shardalyze.controller('nsList', function ($scope, $http)
{
	$scope.mongo.selectedNS = null;
	$scope.mongo.nsList = [];

	var updateNSList = function(selected)
	{
		var url = '/mongo/namespaces/'
			.concat($scope.mongo.host).concat('/').concat($scope.mongo.port);

		$http
		({
			method: 'GET',
			url: url
		})
		.success
		(
			function (result)
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
			function (result)
			{
				$scope.mongo.metadata = result;
				$scope.mongo.shardalyzer.initialize(result.chunks, result.changelog);
			}
		);
	});
});

shardalyze.controller("updateCharts", function ($scope)
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
				$scope.chartmeta.colors[s].push('#AAAAAA');
			}
		}
	});

	// Chart.js Options
    $scope.chartmeta.options =  {

      // Sets the chart to be responsive
      responsive: true,

      //Boolean - Whether we should show a stroke on each segment
      segmentShowStroke : true,

      //String - The colour of each segment stroke
      segmentStrokeColor : '#fff',

      //Number - The width of each segment stroke
      segmentStrokeWidth : 1,

      //Number - The percentage of the chart that we cut out of the middle
      percentageInnerCutout : 75, // This is 0 for Pie charts

      //Number - Amount of animation steps
      animationSteps : 1,

      //String - Animation easing effect
      animationEasing : 'easeOutQuint',

      //Boolean - Whether we animate the rotation of the Doughnut
      animateRotate : false,

      //Boolean - Whether we animate scaling the Doughnut from the centre
      animateScale : false,

      //String - A legend template
      legendTemplate : '<ul class="tc-chart-js-legend"><% for (var i=0; i<segments.length; i++){%><li><span style="background-color:<%=segments[i].fillColor%>"></span><%if(segments[i].label){%><%=segments[i].label%><%}%></li><%}%></ul>'
    };
});

shardalyze.controller("sliderControl", function($scope)
{
	$scope.slidermeta = {};

	$scope.slidermeta.min = 0;
	$scope.slidermeta.max = 0;

	$scope.slidermeta.translate = function(value)
	{
		if($scope.mongo.shardalyzer.changes[value] !== undefined)
		{
			$scope.mongo.shardalyzer.bttf(value);
			return $scope.mongo.shardalyzer.changes[value].time;
		}
		else
			return value;
	};

	$scope.$watch('mongo.shardalyzer.changes.length', function(length)
	{
		if(length == undefined)
			$scope.slidermeta.max = 0;
		else
			$scope.slidermeta.max = $scope.mongo.shardalyzer.changes.length;
	});
});
