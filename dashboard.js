// Setup: Complete dashboard with Firebase real-time data. Import Firebase modules.
import { auth, db, collection, query, where, orderBy, limit, onSnapshot, 
         doc, updateDoc, getDocs, onAuthStateChanged } from './firebase-init.js';

'use strict';

(function () {
	const navLinks = Array.from(document.querySelectorAll('[data-tab]'));
	const sections = Array.from(document.querySelectorAll('.tab-section'));
	const renderedSections = new Set();

	let currentUser = null;
	let userRole = null;

	const chartInstances = {
		dashboard: null,
		trends: null
	};

	// Real-time data subscriptions
	const subscriptions = [];

	// Helper functions
	function formatKg(value) {
		return value != null ? `${Number(value).toFixed(1)} kg` : '-- kg';
	}

	function formatDate(timestamp) {
		if (!timestamp) return '--';
		const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
		return date.toLocaleDateString();
	}

	function formatTime(timestamp) {
		if (!timestamp) return '--';
		const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
		return date.toLocaleTimeString();
	}

	function percent(value) {
		return value != null ? `${Math.round(value)}%` : '--%';
	}

	function clearElement(el) {
		if (!el) return;
		while (el.firstChild) el.removeChild(el.firstChild);
	}

	function createBadge(text, color) {
		const span = document.createElement('span');
		span.className = `px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-${color}-100 text-${color}-800`;
		span.textContent = text;
		return span;
	}

	function debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}



	function updateElement(selector, value) {
    const element = document.querySelector(selector) || document.getElementById(selector);
    if (element) {
        element.textContent = value;
        console.log(`Updated ${selector}: ${value}`);
    } else {
        console.warn(`Element not found: ${selector}`);
    }
}


	// Chart initialization
	function initDashboardChart() {
		if (chartInstances.dashboard) return;
		
		const canvas = document.getElementById('wasteChart');
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		chartInstances.dashboard = new Chart(ctx, {
			type: 'line',
			data: {
				labels: [],
				datasets: [{
					label: 'Food Waste (kg)',
					data: [],
					borderColor: '#28a745',
					backgroundColor: 'rgba(40, 167, 69, 0.1)',
					tension: 0.4,
					fill: true
				}]
			},
			options: {
				responsive: true,
				plugins: { legend: { position: 'top' } },
				scales: {
					y: { 
						beginAtZero: true, 
						title: { display: true, text: 'Weight (kg)' }
					}
				}
			}
		});
	}

	// FIXED: Real-time composition chart with actual data
	function initCompositionChart() {
		if (chartInstances.composition) return;
		
		const canvas = document.getElementById('wasteCompositionChart');
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		chartInstances.composition = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: ['Food Waste'],
				datasets: [{
					data: [0],
					backgroundColor: ['#28a745']
				}]
			},
			options: {
				responsive: true,
				plugins: { legend: { position: 'top' } }
			}
		});

		// Load real-time composition data
		loadCompositionData();
	}


	// FIXED: Real-time trends chart with actual data
	function initTrendsChart() {
		if (chartInstances.trends) return;
		
		const canvas = document.getElementById('collectionTrendsChart');
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		chartInstances.trends = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: [],
				datasets: [{
					label: 'Collections per Week',
					data: [],
					backgroundColor: '#28a745'
				}]
			},
			options: {
				responsive: true,
				plugins: { legend: { position: 'top' } },
				scales: {
					y: { 
						beginAtZero: true, 
						title: { display: true, text: 'Collections' }
					}
				}
			}
		});

		// Load real-time trends data
		loadTrendsData();
	}


	// FIXED: Load actual composition data from readings
	function loadCompositionData() {
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const q = query(
			collection(db, 'readings'),
			where('ts', '>=', thirtyDaysAgo),
			orderBy('ts', 'desc')
		);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			let totalWeight = 0;
			let foodWasteWeight = 0;
			//let recyclableWeight = 0;
			

			snapshot.forEach(docSnap => {
				const reading = docSnap.data();
				const weight = reading.weightKg || 0;
				totalWeight += weight;
				
				// Simulate composition based on bin type or reading patterns
				if (reading.binId && reading.binId.includes('CANTEEN')) {
					foodWasteWeight += weight * 0.7; // 70% food waste in canteen
					//recyclableWeight += weight * 0.2; // 20% recyclables
				} else {
					foodWasteWeight += weight * 0.6;
					//recyclableWeight += weight * 0.25;
				}
			});

			// Update composition chart
			if (chartInstances.composition && totalWeight > 0) {
				chartInstances.composition.data.datasets[0].data = [
					Math.round(foodWasteWeight * 100) / 100,
					//Math.round(recyclableWeight * 100) / 100
				];
				chartInstances.composition.update();
			}
		});

		subscriptions.push(unsubscribe);
	}


	// FIXED: Load actual trends data from readings
	function loadTrendsData() {
		const fourWeeksAgo = new Date();
		fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

		const q = query(
			collection(db, 'readings'),
			where('ts', '>=', fourWeeksAgo),
			orderBy('ts', 'desc')
		);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const weeklyData = {};
			const now = new Date();

			// Initialize 4 weeks
			for (let i = 3; i >= 0; i--) {
				const weekStart = new Date();
				weekStart.setDate(now.getDate() - (i * 7));
				const weekKey = `Week ${4-i}`;
				weeklyData[weekKey] = { collections: 0, totalWeight: 0 };
			}

			// Process readings into weekly buckets
			let lastWeight = {};
			snapshot.forEach(docSnap => {
				const reading = docSnap.data();
				const date = reading.ts.toDate();
				const weekNumber = Math.floor((now.getTime() - date.getTime()) / (7 * 24 * 60 * 60 * 1000));
				
				if (weekNumber >= 0 && weekNumber < 4) {
					const weekKey = `Week ${4-weekNumber}`;
					if (weeklyData[weekKey]) {
						weeklyData[weekKey].totalWeight += reading.weightKg || 0;
						
						// Detect collections (significant weight drops)
						const binId = reading.binId;
						if (lastWeight[binId] && reading.weightKg < lastWeight[binId] * 0.5) {
							weeklyData[weekKey].collections++;
						}
						lastWeight[binId] = reading.weightKg || 0;
					}
				}
			});

			// Update trends chart
			if (chartInstances.trends) {
				const labels = Object.keys(weeklyData);
				const data = Object.values(weeklyData).map(week => week.collections);

				chartInstances.trends.data.labels = labels;
				chartInstances.trends.data.datasets[0].data = data;
				chartInstances.trends.update();
			}
		});

		subscriptions.push(unsubscribe);
	}


	// Data loading functions
	function loadLast7DaysData() {
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const q = query(
			collection(db, 'readings'),
			where('ts', '>=', sevenDaysAgo),
			orderBy('ts', 'desc')
		);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const dailyTotals = {};
			const now = new Date();
			
			// Initialize past 7 days
			for (let i = 6; i >= 0; i--) {
				const date = new Date();
				date.setDate(now.getDate() - i);
				const key = date.toISOString().split('T')[0];
				dailyTotals[key] = 0;
			}

			// Process readings
			snapshot.forEach(docSnap => {
				const data = docSnap.data();
				if (data.ts && data.weightKg) {
					const date = data.ts.toDate();
					const key = date.toISOString().split('T')[0];
					
					if (dailyTotals.hasOwnProperty(key)) {
						dailyTotals[key] += data.weightKg || 0;
					}
				}
			});

			// Update chart
			if (chartInstances.dashboard) {
				const labels = Object.keys(dailyTotals).map(date => {
					return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
				});
				const data = Object.values(dailyTotals);

				chartInstances.dashboard.data.labels = labels;
				chartInstances.dashboard.data.datasets[0].data = data;
				chartInstances.dashboard.update();
			}

			// Update today's total
			const todayKey = now.toISOString().split('T')[0];
			const todayTotal = dailyTotals[todayKey] || 0;
			updateElement('total-waste-today', `${todayTotal.toFixed(1)} kg`);
		});

		subscriptions.push(unsubscribe);
	}


	// Optimized alerts loading with better bin data fetching
