import os
import sys
import time
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_API_URL = "http://localhost:5000/api"
FRONTEND_URL = "http://localhost:5173"

def create_test_user(role="Faculty", prefix="prof"):
    timestamp = int(time.time() * 1000)
    user = {
        "email": f"{prefix}_{timestamp}@rescollab.test",
        "password": "Password123!",
        "fullName": f"Dr. Analytics {prefix.capitalize()} {timestamp}",
        "role": role
    }

    # Register
    reg_res = requests.post(f"{BASE_API_URL}/auth/register", json=user)
    assert reg_res.status_code in (200, 201), f"Registration failed: {reg_res.text}"

    # Login
    login_res = requests.post(f"{BASE_API_URL}/auth/login", json=user)
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    login_data = login_res.json()

    return {
        "email": user["email"],
        "password": user["password"],
        "fullName": user["fullName"],
        "role": role,
        "token": login_data.get("token", ""),
        "id": login_data.get("user", {}).get("id")
    }

def test_analytics_calculations_permissions_empty_data():
    print("==========================================================================================")
    print("=== STARTING T-018.5: ANALYTICS CALCULATIONS, PERMISSIONS & EMPTY DATA AUTOMATION SUITE ===")
    print("==========================================================================================")

    timestamp = int(time.time())

    # Create Actors
    print("\n1. Creating test actors for permissions and role testing...")
    faculty_user = create_test_user(role="Faculty", prefix="faculty")
    student_user = create_test_user(role="Student", prefix="student")
    outsider_user = create_test_user(role="Faculty", prefix="outsider")
    fresh_user = create_test_user(role="Student", prefix="fresh")

    faculty_headers = {
        "Authorization": f"Bearer {faculty_user['token']}",
        "Content-Type": "application/json"
    }
    student_headers = {
        "Authorization": f"Bearer {student_user['token']}",
        "Content-Type": "application/json"
    }
    outsider_headers = {
        "Authorization": f"Bearer {outsider_user['token']}",
        "Content-Type": "application/json"
    }
    fresh_headers = {
        "Authorization": f"Bearer {fresh_user['token']}",
        "Content-Type": "application/json"
    }

    print(f"[PASS] Actors registered: Faculty (#{faculty_user['id']}), Student (#{student_user['id']}), Outsider (#{outsider_user['id']}), Fresh (#{fresh_user['id']})")

    # =========================================================================
    # PHASE 1: PERMISSIONS & SECURITY BOUNDARY ENFORCEMENT
    # =========================================================================
    print("\n--- PHASE 1: PERMISSIONS & SECURITY BOUNDARY ENFORCEMENT ---")

    # 1. Unauthenticated Access strictly returns 401 Unauthorized
    print("1. Validating 401 Unauthorized across all analytics endpoints without JWT token...")
    unauth_endpoints = [
        ("GET", f"{BASE_API_URL}/analytics/summary"),
        ("GET", f"{BASE_API_URL}/analytics/institutional/1"),
        ("GET", f"{BASE_API_URL}/analytics/department/1"),
        ("GET", f"{BASE_API_URL}/analytics/researcher/1"),
        ("GET", f"{BASE_API_URL}/analytics/team/1"),
        ("POST", f"{BASE_API_URL}/analytics/recalculate")
    ]
    for method, url in unauth_endpoints:
        if method == "GET":
            res = requests.get(url)
        else:
            res = requests.post(url)
        assert res.status_code == 401, f"Expected 401 Unauthorized for unauthenticated {method} {url}, got {res.status_code}"
    print("[PASS] Security boundary verified: All unauthenticated analytics requests strictly rejected with 401 Unauthorized.")

    # 2. Non-existent IDs return 404 Not Found
    print("2. Validating 404 Not Found for non-existent IDs...")
    not_found_endpoints = [
        f"{BASE_API_URL}/analytics/institutional/999999",
        f"{BASE_API_URL}/analytics/department/999999",
        f"{BASE_API_URL}/analytics/researcher/999999",
        f"{BASE_API_URL}/analytics/team/999999"
    ]
    for url in not_found_endpoints:
        res = requests.get(url, headers=faculty_headers)
        assert res.status_code == 404, f"Expected 404 Not Found for {url}, got {res.status_code}"
    print("[PASS] 404 Not Found successfully returned for non-existent entity requests.")

    # 3. Role-Based Security: Student cannot trigger platform recalculate (403 Forbidden)
    print("3. Validating role permission on /api/analytics/recalculate (Student denied with 403)...")
    student_recalc_res = requests.post(f"{BASE_API_URL}/analytics/recalculate", headers=student_headers)
    assert student_recalc_res.status_code == 403, f"Expected 403 Forbidden for Student on recalculate, got {student_recalc_res.status_code}"
    print("[PASS] Role boundary verified: Student role strictly blocked (403 Forbidden) from recalculating platform metrics.")

    # Faculty is authorized to recalculate
    faculty_recalc_res = requests.post(f"{BASE_API_URL}/analytics/recalculate", headers=faculty_headers)
    assert faculty_recalc_res.status_code == 200, f"Expected 200 OK for Faculty on recalculate, got {faculty_recalc_res.status_code}"
    recalc_data = faculty_recalc_res.json()
    assert "snapshotsGenerated" in recalc_data
    print("[PASS] Faculty successfully triggered analytics recalculation (200 OK).")

    # 4. Workspace Membership Security: Non-members cannot access team analytics (403 Forbidden)
    print("4. Validating Workspace Access Security (Non-member rejected with 403 Forbidden)...")
    ws_payload = {
        "name": f"Faculty Private Research Workspace {timestamp}",
        "description": "Restricted workspace for quantum tensor algorithms"
    }
    ws_res = requests.post(f"{BASE_API_URL}/workspace", headers=faculty_headers, json=ws_payload)
    assert ws_res.status_code == 201, f"Failed to create workspace: {ws_res.text}"
    ws_id = ws_res.json()["workspaceId"]
    print(f"Created private workspace #{ws_id} owned by Faculty user.")

    # Outsider attempts to read workspace team analytics
    outsider_ws_res = requests.get(f"{BASE_API_URL}/analytics/team/{ws_id}", headers=outsider_headers)
    assert outsider_ws_res.status_code == 403, f"Expected 403 Forbidden for outsider on team analytics, got {outsider_ws_res.status_code}"
    print("[PASS] Workspace boundary verified: Non-member denied with 403 Forbidden.")

    # Faculty member reads workspace team analytics
    faculty_ws_res = requests.get(f"{BASE_API_URL}/analytics/team/{ws_id}", headers=faculty_headers)
    assert faculty_ws_res.status_code == 200, f"Expected 200 OK for member, got {faculty_ws_res.status_code}"
    print("[PASS] Authorized workspace member successfully accessed team analytics (200 OK).")

    # =========================================================================
    # PHASE 2: EMPTY DATA & ZERO-DIVISION ROBUSTNESS
    # =========================================================================
    print("\n--- PHASE 2: EMPTY DATA & ZERO-DIVISION ROBUSTNESS ---")

    # 1. Fresh user with zero records
    print(f"1. Validating researcher analytics on fresh user #{fresh_user['id']} (Zero publications, zero tasks)...")
    fresh_analytics_res = requests.get(f"{BASE_API_URL}/analytics/researcher/{fresh_user['id']}", headers=fresh_headers)
    assert fresh_analytics_res.status_code == 200, f"Failed to retrieve fresh user analytics: {fresh_analytics_res.text}"
    fresh_data = fresh_analytics_res.json()
    assert fresh_data["totalPublications"] == 0, f"Expected 0 publications, got {fresh_data['totalPublications']}"
    assert fresh_data["activeProjectsCount"] == 0, f"Expected 0 projects, got {fresh_data['activeProjectsCount']}"
    assert fresh_data["collaboratorsCount"] == 0, f"Expected 0 collaborators, got {fresh_data['collaboratorsCount']}"
    assert fresh_data["totalAssignedTasks"] == 0, f"Expected 0 assigned tasks, got {fresh_data['totalAssignedTasks']}"
    assert fresh_data["completedTasksCount"] == 0, f"Expected 0 completed tasks, got {fresh_data['completedTasksCount']}"
    assert fresh_data["taskCompletionRate"] == 0.0, f"Expected 0.0% completion rate (no NaN/zero-div), got {fresh_data['taskCompletionRate']}"
    assert fresh_data["taskVelocity30Days"] == 0, f"Expected 0 velocity, got {fresh_data['taskVelocity30Days']}"
    assert fresh_data["publicationsTimeline"] == [], "Expected empty publication timeline"
    print("[PASS] Fresh user handled cleanly: Zero tasks resulted in safe 0.0% completion rate with no NaN or server errors.")

    # 2. Empty Workspace with zero tasks
    print("2. Validating empty workspace analytics (Zero tasks, zero milestones)...")
    empty_ws_payload = {
        "name": f"Empty Workspace {timestamp}",
        "description": "No tasks created yet"
    }
    empty_ws_res = requests.post(f"{BASE_API_URL}/workspace", headers=outsider_headers, json=empty_ws_payload)
    assert empty_ws_res.status_code == 201
    empty_ws_id = empty_ws_res.json()["workspaceId"]

    empty_team_res = requests.get(f"{BASE_API_URL}/analytics/team/{empty_ws_id}", headers=outsider_headers)
    assert empty_team_res.status_code == 200, f"Failed to get empty team analytics: {empty_team_res.text}"
    empty_team_data = empty_team_res.json()
    assert empty_team_data["totalTasksCount"] == 0
    assert empty_team_data["completedTasksCount"] == 0
    assert empty_team_data["inProgressTasksCount"] == 0
    assert empty_team_data["pendingTasksCount"] == 0
    assert empty_team_data["taskCompletionRate"] == 0.0
    assert empty_team_data["milestoneTasksCount"] == 0
    assert len(empty_team_data["memberContributions"]) == 1
    owner_contrib = empty_team_data["memberContributions"][0]
    assert owner_contrib["assignedTasksCount"] == 0
    assert owner_contrib["completedTasksCount"] == 0
    assert owner_contrib["taskCompletionRate"] == 0.0
    assert owner_contrib["contributionPercentage"] == 0.0
    assert empty_team_data["recentTasks"] == []
    print("[PASS] Empty workspace handled cleanly: Zero tasks resulted in safe 0.0% task rates and clean contributor defaults.")

    # 3. Empty University with zero departments and zero researchers
    print("3. Validating empty university institutional analytics...")
    empty_uni_payload = {
        "name": f"Empty University of Science {timestamp}",
        "country": "Iceland",
        "city": "Reykjavik",
        "website": "https://empty-uni.is",
        "description": "Newly chartered institution with no affiliated faculty yet."
    }
    empty_uni_res = requests.post(f"{BASE_API_URL}/university", headers=faculty_headers, json=empty_uni_payload)
    assert empty_uni_res.status_code == 201
    empty_uni_id = empty_uni_res.json()["id"]

    empty_inst_res = requests.get(f"{BASE_API_URL}/analytics/institutional/{empty_uni_id}", headers=faculty_headers)
    assert empty_inst_res.status_code == 200, f"Failed to get empty institutional analytics: {empty_inst_res.text}"
    empty_inst_data = empty_inst_res.json()
    assert empty_inst_data["totalResearchers"] == 0
    assert empty_inst_data["facultyCount"] == 0
    assert empty_inst_data["studentCount"] == 0
    assert empty_inst_data["totalPublications"] == 0
    assert empty_inst_data["activeWorkspacesCount"] == 0
    assert empty_inst_data["openProjectsCount"] == 0
    assert empty_inst_data["laboratoriesCount"] == 0
    assert empty_inst_data["departments"] == []
    assert empty_inst_data["publicationTrends"] == []
    assert empty_inst_data["crossInstitutionalCollaborations"] == []
    print("[PASS] Empty university handled cleanly: All metric arrays and counts initialized with zero/empty structures.")

    # =========================================================================
    # PHASE 3: MATHEMATICAL CALCULATIONS & AGGREGATIONS VERIFICATION
    # =========================================================================
    print("\n--- PHASE 3: MATHEMATICAL CALCULATIONS & AGGREGATIONS VERIFICATION ---")

    # 1. Setup Test University and Department
    uni_name = f"Ontario Tech Institute {timestamp}"
    uni_payload = {
        "name": uni_name,
        "country": "Canada",
        "city": "Toronto",
        "website": "https://ontario-tech.ca",
        "description": "Institute focused on machine intelligence and advanced computing."
    }
    uni_res = requests.post(f"{BASE_API_URL}/university", headers=faculty_headers, json=uni_payload)
    assert uni_res.status_code == 201
    uni_id = uni_res.json()["id"]

    dept_name = f"Computer Science & Machine Intelligence {timestamp}"
    dept_payload = {
        "name": dept_name,
        "description": "Department of CS and AI algorithms",
        "headOfDepartment": faculty_user["fullName"],
        "visibility": "Public"
    }
    dept_res = requests.post(f"{BASE_API_URL}/university/{uni_id}/departments", headers=faculty_headers, json=dept_payload)
    assert dept_res.status_code == 201
    dept_id = dept_res.json()["id"]

    # 2. Update Profiles with University, Department, and Research Interests
    print("1. Updating Faculty and Student profiles with institutional affiliation...")
    faculty_profile_update = {
        "university": uni_name,
        "department": dept_name,
        "interests": "Artificial Intelligence, Quantum Computing, Bioinformatics"
    }
    p1 = requests.put(f"{BASE_API_URL}/profile", headers=faculty_headers, json=faculty_profile_update)
    assert p1.status_code == 200

    student_profile_update = {
        "university": uni_name,
        "department": dept_name,
        "interests": "Artificial Intelligence, Deep Learning"
    }
    p2 = requests.put(f"{BASE_API_URL}/profile", headers=student_headers, json=student_profile_update)
    assert p2.status_code == 200

    # 3. Create Connection between Faculty and Student
    print("2. Establishing verified connection between Faculty and Student...")
    conn_req = requests.post(f"{BASE_API_URL}/network/connect/{student_user['id']}", headers=faculty_headers)
    assert conn_req.status_code == 200
    conn_acc = requests.put(f"{BASE_API_URL}/network/connect/{faculty_user['id']}/accept", headers=student_headers)
    assert conn_acc.status_code == 200

    # 4. Create Publications for Faculty
    print("3. Seeding publications with distinct years (2024, 2025)...")
    pub1 = {
        "title": f"Neural Graph Transformers {timestamp}",
        "authors": faculty_user["fullName"],
        "publicationYear": 2024,
        "journalOrConference": "IEEE Transactions on Neural Networks",
        "publicationType": "Journal",
        "visibility": "Public"
    }
    pub2 = {
        "title": f"Distributed Quantum Kernels {timestamp}",
        "authors": faculty_user["fullName"],
        "publicationYear": 2025,
        "journalOrConference": "NeurIPS",
        "publicationType": "Conference",
        "visibility": "Public"
    }
    pub3 = {
        "title": f"Federated Privacy Enclaves {timestamp}",
        "authors": faculty_user["fullName"],
        "publicationYear": 2025,
        "journalOrConference": "ACM Computing Surveys",
        "publicationType": "Journal",
        "visibility": "Public"
    }
    for p in [pub1, pub2, pub3]:
        r = requests.post(f"{BASE_API_URL}/publication", headers=faculty_headers, json=p)
        assert r.status_code == 201, f"Failed to create publication: {r.text}"

    # 5. Create Tasks in Workspace assigned to Faculty
    # 4 tasks: 2 completed (1 'Done', 1 'Completed'), 1 'InProgress', 1 'Todo'
    # 2 are milestones
    print("4. Creating workspace tasks with distinct statuses and milestones...")
    t1_res = requests.post(f"{BASE_API_URL}/workspaces/{ws_id}/tasks", headers=faculty_headers, json={
        "title": "Formulate Mathematical Proofs",
        "assignedToId": faculty_user["id"],
        "isMilestone": True
    })
    assert t1_res.status_code == 201
    t1_id = t1_res.json()["id"]
    requests.patch(f"{BASE_API_URL}/workspaces/{ws_id}/tasks/{t1_id}", headers=faculty_headers, json={"status": "Done"})

    t2_res = requests.post(f"{BASE_API_URL}/workspaces/{ws_id}/tasks", headers=faculty_headers, json={
        "title": "Benchmark Latency Metrics",
        "assignedToId": faculty_user["id"],
        "isMilestone": False
    })
    assert t2_res.status_code == 201
    t2_id = t2_res.json()["id"]
    requests.patch(f"{BASE_API_URL}/workspaces/{ws_id}/tasks/{t2_id}", headers=faculty_headers, json={"status": "Completed"})

    t3_res = requests.post(f"{BASE_API_URL}/workspaces/{ws_id}/tasks", headers=faculty_headers, json={
        "title": "Optimize CUDA Kernels",
        "assignedToId": faculty_user["id"],
        "isMilestone": False
    })
    assert t3_res.status_code == 201
    t3_id = t3_res.json()["id"]
    requests.patch(f"{BASE_API_URL}/workspaces/{ws_id}/tasks/{t3_id}", headers=faculty_headers, json={"status": "InProgress"})

    t4_res = requests.post(f"{BASE_API_URL}/workspaces/{ws_id}/tasks", headers=faculty_headers, json={
        "title": "Draft Research Whitepaper",
        "assignedToId": faculty_user["id"],
        "isMilestone": True
    })
    assert t4_res.status_code == 201
    # Remains "Todo"

    # 6. Verify Mathematical Formulas on Researcher Analytics
    print("5. Verifying Researcher Analytics calculation formulas...")
    calc_res = requests.get(f"{BASE_API_URL}/analytics/researcher/{faculty_user['id']}", headers=faculty_headers)
    assert calc_res.status_code == 200
    r_data = calc_res.json()

    print(f"   - Total Publications: {r_data['totalPublications']} (Expected: 3)")
    assert r_data["totalPublications"] == 3
    print(f"   - Collaborators Count: {r_data['collaboratorsCount']} (Expected >= 1)")
    assert r_data["collaboratorsCount"] >= 1
    print(f"   - Total Assigned Tasks: {r_data['totalAssignedTasks']} (Expected: 4)")
    assert r_data["totalAssignedTasks"] == 4
    print(f"   - Completed Tasks: {r_data['completedTasksCount']} (Expected: 2)")
    assert r_data["completedTasksCount"] == 2
    print(f"   - Completion Rate: {r_data['taskCompletionRate']}% (Expected: 50.0%)")
    assert r_data["taskCompletionRate"] == 50.0, f"Expected 50.0% completion rate (2/4), got {r_data['taskCompletionRate']}"
    print(f"   - Task Velocity 30 Days: {r_data['taskVelocity30Days']} (Expected: 2)")
    assert r_data["taskVelocity30Days"] == 2

    # Verify Publication Timeline grouped by year
    years_dict = {item["year"]: item["count"] for item in r_data["publicationsTimeline"]}
    assert years_dict.get(2024) == 1, f"Expected 1 pub in 2024, got {years_dict.get(2024)}"
    assert years_dict.get(2025) == 2, f"Expected 2 pubs in 2025, got {years_dict.get(2025)}"
    print("[PASS] Researcher metrics mathematical accuracy verified: 50.0% completion rate and exact timeline distribution.")

    # 7. Verify Team / Workspace Calculations
    print("6. Verifying Workspace Team Analytics calculations...")
    team_calc_res = requests.get(f"{BASE_API_URL}/analytics/team/{ws_id}", headers=faculty_headers)
    assert team_calc_res.status_code == 200
    t_data = team_calc_res.json()
    assert t_data["totalTasksCount"] == 4
    assert t_data["completedTasksCount"] == 2
    assert t_data["inProgressTasksCount"] == 1
    assert t_data["pendingTasksCount"] == 1
    assert t_data["taskCompletionRate"] == 50.0
    assert t_data["milestoneTasksCount"] == 2

    # Verify Member contribution metrics
    faculty_contrib = next(m for m in t_data["memberContributions"] if m["userId"] == faculty_user["id"])
    assert faculty_contrib["assignedTasksCount"] == 4
    assert faculty_contrib["completedTasksCount"] == 2
    assert faculty_contrib["taskCompletionRate"] == 50.0
    assert faculty_contrib["contributionPercentage"] == 100.0, f"Expected 100.0% sprint share (2/2 completed tasks), got {faculty_contrib['contributionPercentage']}"
    print("[PASS] Team metrics mathematical accuracy verified: Task breakdown, milestones, and member contribution rates.")

    # 8. Verify Institutional Analytics Calculations
    print("7. Verifying Institutional Analytics calculations...")
    inst_calc_res = requests.get(f"{BASE_API_URL}/analytics/institutional/{uni_id}", headers=faculty_headers)
    assert inst_calc_res.status_code == 200
    inst_data = inst_calc_res.json()
    assert inst_data["totalResearchers"] >= 2, f"Expected >= 2 researchers (Faculty + Student), got {inst_data['totalResearchers']}"
    assert inst_data["facultyCount"] >= 1
    assert inst_data["studentCount"] >= 1
    assert inst_data["totalPublications"] >= 3
    dept_stat = next(d for d in inst_data["departments"] if d["departmentId"] == dept_id)
    assert dept_stat["researchersCount"] >= 2
    assert dept_stat["publicationsCount"] >= 3
    print("[PASS] Institutional analytics aggregation verified: Researchers count, faculty/student ratio, and department rollups.")

    # 9. Verify Department Analytics Calculations
    print("8. Verifying Department Analytics calculations...")
    dept_calc_res = requests.get(f"{BASE_API_URL}/analytics/department/{dept_id}", headers=faculty_headers)
    assert dept_calc_res.status_code == 200
    dept_data = dept_calc_res.json()
    assert dept_data["departmentId"] == dept_id
    assert dept_data["totalResearchers"] >= 2
    assert dept_data["facultyCount"] >= 1
    assert dept_data["studentCount"] >= 1
    assert dept_data["totalPublications"] >= 3
    print("[PASS] Departmental metrics confirmed matching university rollups.")

    # 10. Verify Global Platform Summary Calculations
    print("9. Verifying Global Platform Summary metrics...")
    summary_res = requests.get(f"{BASE_API_URL}/analytics/summary", headers=faculty_headers)
    assert summary_res.status_code == 200
    s_data = summary_res.json()
    assert s_data["totalResearchers"] >= 4
    assert s_data["totalPublications"] >= 3
    assert s_data["totalWorkspaces"] >= 2
    # Verify top research tags parsed from profile interests
    top_tags = [t["tag"].lower() for t in s_data["topResearchAreas"]]
    assert any("artificial intelligence" in t for t in top_tags), f"Top tags should contain AI: {top_tags}"
    print("[PASS] Global summary aggregates and research area frequency tags successfully computed.")


    # =========================================================================
    # PHASE 4: SELENIUM E2E BROWSER UI AUTOMATION WORKFLOW
    # =========================================================================
    print("\n--- PHASE 4: SELENIUM E2E BROWSER UI WORKFLOW ---")

    options = webdriver.ChromeOptions()
    if os.environ.get("HEADLESS", "false").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,960")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 15)

    try:
        # Step 1: Login via UI
        print(f"1. Logging in as Faculty user '{faculty_user['email']}' via UI...")
        driver.get(f"{FRONTEND_URL}/login")
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(faculty_user["email"])
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(faculty_user["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        print("[PASS] Logged in successfully and landed on profile page.")

        # Step 2: Navigate to /analytics
        print("2. Navigating to Analytics Dashboard (/analytics)...")
        driver.get(f"{FRONTEND_URL}/analytics")
        wait.until(EC.presence_of_element_located((By.ID, "research-analytics-dashboard")))
        time.sleep(1.0)

        # Verify page title
        header_text = driver.find_element(By.CLASS_NAME, "analytics-header").text
        assert "Research & Collaboration Analytics" in header_text
        print("[PASS] Analytics Dashboard loaded successfully with primary header.")

        # Step 3: Validate Tab 1 - Global Pulse
        print("3. Validating Tab 1: Global Pulse metrics & topic tags...")
        global_tab_btn = driver.find_element(By.ID, "tab-analytics-global")
        assert "active" in global_tab_btn.get_attribute("class")

        wait.until(EC.presence_of_element_located((By.ID, "card-metric-researchers")))
        researcher_card_text = driver.find_element(By.ID, "card-metric-researchers").text.lower()
        pub_card_text = driver.find_element(By.ID, "card-metric-publications").text.lower()
        ws_card_text = driver.find_element(By.ID, "card-metric-workspaces").text.lower()
        collab_card_text = driver.find_element(By.ID, "card-metric-collaborations").text.lower()

        assert "active researchers" in researcher_card_text
        assert "total publications" in pub_card_text
        assert "active workspaces" in ws_card_text
        assert "inter-researcher links" in collab_card_text
        print(f"[PASS] Global KPI cards rendered: Researchers, Publications, Workspaces, Collaborations.")

        # Verify tags cloud
        tags_cloud = driver.find_element(By.CLASS_NAME, "tags-cloud")
        assert len(tags_cloud.find_elements(By.CLASS_NAME, "topic-tag-chip")) > 0
        print("[PASS] Top research discipline tag chips displayed in tags cloud.")

        # Step 4: Validate Tab 2 - Institutional Metrics
        print("4. Switching to Tab 2: Institutional Metrics...")
        inst_tab_btn = wait.until(EC.element_to_be_clickable((By.ID, "tab-analytics-institution")))
        driver.execute_script("arguments[0].click();", inst_tab_btn)
        wait.until(EC.presence_of_element_located((By.ID, "panel-analytics-institution")))
        time.sleep(1.0)

        # Select test university in dropdown
        inst_select_elem = wait.until(EC.presence_of_element_located((By.ID, "select-analytics-institution")))
        select_inst = Select(inst_select_elem)
        select_inst.select_by_value(str(uni_id))
        time.sleep(1.0)

        # Verify institutional banner & breakdown table
        inst_panel = driver.find_element(By.ID, "panel-analytics-institution")
        inst_text = inst_panel.text.lower()
        assert uni_name.lower() in inst_text
        assert "verified institution" in inst_text

        table_elem = wait.until(EC.presence_of_element_located((By.ID, "table-analytics-breakdown")))
        assert dept_name.lower() in table_elem.text.lower()
        print(f"[PASS] Institutional analytics verified: '{uni_name}' loaded with department breakdown.")

        # Test Department Search filtering
        dept_search_input = inst_panel.find_element(By.CSS_SELECTOR, "input[placeholder='Search departments...']")
        dept_search_input.clear()
        dept_search_input.send_keys("Machine Intelligence")
        time.sleep(0.5)
        filtered_table_text = driver.find_element(By.ID, "table-analytics-breakdown").text.lower()
        assert dept_name.lower() in filtered_table_text
        print("[PASS] Department search filter responsive and operating correctly.")

        # Step 5: Validate Tab 3 - Team & Workspace Velocity
        print("5. Switching to Tab 3: Team & Workspace Velocity...")
        team_tab_btn = wait.until(EC.element_to_be_clickable((By.ID, "tab-analytics-team")))
        driver.execute_script("arguments[0].click();", team_tab_btn)
        wait.until(EC.presence_of_element_located((By.ID, "panel-analytics-team")))
        time.sleep(1.0)

        # Select test workspace in dropdown
        ws_select_elem = wait.until(EC.presence_of_element_located((By.ID, "select-analytics-workspace")))
        select_ws = Select(ws_select_elem)
        select_ws.select_by_value(str(ws_id))
        time.sleep(1.0)

        team_panel = driver.find_element(By.ID, "panel-analytics-team")
        team_text = team_panel.text.lower()
        assert "50%" in team_text, "Expected 50% velocity on team dashboard"
        assert "2 done" in team_text
        assert "1 in-prog" in team_text
        assert "milestones met" in team_text

        # Verify member contribution row
        assert faculty_user["fullName"].lower() in team_text
        print(f"[PASS] Team velocity dashboard verified: 50% completion velocity, segmented task progress, and member matrix.")

        # Step 6: Validate Tab 5 - Researcher Metrics
        print("6. Switching to Tab 5: Researcher Metrics...")
        researcher_tab_btn = wait.until(EC.element_to_be_clickable((By.ID, "tab-analytics-researcher")))
        driver.execute_script("arguments[0].click();", researcher_tab_btn)
        wait.until(EC.presence_of_element_located((By.ID, "panel-analytics-researcher")))
        time.sleep(1.0)

        # Look up Faculty researcher by ID
        researcher_input = wait.until(EC.presence_of_element_located((By.ID, "input-analytics-researcher-id")))
        researcher_input.clear()
        researcher_input.send_keys(str(faculty_user["id"]))
        analyze_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Analyze Researcher')]")
        driver.execute_script("arguments[0].click();", analyze_btn)
        time.sleep(1.0)

        researcher_panel = driver.find_element(By.ID, "panel-analytics-researcher")
        researcher_text = researcher_panel.text.lower()
        assert faculty_user["fullName"].lower() in researcher_text
        assert "50%" in researcher_text, "Expected 50% completion rate displayed"
        assert "3" in researcher_text, "Expected 3 publications"
        print("[PASS] Researcher metrics tab verified: Profile header, 50% task velocity, and publication counts.")

        # Test Empty User Lookup in UI (Empty State Robustness)
        print("7. Testing empty user (#fresh_user) lookup in Researcher Tab...")
        researcher_input.clear()
        researcher_input.send_keys(str(fresh_user["id"]))
        driver.execute_script("arguments[0].click();", analyze_btn)
        time.sleep(1.0)

        empty_researcher_panel = driver.find_element(By.ID, "panel-analytics-researcher")
        empty_text = empty_researcher_panel.text.lower()
        assert fresh_user["fullName"].lower() in empty_text
        assert "0%" in empty_text
        print("[PASS] Fresh user empty state handled gracefully in UI with 0% rate and no exceptions.")

        # Step 7: Test Recalculate Metrics Button
        print("8. Testing 'Recalculate Metrics' button in header...")
        recalc_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-analytics-recalculate")))
        driver.execute_script("arguments[0].click();", recalc_btn)
        
        # Verify toast notification appears
        toast_elem = wait.until(EC.presence_of_element_located((By.ID, "analytics-toast")))
        toast_text = toast_elem.text
        assert "recalculated successfully" in toast_text.lower(), f"Unexpected toast text: {toast_text}"
        safe_toast = toast_text.encode("ascii", "replace").decode("ascii").strip()
        print(f"[PASS] Recalculate button triggered successfully: Toast received: '{safe_toast}'")

        print("\n==========================================================================================")
        print("=== ALL T-018.5 ANALYTICS CALCULATIONS, PERMISSIONS & EMPTY DATA TESTS PASSED SUCCESSFULLY! ===")
        print("==========================================================================================")

    finally:
        driver.quit()

if __name__ == "__main__":
    test_analytics_calculations_permissions_empty_data()
