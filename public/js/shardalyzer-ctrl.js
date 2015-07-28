
var shardalyze = angular.module('shard-vis', ["tc.chartjs", "rzModule"]).run
(
	function($rootScope)
	{
		$rootScope.mongo = {};

		// initial settings
		$rootScope.mongo.host = "localhost";
		$rootScope.mongo.port = 27017;

		$rootScope.mongo.shardalyzer = Shardalyzer;
	}
);

shardalyze.controller
(
	'nsList',
	function ($scope, $http)
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
	}
);

shardalyze.controller("updateCharts", function ($scope)
{
	console.log('chart handler');

	$scope.chartmeta = {};

	$scope.$watch('mongo.shardalyzer.shards', function(shards)
	{
		$scope.chartmeta.data = {};

		for(var s in shards)
		{
			$scope.chartmeta.data[s] = [];

			for(var chunk in shards[s])
			{
				var entry =
				{
					value: 1,
					color: $scope.mongo.shardalyzer.statuscolors[shards[s][chunk].status],
					highlight: '#FFC870',
					label: JSON.stringify(shards[s][chunk])
				};
	
				$scope.chartmeta.data[s].push(entry);
			}

			if($scope.chartmeta.data[s].length == 0)
			{
				var entry =
				{
					value: 1,
					color: '#AAAAAA',
					highlight: '#CCCCCC',
					label: 'Empty'
				};
	
				$scope.chartmeta.data[s].push(entry);
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
      animationSteps : 250,

      //String - Animation easing effect
      animationEasing : 'easeOutQuint',

      //Boolean - Whether we animate the rotation of the Doughnut
      animateRotate : true,

      //Boolean - Whether we animate scaling the Doughnut from the centre
      animateScale : false,

      //String - A legend template
      legendTemplate : '<ul class="tc-chart-js-legend"><% for (var i=0; i<segments.length; i++){%><li><span style="background-color:<%=segments[i].fillColor%>"></span><%if(segments[i].label){%><%=segments[i].label%><%}%></li><%}%></ul>'
    };
});
