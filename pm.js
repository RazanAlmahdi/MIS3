// pm.js

// --- DOM elements ---
const form = document.getElementById('service-request-form');
const messageDiv = document.getElementById('message');
const servicesGrid = document.getElementById('services-grid');
const departmentMenu = document.getElementById('department-menu');
const serviceSelect = document.getElementById('service-select');

let allServices = [];

// Helper: get token
function getAuthHeaders() {
    const token = localStorage.getItem("access_token");
    return { Authorization: `Bearer ${token}` };
}

// --- Show logged in user ---
async function showLoggedInUser() {
    try {
        const res = await fetch("/api/me", { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Failed to fetch user");
        const user = await res.json();

        localStorage.setItem("user_id", user.id);
        localStorage.setItem("user_name", user.full_name);

        document.getElementById("user-info").textContent =
            `Logged in as: ${user.full_name}`;
    } catch (err) {
        console.error(err);
        window.location.href = "index.html";
    }
}

// --- Fetch services ---
async function fetchServices() {
    try {
        const res = await fetch("/api/services", { headers: getAuthHeaders() });
        const data = await res.json();

        allServices = data.map(s => ({
            id: s.id,
            name: s.service_name,
            department: s.department_name,
            description: s.description
        }));

        renderServiceCards(allServices);
        populateFormDropdown(allServices);
    } catch (err) {
        console.error("Error fetching services:", err);
    }
}

// --- Fetch departments ---
async function fetchDepartments() {
    try {
        const res = await fetch("/api/departments", { headers: getAuthHeaders() });
        const data = await res.json();

        // Remove old buttons except "all"
        departmentMenu.querySelectorAll('button:not([data-filter="all"])')
            .forEach(btn => btn.remove());

        data.forEach(dept => {
            const btn = document.createElement('button');
            btn.textContent = dept.department_name;
            btn.dataset.filter = dept.department_name;
            btn.className =
                'px-4 py-2 rounded-full font-semibold transition-colors duration-200 bg-gray-300 text-gray-700 hover:bg-gray-400';
            departmentMenu.appendChild(btn);
        });

        setupFiltering();
    } catch (err) {
        console.error("Error fetching departments:", err);
    }
}

// --- Render services ---
function renderServiceCards(services) {
    servicesGrid.innerHTML = '';
    services.forEach(s => {
        const card = document.createElement('div');
        card.className = 'service-card';
        card.dataset.department = s.department;
        card.innerHTML = `
            <div class="service-header">
                <h3 class="text-lg font-medium text-gray-800">${s.name}</h3>
                <span class="service-tag">${s.department}</span>
            </div>
            <p class="text-sm text-gray-600 mt-2">${s.description}</p>
        `;
        servicesGrid.appendChild(card);
    });
}

// --- Populate dropdown ---
function populateFormDropdown(services) {
    serviceSelect.innerHTML = '';
    services.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = `${s.name} (${s.department})`;
        serviceSelect.appendChild(option);
    });
}

// --- Filtering ---
function setupFiltering() {
    const buttons = departmentMenu.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => {
                b.classList.remove('bg-green-600','text-white','hover:bg-green-700','active');
                b.classList.add('bg-gray-300','text-gray-700','hover:bg-gray-400');
            });
            btn.classList.remove('bg-gray-300','text-gray-700','hover:bg-gray-400');
            btn.classList.add('bg-green-600','text-white','hover:bg-green-700','active');

            const filter = btn.dataset.filter;
            const filtered = filter === 'all'
                ? allServices
                : allServices.filter(s => s.department === filter);
            renderServiceCards(filtered);
        });
    });
}

// --- Form submission ---
form.addEventListener('submit', async e => {
    e.preventDefault();
    messageDiv.textContent = 'Submitting...';
    messageDiv.style.color = '#4b5563';

    const projectName = document.getElementById('project-name').value;
    const specifications = document.getElementById('specifications').value;
    const deadline = document.getElementById('deadline').value;
    const priority = document.getElementById('priority').value;
    const serviceIds = Array.from(serviceSelect.selectedOptions).map(o => o.value);
    const userId = localStorage.getItem('user_id');

    if (!serviceIds.length) {
        messageDiv.textContent = 'Please select at least one service.';
        messageDiv.style.color = '#ef4444';
        return;
    }

    try {
        for (const serviceId of serviceIds) {
            const res = await fetch("/api/requests", {
                method: "POST",
                headers: {
                    ...getAuthHeaders(),
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    project_name: projectName,
                    specifications,
                    deadline,
                    priority,
                    service_id: serviceId,
                    requested_by_user_id: userId
                })
            });
            if (!res.ok) throw new Error("Request failed");
        }

        messageDiv.textContent = 'Request submitted successfully!';
        messageDiv.style.color = '#10b981';
        form.reset();
    } catch (err) {
        console.error(err);
        messageDiv.textContent = 'An error occurred. Please try again.';
        messageDiv.style.color = '#ef4444';
    }
});

// --- Logout ---
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('access_token');
    window.location.href = 'index.html';
});

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
    await showLoggedInUser();
    await fetchDepartments();
    await fetchServices();
});
