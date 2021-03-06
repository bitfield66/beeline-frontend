import _ from 'lodash';
import kickstartHelpTemplate from '../templates/kickstart-popup.html';
import loadingTemplate from '../templates/loading.html';
import {sleep} from '../shared/util';


// Parse out the available regions from the routes
// Filter what is displayed by the region filter
// Split the routes into those the user has recently booked and the rest
export default function($scope, $state, UserService, RoutesService, $q,
  $ionicScrollDelegate, $ionicPopup, KickstarterService, $ionicLoading,
  SearchService, $timeout, loadingSpinner, uiGmapGoogleMapApi, LazyLoadService, SearchEventService) {

  // https://github.com/angular/angular.js/wiki/Understanding-Scopes
  $scope.data = {
    error: null,
    kickstarter: null,
    backedKickstarter: null,
    filterText: '',
    stagingFilterText: '',
    nearbyKickstarterRoutes: null,
    placeQuery: null, // The place object used to search
    queryText: "", // The actual text in the box used only for the clear button
  };

 //FIXME: put place search into a directive
  uiGmapGoogleMapApi.then((googleMaps) => {
    // Initialize it with google autocompleteService and PlacesService
    $scope.autocompleteService = LazyLoadService(() => new googleMaps.places.AutocompleteService());
    //  https://stackoverflow.com/questions/28869575/google-places-api-library-use-without-map-javascript
    $scope.placesService = LazyLoadService(() => new google.maps.places.PlacesService(document.createElement('div')));
  });

  function autoComplete() {
    if (!$scope.data.queryText || !$scope.autocompleteService) {
      $scope.data.isFiltering = false;
      return;
    };
    // show the spinner
    $scope.data.isFiltering = true;
    $scope.$digest();
    // default 'place' object only has 'queryText' but no geometry
    // if has predicted place assign the 1st prediction to place object
    let place = {queryText: $scope.data.queryText};
    SearchEventService.emit('search-item', $scope.data.queryText)

    // Reset filteredKickstarter here because they are used to
    // determine whether we do a place query (see watchGroup with both)
    $scope.data.routes = null;
    $scope.data.filteredKickstarter = null;
    $scope.data.placeQuery = place;
    $scope.$digest();
  }

  $scope.$watch("data.queryText", (queryText) => {
    if (queryText.length === 0) $scope.data.placeQuery = null;
  });

  $scope.$watch('data.queryText',
    _.debounce(autoComplete, 1000, {leading: false, trailing: true})
  )

  $scope.refreshRoutes = function() {
    $q.all([KickstarterService.fetchCrowdstart(true),KickstarterService.fetchBids(true), KickstarterService.fetchNearbyKickstarterIds()])
    .then(()=>{
      $scope.data.error = null;
    })
    .catch(() => {
      $scope.data.error = true;
    })
    .then(() => {
      $scope.$broadcast('scroll.refreshComplete');
    })
  }

  var timeoutProise = function(promise, ms) {
    return Promise.race([promise, new Promise((resolve,reject)=>{
      $timeout(()=>reject(), ms);
    })])
  }

  //show loading spinner for the 1st time
  loadingSpinner(timeoutProise(KickstarterService.fetchCrowdstart(), 10*6000)
                  .then(()=>{
                    $scope.data.error = null;
                  })
                  .catch(()=>{
                    $scope.data.error = true;
                  })
                  .then(()=>{
                    if (!window.localStorage['showCrowdstart']) {
                      window.localStorage['showCrowdstart'] = true;
                      $scope.showHelpPopup();
                    }
                  }));

  $scope.$watchGroup([
    ()=>KickstarterService.getCrowdstart(),
    ()=>KickstarterService.getBids(),
    'data.placeQuery'
  ], ([crowdstartRoutes, userBids, placeQuery])=>{
      if (!crowdstartRoutes || !userBids) return;

      $scope.userBids = userBids;
      $scope.recentBidsById = _.keyBy($scope.userBids, r=>r.routeId);
      let recentAndAvailable = _.partition(crowdstartRoutes, (x)=>{
        return _.includes(_.keys($scope.recentBidsById), x.id.toString());
      });
      // don't display it in backed list if the pass expires after 1 month of 1st trip
      //and don't display it if it's 7 days after expired and not actived
      let backedKickstarter = recentAndAvailable[0].filter((route)=>(!route.passExpired && route.isActived) || !route.isExpired || !route.is7DaysOld) || [];
      //don't display it in kickstarter if it's expired
      let kickstarter = recentAndAvailable[1].filter((route)=>!route.isExpired) || [];

      // Filter the routes
      if (placeQuery && placeQuery.geometry && placeQuery.queryText) {
        // $scope.data.filteredNearbyKickstarterRoutes = SearchService.filterRoutesByPlaceAndText($scope.data.filteredNearbyKickstarterRoutes,  placeQuery, placeQuery.queryText);
        kickstarter = SearchService.filterRoutesByPlaceAndText(kickstarter,  placeQuery, placeQuery.queryText);
        backedKickstarter = SearchService.filterRoutesByPlaceAndText(backedKickstarter,  placeQuery, placeQuery.queryText);

      } else if (placeQuery && placeQuery.queryText) {
        // $scope.data.filteredNearbyKickstarterRoutes = SearchService.filterRoutesByText($scope.data.filteredNearbyKickstarterRoutes,  placeQuery.queryText);
        kickstarter = SearchService.filterRoutesByText(kickstarter,  placeQuery.queryText);
        backedKickstarter = SearchService.filterRoutesByText(backedKickstarter,  placeQuery.queryText);
      }


      //publish
      $scope.data.filteredKickstarter = _.sortBy(kickstarter, (x)=> {return parseInt(x.label.slice(1))});
      $scope.data.filteredbackedKickstarter = _.sortBy(backedKickstarter, (x)=> {return parseInt(x.label.slice(1))});

  });

  // Deciding whether to do a place query
  $scope.$watchCollection('data.filteredKickstarter',
    (newRoutes, oldRoutes) => {

      async function handlePlaceQuery () {
        if (!newRoutes) return;

        // Criteria for making a place query
        if (newRoutes.length > 0) return;

        let placeQuery = $scope.data.placeQuery
        if (!placeQuery) return;

        // If placeQuery.geometry exists, then we've already made a place query
        if (placeQuery.geometry) return;

        if (!$scope.autocompleteService) return;

        function getPlacePredictions (options) {
          return new Promise(function (resolve, reject) {
            $scope.autocompleteService().getPlacePredictions(options, 
              (predictions) => resolve(predictions))
          })
        }

        function getDetails (predictions) {
          return new Promise(function (resolve, reject) {
            // If no results found then nothing more to do
            if (!predictions || predictions.length === 0) reject();

            $scope.placesService().getDetails({
              placeId: predictions[0].place_id
            }, (result) => {
              if (!result) reject();
              let place = {queryText: $scope.data.queryText};
              place = _.assign(place,result);
              resolve(place);
            })
          })
        }

        let predictions = await getPlacePredictions({
          componentRestrictions: {country: 'SG'},
          input: $scope.data.queryText
        });

        let place = await getDetails(predictions);

        $scope.data.placeQuery = place;
        $scope.$digest();
      }

      async function stopFilteringAfterDelay () {
        await sleep(500)
        $scope.data.isFiltering = false;
        $scope.$digest();
      }

      handlePlaceQuery().then(stopFilteringAfterDelay, stopFilteringAfterDelay)
    }
  )


  $scope.showHelpPopup = function(){
    $scope.kickstartHelpPopup = $ionicPopup.show({
      template: kickstartHelpTemplate,
      title: 'Crowdstart Routes',
      buttons: [
        {
          text: 'OK',
          type: 'button-positive',
          onTap: function(e) {
            $scope.closePopup();
          }
        }
      ]
    });
  }

  $scope.closePopup = function() {
    $scope.kickstartHelpPopup.close();
  }

}
