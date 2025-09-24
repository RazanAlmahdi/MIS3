const SUPABASE_URL = "https://iwxrosurmridovzmbtcb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3eHJvc3VybXJpZG92em1idGNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMDY5MTMsImV4cCI6MjA3MTY4MjkxM30.NcI8a_WuxIYe8MSFKpS6B4lrei0UYmEHk_z24K9FLOM";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let tasks = [];

    // --- Optional: redirect to login if not logged in ---
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('user_id')) {
        window.location.href = 'index.html';
    }
});

// Logout
document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("user_id");
    window.location.href = "index.html";
});

async function loadTasks() {
    const userId = localStorage.getItem("user_id"); 
    if (!userId) return window.location.href = "index.html";

    // Fetch tasks assigned to this engineer
  // Fetch tasks assigned to this engineer, only "new" assignments
const { data, error } = await supabase
    .from("assigned_users")
    .select(`*, requests(*, requested_by_user_id(*), services(service_name))`)
    .eq("assigned_to_user_id", userId)
  


    if (error) {
        console.error(error);
        return;
    }

 tasks = data.map(item => ({
    id: item.request_id,
    title: item.requests.project_name,
    description: item.requests.specifications,
    project: item.requests.project_name,
    service: item.requests.services?.service_name || '-', // <-- new
    assigned_by: item.requests.requested_by_user_id.full_name,
    deadline: item.requests.deadline,
    priority: item.requests.priority,
    budget: item.requests.budget,
    status: item.status || "not_started" // <-- use assigned_users.status
}));
   // --- NEW: mark overdue tasks ---
    await Promise.all(tasks.map(async t => {
        const deadlineDate = new Date(t.deadline);
        const now = new Date();
        if (now > deadlineDate && t.status !== "completed" && t.status !== "overdue") {
            // update DB
            await supabase
                .from("assigned_users")
                .update({ status: "overdue" })
                .eq("assigned_to_user_id", userId)
                .eq("request_id", t.id);

            t.status = "overdue";
        }
    }));


    renderTasks("all");
}


function renderTasks(filter) {
    const taskList = document.getElementById("task-list");
    taskList.innerHTML = "";

    tasks.filter(t => filter === "all" ? true : t.status === filter)
         .forEach(task => {
            const card = document.createElement("div");
            card.className = "task-card";

            card.innerHTML = `
                <div class="task-header">
                    <h3>${task.title}</h3>
                    <span class="task-status status-${task.status}">${task.status.replace("_"," ")}</span>
                </div>
                <div class="task-details">
                    <p><strong>Project:</strong> ${task.project}</p>
                    <p><strong>Requested Service:</strong> ${task.service}</p>
                    <p><strong>Assigned by:</strong> ${task.assigned_by}</p>
                    <p><strong>Deadline:</strong> ${task.deadline}</p>
                    <p><strong>Priority:</strong> ${task.priority}</p>
                    <p><strong>Budget:</strong> $${task.budget}</p>
                    <p><strong>Description:</strong> ${task.description}</p>
                </div>
                <div class="task-actions">
                    ${task.status !== "completed" ? `<button onclick="updateStatus('${task.id}','in_progress')">Mark In Progress</button>
                    <button onclick="updateStatus('${task.id}','completed')">Mark Completed</button>` : ""}
                </div>
            `;
            taskList.appendChild(card);
         });
}

// Filter buttons
document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", e => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderTasks(btn.getAttribute("data-filter"));
    });
});

// Update task status

async function updateStatus(taskId, newStatus) {
    const userId = localStorage.getItem("user_id");

    const { error } = await supabase
        .from("assigned_users")
        .update({ status: newStatus })
        .eq("request_id", taskId)
        .eq("assigned_to_user_id", userId);

    if (error) {
        console.error(error);
        alert("Failed to update status");
    } else {
        tasks = tasks.map(t => t.id === taskId ? {...t, status: newStatus} : t);
        renderTasks(document.querySelector(".filter-btn.active").getAttribute("data-filter"));
    }
}

async function showLoggedInUser() {
    const userId = localStorage.getItem("user_id");
    if (!userId) return;

    const { data, error } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();

    if (error) {
        console.error("Error fetching user info:", error);
        return;
    }

    // Display in the header
    document.getElementById('user-info').textContent = `Logged in as: ${data.full_name}`;
}


// Initial load
loadTasks();
// Call it after page load
showLoggedInUser();