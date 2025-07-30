let map;
let infoWindow;

function initMap() {

    var zone = document.getElementById('old_lat_lon').value

    let edit = zone.split(',')
    var edit_zones = [];

    for (var i = 0; i < edit.length; i++){
        let zon = edit[i].split(":")
        let object  = {lat: Number(zon[0]), lng: Number(zon[1])}
        edit_zones.push(object)
    }
    
    const triangleCoords = edit_zones;
    map = new google.maps.Map(document.getElementById("map-canvas-edit"), {
        zoom: 8,
        center: triangleCoords[0],
        mapTypeId: google.maps.MapTypeId.RoadMap,
        
    });

    const bermudaTriangle = new google.maps.Polygon({
        paths: triangleCoords,
        editable: true,
        strokeColor: "#ffff00",
        strokeOpacity: 0.8,
        strokeWeight: 3,
        fillColor: "#ffff00",
        fillOpacity: 0.35,
    });

    bermudaTriangle.setMap(map);
    infoWindow = new google.maps.InfoWindow();

    // google.maps.event.addListener(bermudaTriangle.getPath(), 'insert_at', function(index, obj) {
    // });

    google.maps.event.addListener(bermudaTriangle, 'mouseout', function(index, obj) {
        const polygon = bermudaTriangle;
        const vertices = polygon.getPath();

        var contentString = [];

        for (let i = 0; i < vertices.getLength(); i++) {
            const xy = vertices.getAt(i);

            contentString.push(bermudaTriangle.getPath().getAt(i).toUrlValue(6))
            // contentString += xy.lat() + "," + xy.lng();
            // coordinates.push(newShape.getPath().getAt(i).toUrlValue(6))
        }

        document.getElementById('add_lat_lon').value = contentString
        infoWindow.open(map);
    });

}

// window.initMap = initMap;

initMap()