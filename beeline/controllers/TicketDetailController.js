export default [
  '$scope',
  '$state',
  '$interval',
  '$stateParams',
  'uiGmapGoogleMapApi',
  'TicketService',
  'CompanyService',
  'TripService',
  'UserService',
  'MapOptions',
  'RoutesService',
  function(
    $scope,
    $state,
    $interval,
    $stateParams,
    uiGmapGoogleMapApi,
    TicketService,
    CompanyService,
    TripService,
    UserService,
    MapOptions,
    RoutesService
  ){
    $scope.user = UserService.user;
    $scope.map = MapOptions.defaultMapOptions();
    TicketService.getTicketById(+$stateParams.ticketId)
    .then((ticket) => { 
      $scope.ticket = ticket;
      console.log(ticket);
      return TripService.getTripData(+ticket.alightStop.tripId);
    })
    .then((trip) => { 
      $scope.trip = trip;
      console.log(trip);
      return RoutesService.getRoute(trip.routeId);
    })
    .then((route) => {
      console.log(route);
      $scope.route = route;
    });

  // 		//generate QR Code
  // new QRCode(document.getElementById("qr-code-bg"), 'ticket code goes here');

  // function addBusStops() {
  // 	var board = $scope.tripTicket.boardStop.stop.coordinates.coordinates;
  // 	var alight = $scope.tripTicket.alightStop.stop.coordinates.coordinates;

  // 	//Board marker
  // 	$scope.map.markers[1] = {
  // 		id: 'boardstop',
  // 		coords: {
  // 			latitude: board[1],
  // 			longitude: board[0],
  // 		},
  //           icon: {
  // 			url: 'img/icon-stop-big.png',
  // 			scaledSize: new googleMaps.Size(25,25),
  // 			anchor: new googleMaps.Point(13,25),
  // 		},
  // 	}

  // 	//Alight marker
  // 	$scope.map.markers[2] = {
  // 		id: 'alightstop',
  // 		coords: {
  // 			latitude: alight[1],
  // 			longitude: alight[0],
  // 		},
  //           icon: {
  // 			url: 'img/icon-marker-big.png',
  // 			scaledSize: new googleMaps.Size(25,30),
  // 			anchor: new googleMaps.Point(13,30),
  // 		},
  // 	}
  // };

  // function updateTripInfo() {
  // 	console.log('update');

  // 	$scope.map.lines[0].path = []; //buspath

  // 	//redraw polyline on google map - reverse order from end of array to head
  // 	for(var i=$scope.info.pings.length-1; i>=0; i--)
  // 	{
  // 		var latlng = $scope.info.pings[i].coordinates.coordinates;
  // 		$scope.map.lines[0].path.push({
  // 			latitude: latlng[1],
  // 			longitude: latlng[0]
  // 		});
  // 	}

  // 	//redraw bus icon location
  // 	var buspos = $scope.info.pings[0].coordinates.coordinates;
  // 	$scope.map.markers[0] = {
  // 		id: 'busloc',
  // 		coords: {
  // 			latitude: buspos[1],
  // 			longitude: buspos[0],
  // 		},
  // 		icon: {
  // 			url: 'img/busMarker01.png',
  // 			scaledSize: new googleMaps.Size(80,80),
  // 			anchor: new googleMaps.Point(40,73),
  // 		},
  // 	}


  // }

  // function startPingsRefresh(tripid) {
  // 	console.log('timer start')

  // 	var loc = $scope.locator;
  // 	var refreshBar = document.getElementById('refresh-bar');

  // 	loc.timer = $interval(function() {

  // 		//Insurance
  // 		if ($state.current.name != 'tabs.ticket-detail') {
  // 			console.log('timer end');
  // 			$interval.cancel($scope.locator.timer);
  // 		}

  // 		if (loc.timePassed == 0) {
  // 			angular.element(refreshBar).removeClass('reset');
  // 		}

  // 		loc.timePassed += 1000;

  // 		angular.element(refreshBar).css('width', ((loc.timePassed/timerInterval) * 100) + '%');

  // 		if (loc.timePassed > timerInterval)
  // 		{
  // 			loc.timePassed = 0;
  // 			angular.element(refreshBar).addClass('reset');
  // 			angular.element(refreshBar).css('width', '0%');

  // 			TripService.DriverPings(tripid).then(function(tripinfo) {
  // 				$scope.info = tripinfo.data;
  // 				updateTripInfo();
  // 			});
  // 		}

  // 		//console.log(loc.timePassed);
  // 	}, 1000);

  // }


  //   .then(function(compData){
  //     $scope.company = compData;
  //     $scope.company.logourl = 'http://staging.beeline.sg/companies/'+$scope.company.id+'/logo';

  // 		return uiGmapGoogleMapApi;
  // 	}).then(function(map) {
  // 		console.log("map init success");

  //     googleMaps = map;

  // 		//grabbing the very first bundle of ping data
  // 		return TripService.DriverPings($scope.tripTicket.alightStop.tripId);
  // 	}).then(function(tripinfo) {

  // 		$scope.info = tripinfo.data;

  // 		gmap = $scope.map.mapControl.getGMap();

  // 		//re-init the routepath and markers
  // 		$scope.map.lines[1].path = [];
  // 		$scope.map.markers = [];

  // 		//add points for the Route
  // 		for(var i=0; i<$scope.route.path.length; i++)
  // 		{
  // 			$scope.map.lines[1].path.push({
  // 				latitude: $scope.route.path[i].lat,
  // 				longitude: $scope.route.path[i].lng
  // 			});
  // 		}

  // 		//add markers for Bus Stops
  // 		addBusStops();

  // 		//init the bus marker & bus path
  // 		updateTripInfo();

  // 		//pan and zoom to bus location
  // 		var lastpos = tripinfo.data.pings[0].coordinates.coordinates;
  // 		gmap.panTo(new googleMaps.LatLng(lastpos[1], lastpos[0]));
  // 		setTimeout(function(){
  // 			gmap.setZoom(17);
  // 		}, 300);

  // 		//call recurring timer function
  // 		startPingsRefresh($scope.trip.id);
  //   });

  //   $scope.$on('$destroy', () => {
  // 	 console.log('timer end');
  // 	 $interval.cancel($scope.locator.timer);
  //   });
  }
];