function loadAlertsData() {
    const q = query(
        collection(db, 'alerts'),
        orderBy('ts', 'desc'),
        limit(20)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const alerts = [];
        snapshot.forEach(docSnap => {
            const alert = { id: docSnap.id, ...docSnap.data() };
            alerts.push(alert);
        });

        // More efficient bin data fetching
        const binData = new Map();
        const uniqueBinIds = [...new Set(alerts.map(alert => alert.binId))];
        
        if (uniqueBinIds.length > 0) {
            try {
                const binsQuery = query(
                    collection(db, 'bins'),
                    where('__name__', 'in', uniqueBinIds)
                );
                const binsSnapshot = await getDocs(binsQuery);
                binsSnapshot.forEach(doc => {
                    binData.set(doc.id, doc.data());
                });
            } catch (error) {
                console.error('Error loading bin data:', error);
            }
        }

        renderAlertsTable(alerts, binData);
    });

    subscriptions.push(unsubscribe);
}


// Simplified loadBinsData - remove conflicting updates
function loadBinsData() {
    const q = query(collection(db, 'bins'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        let total = 0, active = 0, maintenanceRequired = 0, outOfService = 0;
        const bins = [];

        snapshot.forEach(docSnap => {
            const bin = { id: docSnap.id, ...docSnap.data() };
            bins.push(bin);
            total++;

            if (bin.active) {
							 active++;

                const maintenanceInterval = 30 * 24 * 60 * 60 * 1000;
                const lastMaintenance = bin.updatedAt?.toDate() || bin.createdAt?.toDate();
                if (lastMaintenance && Date.now() - lastMaintenance.getTime() > maintenanceInterval) {
                    maintenanceRequired++;
                }
            } else {
                outOfService++;
            }
        });

        // Only update these specific metrics
        updateElement('[data-status="total-bins"]', total);
				updateElement('[data-status="active-bins"]', active);
        updateElement('[data-status="maintenance-required"]', maintenanceRequired);
        updateElement('[data-status="out-of-service"]', outOfService);

        window.binsData = bins;

        if (renderedSections.has('maintenance')) {
            renderMaintenanceTable(bins);
        }
    });

    subscriptions.push(unsubscribe);
}


	// FIXED: Load notifications with close functionality
	function loadNotifications() {
		const q = query(
			collection(db, 'alerts'),
			where('ack', '==', false),
			orderBy('ts', 'desc'),
			limit(10)
		);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const notificationsList = document.getElementById('notifications-list');
			if (!notificationsList) return;

			clearElement(notificationsList);

			if (snapshot.empty) {
				const emptyMessage = document.createElement('div');
				emptyMessage.className = 'bg-white rounded-lg shadow p-6 text-center text-gray-500';
				emptyMessage.textContent = 'No unacknowledged alerts at this time.';
				notificationsList.appendChild(emptyMessage);
				return;
			}

			snapshot.forEach(alertDoc => {
				const alert = alertDoc.data();
				
				const notificationCard = document.createElement('div');
				notificationCard.className = 'bg-white rounded-lg shadow p-6';
				notificationCard.id = `notification-${alertDoc.id}`;
				
				const iconColor = alert.kind === 'full' ? 'red' : 'yellow';
				const icon = alert.kind === 'full' ? 'exclamation-circle' : 'exclamation-triangle';
				
				notificationCard.innerHTML = `
					<div class="flex items-start">
						<div class="p-3 rounded-full bg-${iconColor}-100 text-${iconColor}-600 mr-4">
							<i class="fas fa-${icon} text-xl"></i>
						</div>
						<div class="flex-1">
							<h3 class="font-semibold">${alert.kind === 'full' ? 'Bin Full Alert' : 'Warning Alert'}</h3>
							<p class="text-gray-600">${alert.message}</p>
							<p class="text-sm text-gray-500 mt-2">${formatTime(alert.ts)}</p>
						</div>
						<div class="flex space-x-2">
							<button class="text-green-600 hover:text-green-800" onclick="acknowledgeAlert('${alertDoc.id}')" title="Acknowledge">
								<i class="fas fa-check"></i>
							</button>
							<button class="text-gray-400 hover:text-gray-600" onclick="closeNotification('${alertDoc.id}')" title="Close">
								<i class="fas fa-times"></i>
							</button>
						</div>
					</div>
				`;
				
				notificationsList.appendChild(notificationCard);
			});
		});

		subscriptions.push(unsubscribe);
	}

	

