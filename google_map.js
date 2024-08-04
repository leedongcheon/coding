const fetch = require('node-fetch');

// Haversine 함수 구현
function haversine(lat1, lon1, lat2, lon2) {
    function toRad(x) {
        return x * Math.PI / 180;
    }

    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 구글 지도에서 주변 음식점 검색하기
async function getNearbyRestaurants(apiKey, keyword, latitude, longitude, radius = 1000, language = 'ko') {
    const endpointUrl = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
    
    const params = new URLSearchParams({
        location: `${latitude},${longitude}`,
        radius: radius,
        keyword: keyword,
        language: language,
        key: apiKey
    });
    
    try {
        const response = await fetch(`${endpointUrl}?${params}`);
        const results = await response.json();

        const nearbyRestaurantsArray = results.results.map(restaurant => {
            const name = restaurant.name;
            const address = restaurant.vicinity;
            const rating = restaurant.rating || 'N/A';
            const lat = restaurant.geometry.location.lat;
            const lng = restaurant.geometry.location.lng;
            const placeId = restaurant.place_id;
            const distance = haversine(latitude, longitude, lat, lng).toFixed(2); // km

            return { name, address, rating, distance, place_id: placeId };
        });

        return nearbyRestaurantsArray;
    } catch (error) {
        console.error("Error fetching nearby restaurants:", error);
        return [];
    }
}

module.exports = { getNearbyRestaurants };

// 사용 예:
// getNearbyRestaurants(apiKey, keyword, latitude, longitude).then(console.log);
