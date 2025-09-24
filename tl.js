import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Logout functionality (keeps existing IDs the same)
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('user_id');
  window.location.href = 'index.html';
});

const SUPABASE_URL = 'https://iwxrosurmridovzmbtcb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3eHJvc3VybXJpZG92em1idGNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMDY5MTMsImV4cCI6MjA3MTY4MjkxM30.NcI8a_WuxIYe8MSFKpS6B4lrei0UYmEHk_z24K9FLOM'; // keep your key (but see security note below)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const userId = localStorage.getItem('user_id'); // TL's ID
if (!userId) {
  console.warn('No user_id found in localStorage — redirecting to login/index.');
  window.location.href = 'index.html';
  // return; // navigation will happen; keep execution minimal after redirect
}

const incomingContainer = document.getElementById('incoming-requests');
const activeContainer = document.getElementById('active-requests');

let engineerRoleId = null;
let tlDepartmentId = null;

// Fetch TL info & engineer role ID
async function initTL() {
    const { data: tlData, error: tlErr } = await supabase
        .from('users')
        .select('full_name, department_id')
        .eq('id', userId)
        .single();
    if (tlErr) { console.error(tlErr); return; }
    if (!tlData) { console.error('No TL data found'); return; }
    tlDepartmentId = tlData.department_id;

    // Set name in header
    document.getElementById('tl-name').textContent = tlData.full_name;

    const { data: roleData, error: roleErr } = await supabase
        .from('roles')
        .select('id')
        .eq('role_name', 'engineer')
        .single();
    if (roleErr) { console.error(roleErr); return; }
    engineerRoleId = roleData.id;

    console.log('TL Department ID:', tlDepartmentId);
}


// Fetch requests
async function fetchRequests() {
    // Incoming (not_started)
    const { data: incoming, error: incomingErr } = await supabase
        .from('requests')
        .select(`
  id,
  project_name,
  specifications,
  deadline,
  priority,
  budget,
  status,
  users!requests_requested_by_user_id_fkey(full_name),
  services!requests_service_id_fkey(service_name)
`)

        .eq('status', 'not_started')
.filter('department_id', 'eq', tlDepartmentId);


    if (incomingErr) { console.error(incomingErr); return; }
    incomingContainer.innerHTML = '';
    incoming.forEach(renderIncomingCard);

  // Active (in_progress) — only for this TL's department. budget removed from here can be added
const { data: active, error: activeErr } = await supabase
    .from('requests')
    .select(`
        id,
        project_name,
        specifications,
        deadline,
        priority,
        status,
        users!requests_requested_by_user_id_fkey(full_name),
        services!requests_service_id_fkey(service_name),
        assigned_users!assigned_users_request_id_fkey(assigned_to_user_id)
    `)
    .eq('status', 'in_progress')
    .eq('department_id', tlDepartmentId); // <-- filter by TL's department

if (activeErr) { console.error(activeErr); return; }
activeContainer.innerHTML = '';
active.forEach(renderActiveCard);

}

// Render incoming request card
function renderIncomingCard(request) {
    const card = document.createElement('div');
    card.classList.add('request-card');
    card.dataset.requestId = request.id;

    card.innerHTML = `
        <div class="request-header">
            <h3>${request.project_name}</h3>
            <span class="request-status status-new">New</span>
        </div>
<div class="request-details">
    <p><strong>From PM:</strong> ${request.users?.full_name || 'Unknown'}</p>
    <p><strong>Requested Service:</strong> ${request.services?.service_name || '-'}</p>
    <p><strong>Specifications:</strong> ${request.specifications || '-'}</p>
    <p><strong>Priority:</strong> ${request.priority || '-'}</p>
    <p><strong>Deadline:</strong> ${request.deadline || '-'}</p>

</div>

        <div class="card-actions">
            <button class="btn-approve">Approve</button>
            <button class="btn-decline">Decline</button>
        </div>
    `;
    incomingContainer.appendChild(card);

    // Button listeners
    card.querySelector('.btn-approve').addEventListener('click', () => approveRequest(request.id, card));
    card.querySelector('.btn-decline').addEventListener('click', () => declineRequest(request.id, card));
}