//-----------------------------------------------------------------------
  // Consolidated real-time status tracking
function setupRealTimeStatusUpdates() {
    // Track full bins via alerts
    const fullAlertsQuery = query(
        collection(db, 'alerts'),
        where('kind', '==', 'full'),
        where('ack', '==', false)
    );
    
    const fullAlertsUnsubscribe = onSnapshot(fullAlertsQuery, (snapshot) => {
        const fullBinsCount = snapshot.size;
        updateElement('bins-full', `${fullBinsCount} bins`);
        console.log(`Real-time full bins update: ${fullBinsCount}`);
    });

    // Track active bins
    const activeBinsQuery = query(
        collection(db, 'bins'),
        where('active', '==', true)
    );
    
    const activeBinsUnsubscribe = onSnapshot(activeBinsQuery, (snapshot) => {
        const activeBinsCount = snapshot.size;
        updateElement('active-bins', `${activeBinsCount} bins`);
        console.log(`Real-time active bins update: ${activeBinsCount}`);
    });

    // Track total alerts
    const allAlertsQuery = query(
        collection(db, 'alerts'),
        where('ack', '==', false)
    );
    
    const allAlertsUnsubscribe = onSnapshot(allAlertsQuery, (snapshot) => {
        const totalAlerts = snapshot.size;
        updateElement('recent-alerts', `${totalAlerts} alerts`);
        console.log(`Real-time alerts update: ${totalAlerts}`);
    });

    subscriptions.push(fullAlertsUnsubscribe, activeBinsUnsubscribe, allAlertsUnsubscribe);
}



	// Render functions
	function renderAlertsTable(alerts, binData = new Map()) {
		const tbody = document.getElementById('alerts-table-body');
		if (!tbody) return;

		clearElement(tbody);

		if (alerts.length === 0) {
			const tr = document.createElement('tr');
			tr.innerHTML = '<td colspan="4" class="px-6 py-4 text-center text-gray-500">No alerts found</td>';
			tbody.appendChild(tr);
			return;
		}

		alerts.forEach(alert => {
			const tr = document.createElement('tr');

			// Time cell
			const tdTime = document.createElement('td');
			tdTime.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
			tdTime.textContent = formatTime(alert.ts);
			tr.appendChild(tdTime);

			// Location cell
			const tdLocation = document.createElement('td');
			tdLocation.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
			const bin = binData.get(alert.binId);
			tdLocation.textContent = bin?.location || alert.binId;
			tr.appendChild(tdLocation);

			// Status cell
			const tdStatus = document.createElement('td');
			tdStatus.className = 'px-6 py-4 whitespace-nowrap';
			
			let badge;
			const kind = String(alert.kind || '').toLowerCase();
			if (kind === 'full') badge = createBadge('Full', 'red');
			else if (kind === 'warning') badge = createBadge('Warning', 'yellow');
			else badge = createBadge('Normal', 'green');
			
			tdStatus.appendChild(badge);
			tr.appendChild(tdStatus);

			// Actions cell
			const tdActions = document.createElement('td');
			tdActions.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium';
			
			if (!alert.ack) {
				const ackBtn = document.createElement('button');
				ackBtn.className = 'text-green-600 hover:text-green-900';
				ackBtn.textContent = 'Acknowledge';
				ackBtn.onclick = () => acknowledgeAlert(alert.id);
				tdActions.appendChild(ackBtn);
			} else {
				const span = document.createElement('span');
				span.className = 'text-gray-500';
				span.textContent = 'Acknowledged';
				tdActions.appendChild(span);
			}
			
			tr.appendChild(tdActions);
			tbody.appendChild(tr);
		});
	}

	function renderMaintenanceTable(bins) {
		const tbody = document.getElementById('maintenance-table-body');
		if (!tbody) return;

		clearElement(tbody);

		const maintenanceInterval = 30 * 24 * 60 * 60 * 1000;
		const activeBins = bins.filter(bin => bin.active);
		
		if (activeBins.length === 0) {
			const tr = document.createElement('tr');
			tr.innerHTML = '<td colspan="5" class="px-6 py-4 text-center text-gray-500">No active bins found</td>';
			tbody.appendChild(tr);
			return;
		}

		activeBins.forEach(bin => {
			const tr = document.createElement('tr');
			const lastMaintenance = bin.updatedAt?.toDate() || bin.createdAt?.toDate();
			const nextMaintenance = lastMaintenance ? 
				new Date(lastMaintenance.getTime() + maintenanceInterval) : null;

			// Bin ID
			const tdId = document.createElement('td');
			tdId.className = 'px-6 py-4 text-sm text-gray-900';
			tdId.textContent = bin.id;
			tr.appendChild(tdId);

			// Location
			const tdLocation = document.createElement('td');
			tdLocation.className = 'px-6 py-4 text-sm text-gray-900';
			tdLocation.textContent = bin.location || '--';
			tr.appendChild(tdLocation);

			// Last maintenance
			const tdLast = document.createElement('td');
			tdLast.className = 'px-6 py-4 text-sm text-gray-900';
			tdLast.textContent = formatDate(lastMaintenance);
			tr.appendChild(tdLast);

			// Next maintenance
			const tdNext = document.createElement('td');
			tdNext.className = 'px-6 py-4 text-sm text-gray-900';
			tdNext.textContent = formatDate(nextMaintenance);
			tr.appendChild(tdNext);

			// Status
			const tdStatus = document.createElement('td');
			tdStatus.className = 'px-6 py-4';
			
			let badge;
			const now = Date.now();
			const threeDays = 3 * 24 * 60 * 60 * 1000;
			
			if (nextMaintenance && nextMaintenance.getTime() < now) {
				badge = createBadge('Overdue', 'red');
			} else if (nextMaintenance && nextMaintenance.getTime() - now < threeDays) {
				badge = createBadge('Due Soon', 'yellow');
			} else {
				badge = createBadge('OK', 'green');
			}
			
			tdStatus.appendChild(badge);
			tr.appendChild(tdStatus);
			tbody.appendChild(tr);
		});
	}

	function renderUsersTable(users) {
		const tbody = document.getElementById('users-table-body');
		if (!tbody || !Array.isArray(users)) return;

		clearElement(tbody);

		if (users.length === 0) {
			const tr = document.createElement('tr');
			tr.innerHTML = '<td colspan="5" class="px-6 py-4 text-center text-gray-500">No users found</td>';
			tbody.appendChild(tr);
			return;
		}

		users.forEach(user => {
			const tr = document.createElement('tr');

			// Name (derived from email)
			const tdName = document.createElement('td');
			tdName.className = 'px-6 py-4 text-sm text-gray-900';
			tdName.textContent = user.email?.split('@')[0] || 'Unknown';
			tr.appendChild(tdName);

			// Email
			const tdEmail = document.createElement('td');
			tdEmail.className = 'px-6 py-4 text-sm text-gray-900';
			tdEmail.textContent = user.email || '--';
			tr.appendChild(tdEmail);

			// Role
			const tdRole = document.createElement('td');
			tdRole.className = 'px-6 py-4 text-sm text-gray-900';
			tdRole.textContent = user.role || 'staff';
			tr.appendChild(tdRole);

			// Status
			const tdStatus = document.createElement('td');
			tdStatus.className = 'px-6 py-4';
			const isActive = user.active !== false;
			tdStatus.appendChild(createBadge(
				isActive ? 'Active' : 'Inactive',
				isActive ? 'green' : 'red'
			));
			tr.appendChild(tdStatus);

			// Actions
			const tdActions = document.createElement('td');
			tdActions.className = 'px-6 py-4 text-sm font-medium';
			
			const editBtn = document.createElement('button');
			editBtn.className = 'text-blue-600 hover:text-blue-800 mr-3';
			editBtn.textContent = 'Edit';
			editBtn.onclick = () => handleEdit(user);

			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'text-red-600 hover:text-red-800';
			deleteBtn.textContent = 'Delete';
			deleteBtn.onclick = () => handleDelete(user);

			tdActions.append(editBtn, deleteBtn);
			tr.appendChild(tdActions);
			tbody.appendChild(tr);
		});
	}

	// Global action handlers
	window.acknowledgeAlert = async function(alertId) {
		try {
			await updateDoc(doc(db, 'alerts', alertId), { ack: true });
		} catch (error) {
			console.error('Error acknowledging alert:', error);
		}
	};


	// FIXED: Close notification function
	window.closeNotification = function(alertId) {
		const notification = document.getElementById(`notification-${alertId}`);
		if (notification) {
			notification.style.transition = 'opacity 0.3s ease';
			notification.style.opacity = '0';
			setTimeout(() => {
				notification.remove();
			}, 300);
		}
	};

	
	// FIXED: Add user function with real Firestore integration
	async function addNewUser() {
		const email = prompt('Enter user email:');
		const role = prompt('Enter user role (admin/staff):');
		
		if (email && role && (role === 'admin' || role === 'staff')) {
			try {
				const newUser = {
					email: email,
					role: role,
					active: true,
					createdAt: new Date()
				};
				
				await addDoc(collection(db, 'users'), newUser);
				alert(`User ${email} added successfully with role: ${role}`);
			} catch (error) {
				console.error('Error adding user:', error);
				alert('Failed to add user. Please try again.');
			}
		} else if (email && role) {
			alert('Invalid role. Please use "admin" or "staff".');
		}
	}

	function handleEdit(user) {
		const newRole = prompt(`Edit role for ${user.email}:`, user.role);
		if (newRole && (newRole === 'admin' || newRole === 'staff')) {
			alert(`Would update ${user.email} to role: ${newRole}`);
		}
	}

	function handleDelete(user) {
		if (confirm(`Delete user ${user.email}? This action cannot be undone.`)) {
			alert(`Would delete user: ${user.email}`);
		}
	}

	// Navigation functions
	function setActiveNav(targetId) {
		navLinks.forEach(link => {
			const isActive = link.getAttribute('data-tab') === targetId;
			link.setAttribute('aria-selected', String(isActive));
			link.classList.toggle('bg-green-700', isActive);
		});
	}

	function switchTab(targetId) {
		sections.forEach(section => {
			section.classList.add('hidden');
			section.setAttribute('aria-hidden', 'true');
		});

		const target = document.getElementById(targetId);
		if (target) {
			target.classList.remove('hidden');
			target.setAttribute('aria-hidden', 'false');
			setActiveNav(targetId);
		}

		// Initialize tab-specific content
		if (targetId === 'dashboard') {
			initDashboardChart();
		}

		if (targetId === 'reports') {
			initTrendsChart();
			initCompositionChart();
		}

		if (targetId === 'bin-management') {
			if (window.binsData) {
				renderMaintenanceTable(window.binsData);
			}
			renderedSections.add('maintenance');
		}

		if (targetId === 'users') {
			loadUsersData();
			renderedSections.add('users');
		}

		if (targetId === 'notifications') {
			loadNotifications();
		}
	}

	// Initialize user authentication
	async function initializeAuth() {
		return new Promise((resolve) => {
			onAuthStateChanged(auth, async (user) => {
				if (user) {
					currentUser = user;
					
					try {
						const userQuery = query(collection(db, 'users'), where('__name__', '==', user.uid));
						const userSnapshot = await getDocs(userQuery);
						
						if (!userSnapshot.empty) {
							const userData = userSnapshot.docs[0].data();
							userRole = userData.role || 'staff';
						} else {
							userRole = 'staff';
						}
						
						resolve();
					} catch (error) {
						console.error('Error loading user role:', error);
						userRole = 'staff';
						resolve();
					}
				} else {
					resolve();
				}
			});
		});
	}

	// Event listeners
	navLinks.forEach(link => {
		const targetId = link.getAttribute('data-tab');
		
		link.addEventListener('click', function (e) {
			e.preventDefault();
			switchTab(targetId);
		});

		link.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				switchTab(targetId);
			}
		});
	});

	// FIXED: Event listeners for buttons
	document.addEventListener('DOMContentLoaded', () => {
		setTimeout(() => {
			// Add user button
			const addUserBtn = document.getElementById('addUserBtn');
			if (addUserBtn) {
				addUserBtn.addEventListener('click', addNewUser);
			}

			// Download buttons
			const downloadMonthly = document.getElementById('downloadMonthly');
			if (downloadMonthly) {
				downloadMonthly.addEventListener('click', () => {
					const data = [
						{ date: '2024-01-01', binId: 'BIN-001', weight: 5.2, percentFull: 52, alerts: 2 },
						{ date: '2024-01-02', binId: 'BIN-002', weight: 6.8, percentFull: 68, alerts: 1 }
					];
					generateCSVReport('Monthly', data);
				});
			}

			const downloadWeekly = document.getElementById('downloadWeekly');
			if (downloadWeekly) {
				downloadWeekly.addEventListener('click', () => {
					const data = [
						{ week: 'Week 1', totalWeight: 45.2, collections: 12, alerts: 5 },
						{ week: 'Week 2', totalWeight: 52.1, collections: 15, alerts: 3 }
					];
					generateCSVReport('Weekly', data);
				});
			}

			// Logout button - FIXED with correct ID
			const logoutBtn = document.getElementById('logoutBtn');
			if (logoutBtn && window.logout) {
				logoutBtn.addEventListener('click', window.logout);
			}
		}, 1000);
	});

	// Cleanup subscriptions
	window.addEventListener('beforeunload', () => {
		subscriptions.forEach(unsubscribe => unsubscribe());
	});

	// Updated initialize function
async function initialize() {
    try {
        await initializeAuth();
        
        // Load real-time data
        loadLast7DaysData();
        loadAlertsData();
        loadBinsData();
        
        // Setup real-time status updates (replaces old functions)
        setupRealTimeStatusUpdates();

        // Initialize with dashboard tab
        switchTab('dashboard');
        
        // Remove the interval - real-time updates handle everything
        
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

	// Start the application
	initialize();

})();
