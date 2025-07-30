const socket = io();



document.getElementById("socketchange").addEventListener('click', async (event) => {
    
    socket.emit('home', {key:"Home"})
})



const { AddDriveLocation, RemoveDriveLocation, UpdateDriveLocation } = require("./js/map_driver_location");



socket.on('Driver_location_On', (data) => {
    alert("aaa")
    AddDriveLocation(data);
});

socket.on('Drive_location_Off', (data) => {
    alert("bbb")
    RemoveDriveLocation(data);
});

socket.on('Driver_location_Update', (data) => {
    UpdateDriveLocation(data);
});