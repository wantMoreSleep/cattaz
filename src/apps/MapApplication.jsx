import React from 'react';
import PropTypes from 'prop-types';
import Yaml from 'js-yaml';
import isEqual from 'lodash/isEqual';
// Please change to your own Google Maps API KEY in [../apikey/apikey.js]
import { googlemapsApiKey } from '../apikey/apikey';

const initCoordinate = { lat: 35.698601, lng: 139.773139 };

class MapModel {
  constructor() {
    this.lat = initCoordinate.lat;
    this.lng = initCoordinate.lng;
  }
  setCoordinate(latlng) {
    this.lat = latlng.lat;
    this.lng = latlng.lng;
  }
  equals(other) {
    return isEqual(this, other);
  }
  serialize() {
    return Yaml.safeDump(this);
  }
  static deserialize(str) {
    try {
      const obj = Yaml.safeLoad(str);
      const model = new MapModel();
      if (typeof obj.lat === 'number') model.lat = obj.lat;
      if (typeof obj.lng === 'number') model.lng = obj.lng;
      return model;
    } catch (ex) {
      return new MapModel();
    }
  }
}

export default class MapApplication extends React.Component {
  static getDerivedStateFromProps(nextProps) {
    const map = MapModel.deserialize(nextProps.data);
    return { map };
  }
  constructor() {
    super();
    this.refInputPlace = React.createRef();
    this.refIframe = React.createRef();
    this.handleSearchPlace = this.handleSearchPlace.bind(this);
    this.handleGetMap = this.handleGetMap.bind(this);
  }
  componentDidMount() {
    const doc = this.refIframe.current.contentWindow.document;
    doc.open();
    doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Map</title>
        <meta name="viewport" content="initial-scale=1.0">
        <meta charset="utf-8">
        <style>
          #map {
            width: 400px;
            height: 400px;
          }
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
          }
        </style>
      </head>
      <body>
        <div id="disp" style="color: #c66900;"></div>
        <div id="error" style="color: #ba000d;"></div>
        <div id="map"></div>
        <script>
          var map;
          var marker;
          var geocoder;
          var latlng = { lat: ${this.state.map.lat}, lng: ${this.state.map.lng}};
          var oldLatlng = { lat: ${this.state.map.lat}, lng: ${this.state.map.lng}}; 
          function initMap() {
            var googleLatLng = new google.maps.LatLng(latlng);
            geocoder = new google.maps.Geocoder();
            map = new google.maps.Map(document.getElementById('map'), {
              center: googleLatLng,
              zoom: 16
            });
            marker = new google.maps.Marker({
              map: map,
              position: googleLatLng
            });
            google.maps.event.addListener(map, 'click', clickMap);
            function clickMap(event){
              latlng.lat = event.latLng.lat();
              latlng.lng = event.latLng.lng();
              if(latlng.lat !== oldLatlng.lat || latlng.lng !== oldLatlng.lng){
                marker.position = event.latLng;
                marker.setMap(map);
                document.getElementById('disp').innerHTML = "Marker Changed";
              }
            }
            function receiveMessage(event) {
              if(event.origin === window.location.origin) {
                if (event.data.type === 'setCoordinate') {
                  var googleLatLng = new google.maps.LatLng(event.data.value);
                  map.panTo(googleLatLng);
                  marker.position = googleLatLng;
                  marker.setMap(map);
                  document.getElementById('disp').innerHTML = "";
                } else if(event.data.type === 'searchPlace') {    
                  geocoder.geocode({ 'address': event.data.value }, function(results, status) {                    
                    if (status === google.maps.GeocoderStatus.OK) {
                      document.getElementById('error').innerHTML = '';
                      map.panTo(results[0].geometry.location);
                      marker.position = results[0].geometry.location;
                      marker.setMap(map);
                      latlng.lat = results[0].geometry.location.lat();
                      latlng.lng = results[0].geometry.location.lng();
                      if(latlng.lat !== oldLatlng.lat || latlng.lng !== oldLatlng.lng){
                        document.getElementById('disp').innerHTML = "Marker Changed";
                      }
                    } else {
                      document.getElementById('error').innerHTML = 'Google Maps Error: ' + status;
                    } 
                  });
                } else if(event.data.type === 'getMapNotification') {
                  oldLatlng.lat = latlng.lat;
                  oldLatlng.lng = latlng.lng;
                  document.getElementById('disp').innerHTML = "";
                }
              }
            }
            window.addEventListener('message', receiveMessage);
          }
        </script>
        <script src="https://maps.googleapis.com/maps/api/js?key=${googlemapsApiKey}&callback=initMap" async defer></script>
      </body>
    </html>
    `);
    doc.close();
  }
  shouldComponentUpdate(newProps, nextState) {
    return !this.state.map.equals(nextState.map);
  }
  componentDidUpdate(prevProps, prevState /* , prevContext */) {
    if (!this.state.map.equals(prevState.map)) {
      this.refIframe.current.contentWindow.postMessage({ type: 'setCoordinate', value: this.state.map }, window.location.origin);
    }
  }
  handleSearchPlace() {
    const address = this.refInputPlace.current.value;
    if (!address) return;
    this.refIframe.current.contentWindow.postMessage({ type: 'searchPlace', value: address }, window.location.origin);
  }
  handleGetMap() {
    this.refIframe.current.contentWindow.postMessage({ type: 'getMapNotification' }, window.location.origin);
    this.state.map.setCoordinate(this.refIframe.current.contentWindow.latlng);
    this.props.onEdit(this.state.map.serialize(), this.props.appContext);
  }
  render() {
    let apiKeyErrorMessage = '';
    if (!googlemapsApiKey) {
      apiKeyErrorMessage = 'No API KEY. Please change to your own Google Maps API KEY in [../apikey/apikey.js].';
    }
    return (
      <div>
        <div>
          <div style={{ color: '#ba000d' }}>{apiKeyErrorMessage}</div>
          <input ref={this.refInputPlace} type="text" placeholder="Add Place" />
          <input type="button" value="Search" onClick={this.handleSearchPlace} />
          <input type="button" value="Get Marker" onClick={this.handleGetMap} />
        </div>
        <iframe ref={this.refIframe} width="400" height="430" frameBorder="0" marginHeight="0" marginWidth="0" scrolling="no" title="map">
          <p>Your browser does not support iframes.</p>
        </iframe>
        <div style={{ color: '#D8000C' }}>{this.state.errorMessage}</div>
      </div>);
  }
}

MapApplication.propTypes = {
  // https://github.com/yannickcr/eslint-plugin-react/issues/1751
  // eslint-disable-next-line react/no-unused-prop-types
  data: PropTypes.string.isRequired,
  onEdit: PropTypes.func.isRequired,
  appContext: PropTypes.shape({}).isRequired,
};
