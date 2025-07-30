$(document).ready(function (){
    // initMap(1);

    const base_url = window.location.origin;
    $.ajax({
        url: base_url + '/zone/change_location',
        type: 'POST',
        dataType: 'JSON',
        data: {status:0, zid: 0, vid: 0},
        success: function (res){
            initMap(1, res.data, res.dri, 0, 0);
        }
    });

    $(document).on("change", '#zonedlist', function(){
        $.ajax({
            url: base_url + '/zone/change_location',
            type: 'POST',
            dataType: 'JSON',
            data: {status: 0, zid: $(this).val(), vid: $("#zonevehicle").select2().val()},
            success: function (res){
                initMap(1, res.data, res.dri, res.zone);
            }
        });
    });

    $(document).on("change", '#zonevehicle', function(){
        $.ajax({
            url: base_url + '/zone/change_location',
            type: 'POST',
            dataType: 'JSON',
            data: {status: 0, zid: $("#zonedlist").select2().val(), vid: $(this).val()},
            success: function (res){
                initMap(2, res.data, res.dri, res.zone);
            }
        });
    });


    let map = "", zoneid = "", AllMarker = [] 
    async function initMap(status, data, driver, zone, drstatus, update) {
        // Request needed libraries.
        
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary( "marker" );
        let tot_dri = driver;
        if(status != "3") zoneid = zone

        if (status == 1) {

            let zone = data.lat_lon;
        
            let edit = zone.split(',')
            let edit_zones = [];
        
            for (let i = 0; i < edit.length; i++){
                let zon = edit[i].split(":")
                let object  = {lat: Number(zon[0]), lng: Number(zon[1])}
                edit_zones.push(object)
            }
            
            const triangleCoords = edit_zones;
            
            map = new Map(document.getElementById("map-canvas-edit"), {
                center: triangleCoords[0],
                zoom: 10,
                mapId: "4504f8b37365c3d0",
            });
    
            const bermudaTriangle = new google.maps.Polygon({
                paths: triangleCoords,
                strokeColor: "#ffff00",
                strokeOpacity: 0.8,
                strokeWeight: 3,
                fillColor: "#f9e9bc",
                fillOpacity: 0.35,
            });
    
            bermudaTriangle.setMap(map);
            infoWindow = new google.maps.InfoWindow();


            for (let i = 0; i < tot_dri.length;) {
                const beachFlagImg = document.createElement("img");
                beachFlagImg.style.width = "20px"; beachFlagImg.src = `../${tot_dri[i].image}`;

                let mapd = new AdvancedMarkerElement({
                    map,
                    position: { lat: parseFloat(tot_dri[i].latitude), lng: parseFloat(tot_dri[i].longitude) },
                    content: beachFlagImg
                })
                AllMarker.push({ id: tot_dri[i].id, data: mapd })
                i++
            }

            
            
        } else if (status == 2) {

            AllMarker.forEach(marker => {
                marker.data.map = null;
            });
            AllMarker = [];

            if (tot_dri.length != "0") {
                for (let i = 0; i < tot_dri.length;) {
                    const beachFlagImg = document.createElement("img");
                    beachFlagImg.style.width = "20px"; beachFlagImg.src = `../${tot_dri[i].image}`;
                  
                    let mapd = new AdvancedMarkerElement({
                        map,
                        position: { lat: parseFloat(tot_dri[i].latitude), lng: parseFloat(tot_dri[i].longitude) },
                        content: beachFlagImg
                    })
                    AllMarker.push({ id: tot_dri[i].id, data: mapd })
                    i++
                }
            }
             
        } else if (status == 3) {
            
            AllMarker.forEach(marker => {
                if (parseFloat(marker.id) == parseFloat(update.id)) {

                    if (drstatus == "2" || drstatus == "3") {
                        marker.data.map = null;
                    }
                    
                    if (drstatus == "1" || drstatus == "3") {
                        const beachFlagImg = document.createElement("img");
                        beachFlagImg.style.width = "20px"; beachFlagImg.src = `../${update.image}`;
                        let mapd = new AdvancedMarkerElement({
                            map,
                            position: { lat: parseFloat(update.latitude), lng: parseFloat(update.longitude) },
                            content: beachFlagImg
                        })
                        AllMarker.push({ id: update.id, data: mapd })
                    }
                }
            });

        }

    }





})




async function AddDriveLocation(data) {
    alert("AddLocation")
    initMap(3, "", "", "", 1, data);
}

async function RemoveDriveLocation() {
    alert("RemoveLocation")
    initMap(3, "", "", "", 2, data);
}

async function UpdateDriveLocation() {
    alert("UpdateLocation")
    initMap(3, "", "", "", 3, data);
}



module.exports = { AddDriveLocation, RemoveDriveLocation, UpdateDriveLocation }