// Render active request card with engineer multi-select
async function renderActiveCard(request) {
    const card = document.createElement('div');
    card.classList.add('request-card');
    card.dataset.requestId = request.id;

card.innerHTML = `
    <div class="request-header">
        <h3>${request.project_name}</h3>
        <span class="request-status status-inprogress">In Progress</span>
    </div>
    <div class="request-details">
        <p><strong>From PM:</strong> ${request.users?.full_name || 'Unknown'}</p>
        <p><strong>Requested Service:</strong> ${request.services?.service_name || '-'}</p>
        <p><strong>Specifications:</strong> ${request.specifications || '-'}</p>
        <p><strong>Priority:</strong> ${request.priority || '-'}</p>
        <p><strong>Deadline:</strong> ${request.deadline || '-'}</p>
        <p><strong>Budget:</strong> $${request.budget ?? '-'}</p>
    </div>
`;


    const assignDiv = document.createElement('div');
    assignDiv.classList.add('engineer-assign');

    const label = document.createElement('label');
    label.textContent = 'Assign Engineers:';
    assignDiv.appendChild(label);

    const select = document.createElement('select');
    select.multiple = true;
    select.style.minWidth = '200px';
    assignDiv.appendChild(select);

    const assignBtn = document.createElement('button');
    assignBtn.className = 'btn-assign';
    assignBtn.textContent = 'Assign';
    assignDiv.appendChild(assignBtn);

    card.appendChild(assignDiv);
    activeContainer.appendChild(card);

 // Populate engineers for TL department
const { data: engineers, error: engErr } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('department_id', tlDepartmentId)
    .eq('role_id', engineerRoleId);

if (engErr) { console.error(engErr); return; }
console.log('Engineers fetched:', engineers);

engineers.forEach(eng => {
    const option = document.createElement('option');
    option.value = eng.id;
    option.textContent = eng.full_name;
  if (request.assigned_users?.some(a => String(a.assigned_to_user_id) === String(eng.id))) {
    option.selected = true;
}

    select.appendChild(option);
});


    // Assign engineers
// Assign engineers
assignBtn.addEventListener('click', async () => {
    const selectedIds = Array.from(select.selectedOptions).map(o => o.value);

    // Delete existing assignments
    await supabase.from('assigned_users').delete().eq('request_id', request.id);

    // Insert new assignments with TL ID
    const inserts = selectedIds.map(eid => ({
        request_id: request.id,
        assigned_to_user_id: eid,
        assigned_by_team_leader_id: userId, // <-- important
    }));

    const { error } = await supabase.from('assigned_users').insert(inserts);
    if (error) { console.error(error); return; }

    // Optionally update status or alert
    alert('Engineers assigned successfully!');
});

}
// Approve request
async function approveRequest(requestId) {
    // 1. Update status in DB
    const { error: updateErr } = await supabase
        .from('requests')
        .update({ status: 'in_progress' })
        .eq('id', requestId);

    if (updateErr) { console.error(updateErr); return; }

    // 2. Fetch the fully updated row from DB
    const { data: requestData, error: fetchErr } = await supabase
        .from('requests')
        .select(`
            id,
            project_name,
            specifications,
            deadline,
            priority,
            budget,
            status,
            users!requests_requested_by_user_id_fkey(full_name),
            assigned_users!assigned_users_request_id_fkey(assigned_to_user_id)
        `)
        .eq('id', requestId)
        .single();

    if (fetchErr) { console.error(fetchErr); return; }

    requestData.assigned_users = requestData.assigned_users || [];

    // 3. Remove from incoming container
    const oldCard = incomingContainer.querySelector(`.request-card[data-request-id="${requestId}"]`);
    if (oldCard) oldCard.remove();

    // 4. Render in active container
    renderActiveCard(requestData);
}

// Decline request
async function declineRequest(requestId, card) {
    const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', requestId);
    if (error) { console.error(error); return; }
    card.remove();
}

// Initialize dashboard
(async function initDashboard() {
    await initTL();
    await fetchRequests();
})();