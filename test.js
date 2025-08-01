const axios = require("axios");

(async () => {
    try {
        // Test with Ibb coordinates (inside the updated polygon zone)
        const response = await axios.post("https://qareeb.modwir.com/customer/calculate", {
            uid: "123",
            mid: "12", // تاكسي vehicle exists
            mrole: "1",
            // Ibb coordinates - INSIDE zone boundaries (13.9400-13.9900, 44.1600-44.2100)
            pickup_lat_lon: "13.9667,44.1833",  // Ibb city center
            drop_lat_lon: "13.9750,44.1900",    // North of center
            drop_lat_lon_list: [
                "13.9667,44.1833",  // Pickup
                "13.9700,44.1850",  // Waypoint
                "13.9750,44.1900"   // Drop
            ]
        }, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        console.log("✅ Ibb Test Response:");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error("❌ Error:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
})();

// Alternative: Test with Sana'a coordinates (your original test)
/*
const sanaTest = {
    pickup_lat_lon: "15.3694,44.1910",
    drop_lat_lon: "15.3699,44.2010",
    drop_lat_lon_list: [
        "15.3694,44.1910",
        "15.3696,44.1950",
        "15.3699,44.2010"
    ]
};
*/