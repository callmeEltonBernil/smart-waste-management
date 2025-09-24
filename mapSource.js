// mapSource.js
// This script initializes a Leaflet map centered on CTU Main Campus
// and adds markers for trash bin locations.
	// Initialize map when the bin management tab is shown
  
	function initializeBinMap() {
			// Check if map container exists and is visible
			const mapContainer = document.getElementById('binLocationMap');
			if (!mapContainer || mapContainer.offsetParent === null) return;

			// CTU Main Campus coordinates
			const ctuLat = 10.296545;
			const ctuLng = 123.906972;

			// Initialize map centered on CTU
			const map = L.map('binLocationMap').setView([ctuLat, ctuLng], 18);

			// Add OpenStreetMap tiles
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '© OpenStreetMap contributors'
			}).addTo(map);

			// Define bin locations (replace with your actual coordinates)
			const binLocations = [
					{
							id: 'BIN-001',
							name: 'Canteen 1 Bin',
							lat: 10.296545,
							lng: 123.906972
					},
				
			];

			// Simple trash bin icon
			const binIcon = L.divIcon({
					html: `
							<div style="
									background-color: #28a745;
									width: 24px;
									height: 24px;
									border-radius: 50%;
									border: 3px solid white;
									box-shadow: 0 2px 4px rgba(0,0,0,0.3);
									display: flex;
									align-items: center;
									justify-content: center;
									color: white;
									font-size: 14px;
							">
									<i class="fas fa-trash"></i>
							</div>
					`,
					className: 'custom-bin-marker',
					iconSize: [30, 30],
					iconAnchor: [15, 15]
			});

			// Add markers for each bin
			binLocations.forEach(bin => {
					L.marker([bin.lat, bin.lng], { icon: binIcon })
					.addTo(map)
					.bindPopup(`<strong>${bin.name}</strong><br>Bin ID: ${bin.id}`);
			});

			window.binLocationMap = map;
	}

	// Initialize map when bin management tab is opened
	document.addEventListener('DOMContentLoaded', () => {
			const binManagementTab = document.querySelector('[data-tab="bin-management"]');
			if (binManagementTab) {
					binManagementTab.addEventListener('click', () => {
							setTimeout(initializeBinMap, 100);
					});
			}

			if (document.getElementById('bin-management') && 
					!document.getElementById('bin-management').classList.contains('hidden')) {
					setTimeout(initializeBinMap, 100);
			}
	});
	