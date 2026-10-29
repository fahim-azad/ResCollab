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

def create_test_user(role="Faculty", prefix="integ_user"):
    timestamp = int(time.time() * 1000)
    user = {
        "email": f"{prefix}_{timestamp}@rescollab.test",
        "password": "Password123!",
        "fullName": f"Dr. {prefix.replace('_', ' ').title()} {timestamp}",
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

def test_analytics_api_ui_integration():
    print("==========================================================================================")
    print("=== STARTING T-018.6: RESEARCH ANALYTICS API / UI INTEGRATION VALIDATION SUITE        ===")
    print("==========================================================================================")

    timestamp = int(time.time())

    # =========================================================================
    # PREPARATION & SEED DATA (API LEVEL)
    # =========================================================================
    print("\n--- STEP 0: PREPARING INTEGRATION ACTORS & INSTITUTIONAL SEED DATA ---")

    # 1. Primary Faculty User & Partner Collaborator User
    faculty_user = create_test_user(role="Faculty", prefix="lead_faculty")
    collaborator_user = create_test_user(role="Faculty", prefix="partner_pi")

    faculty_headers = {
        "Authorization": f"Bearer {faculty_user['token']}",
        "Content-Type": "application/json"
    }
    collab_headers = {
        "Authorization": f"Bearer {collaborator_user['token']}",
        "Content-Type": "application/json"
    }

    # 2. Institution A (Lead University) & Institution B (Partner University)
    uni_a_name = f"Cambridge Advanced Institute {timestamp}"
    uni_a_res = requests.post(f"{BASE_API_URL}/university", headers=faculty_headers, json={
        "name": uni_a_name,
        "country": "United Kingdom",
        "city": "Cambridge",
        "website": "https://cam-adv.ac.uk",
        "description": "Institute pioneering quantum tensor systems and AI architecture."
    })
    assert uni_a_res.status_code == 201
    uni_a_id = uni_a_res.json()["id"]

    uni_b_name = f"Oxford Computational Center {timestamp}"
    uni_b_res = requests.post(f"{BASE_API_URL}/university", headers=collab_headers, json={
        "name": uni_b_name,
        "country": "United Kingdom",
        "city": "Oxford",
        "website": "https://ox-comp.ac.uk",
        "description": "Center specializing in distributed cryptographic protocols."
    })
    assert uni_b_res.status_code == 201
    uni_b_id = uni_b_res.json()["id"]

    # 3. Create Departments under Institution A
    dept_a1_name = f"Quantum Computing & Systems {timestamp}"
    dept_a1_res = requests.post(f"{BASE_API_URL}/university/{uni_a_id}/departments", headers=faculty_headers, json={
        "name": dept_a1_name,
        "description": "Department focusing on superconducting quantum qubits.",
        "headOfDepartment": faculty_user["fullName"],
        "visibility": "Public"
    })
    assert dept_a1_res.status_code == 201
    dept_a1_id = dept_a1_res.json()["id"]

    dept_a2_name = f"Cybersecurity & Cryptography {timestamp}"
    dept_a2_res = requests.post(f"{BASE_API_URL}/university/{uni_a_id}/departments", headers=faculty_headers, json={
        "name": dept_a2_name,
        "description": "Post-quantum cryptographic algorithms.",
        "headOfDepartment": "Dr. Alan Turing",
        "visibility": "Public"
    })
    assert dept_a2_res.status_code == 201
    dept_a2_id = dept_a2_res.json()["id"]

    # 4. Associate Profiles with Institutions and Topics
    requests.put(f"{BASE_API_URL}/profile", headers=faculty_headers, json={
        "university": uni_a_name,
        "department": dept_a1_name,
        "interests": "Quantum Computing, Distributed Systems, Neural Networks",
        "bio": "Principal investigator in quantum compiler optimization."
    })

    requests.put(f"{BASE_API_URL}/profile", headers=collab_headers, json={
        "university": uni_b_name,
        "department": "Quantum Cryptography",
        "interests": "Cryptographic Protocols, Quantum Computing",
        "bio": "Senior researcher in lattice cryptography."
    })

    # 5. Establish Cross-Institutional Connection (Uni A <-> Uni B)
    conn_req = requests.post(f"{BASE_API_URL}/network/connect/{collaborator_user['id']}", headers=faculty_headers)
    assert conn_req.status_code == 200
    conn_acc = requests.put(f"{BASE_API_URL}/network/connect/{faculty_user['id']}/accept", headers=collab_headers)
    assert conn_acc.status_code == 200

    # 6. Seed Publications for Faculty User
    pub1 = {
        "title": f"Scalable Quantum Supercomputing {timestamp}",
        "authors": faculty_user["fullName"],
        "publicationYear": 2024,
        "journalOrConference": "IEEE Transactions on Quantum Engineering",
        "publicationType": "Journal",
        "visibility": "Public"
    }
    pub2 = {
        "title": f"Fault-Tolerant Lattice Protocols {timestamp}",
        "authors": f"{faculty_user['fullName']}, {collaborator_user['fullName']}",
        "publicationYear": 2025,
        "journalOrConference": "ACM SIGCOMM",
        "publicationType": "Conference",
        "visibility": "Public"
    }
    for p in [pub1, pub2]:
        p_res = requests.post(f"{BASE_API_URL}/publication", headers=faculty_headers, json=p)
        assert p_res.status_code == 201

    # 7. Seed Collaborative Workspace & Sprint Tasks
    ws_res = requests.post(f"{BASE_API_URL}/workspace", headers=faculty_headers, json={
        "name": f"Quantum Teleportation Initiative {timestamp}",
        "description": "Cross-institutional sprint workspace on entanglement fidelity."
    })
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["workspaceId"]

    # Add 3 tasks: 1 Done (Milestone), 1 InProgress, 1 Todo
    t1_res = requests.post(f"{BASE_API_URL}/workspaces/{ws_id}/tasks", headers=faculty_headers, json={
        "title": "Cryogenic Rig Calibration",
        "assignedToId": faculty_user["id"],
        "isMilestone": True
    })
    assert t1_res.status_code == 201
    requests.patch(f"{BASE_API_URL}/workspaces/{ws_id}/tasks/{t1_res.json()['id']}", headers=faculty_headers, json={"status": "Done"})

    t2_res = requests.post(f"{BASE_API_URL}/workspaces/{ws_id}/tasks", headers=faculty_headers, json={
        "title": "Qubit Fidelity Benchmarks",
        "assignedToId": faculty_user["id"],
        "isMilestone": False
    })
    assert t2_res.status_code == 201
    requests.patch(f"{BASE_API_URL}/workspaces/{ws_id}/tasks/{t2_res.json()['id']}", headers=faculty_headers, json={"status": "InProgress"})

    t3_res = requests.post(f"{BASE_API_URL}/workspaces/{ws_id}/tasks", headers=faculty_headers, json={
        "title": "Draft Cross-Institution Paper",
        "assignedToId": faculty_user["id"],
        "isMilestone": True
    })
    assert t3_res.status_code == 201

    print(f"[PASS] Data seeded: Institution A (#{uni_a_id}), Institution B (#{uni_b_id}), Workspace (#{ws_id}), Faculty (#{faculty_user['id']})")


    # =========================================================================
    # SELENIUM BROWSER E2E INTEGRATION FLOW
    # =========================================================================
    print("\n--- STARTING SELENIUM BROWSER INTEGRATION RUN ---")

    options = webdriver.ChromeOptions()
    if os.environ.get("HEADLESS", "false").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,960")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 15)

    try:
        # ---------------------------------------------------------------------
        # PHASE 1: LOGIN & SIDEBAR NAVIGATION INTEGRATION
        # ---------------------------------------------------------------------
        print("\n--- PHASE 1: LOGIN & SIDEBAR NAVIGATION INTEGRATION ---")
        print(f"1. Logging in as Faculty user '{faculty_user['email']}'...")
        driver.get(f"{FRONTEND_URL}/login")

        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(faculty_user["email"])
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(faculty_user["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        print("[PASS] User logged in and landed on /profile.")

        # Navigate to Analytics via Sidebar NavLink
        print("2. Navigating to Analytics via Sidebar navigation link (#nav-sidebar-analytics)...")
        analytics_sidebar_link = wait.until(EC.element_to_be_clickable((By.ID, "nav-sidebar-analytics")))
        driver.execute_script("arguments[0].click();", analytics_sidebar_link)
        wait.until(EC.url_contains("/analytics"))
        wait.until(EC.presence_of_element_located((By.ID, "research-analytics-dashboard")))
        print("[PASS] Navigation integration verified: Sidebar link successfully routed to /analytics.")

        # ---------------------------------------------------------------------
        # PHASE 2: GLOBAL PULSE DATA BINDING & RESEARCH AREA TAGS
        # ---------------------------------------------------------------------
        print("\n--- PHASE 2: GLOBAL PULSE DATA BINDING & RESEARCH TAGS ---")
        print("1. Validating Global Pulse active state and KPI cards data binding...")
        global_tab = driver.find_element(By.ID, "tab-analytics-global")
        assert "active" in global_tab.get_attribute("class")

        wait.until(EC.presence_of_element_located((By.ID, "card-metric-researchers")))
        card_res_text = driver.find_element(By.ID, "card-metric-researchers").text.lower()
        card_pub_text = driver.find_element(By.ID, "card-metric-publications").text.lower()
        card_ws_text = driver.find_element(By.ID, "card-metric-workspaces").text.lower()
        card_collab_text = driver.find_element(By.ID, "card-metric-collaborations").text.lower()

        assert "active researchers" in card_res_text
        assert "total publications" in card_pub_text
        assert "active workspaces" in card_ws_text
        assert "inter-researcher links" in card_collab_text

        # Verify dynamic tags cloud
        tags_cloud = driver.find_element(By.CLASS_NAME, "tags-cloud")
        tag_texts = [t.text.lower() for t in tags_cloud.find_elements(By.CLASS_NAME, "topic-tag-chip")]
        assert any("quantum computing" in t for t in tag_texts), f"Expected 'Quantum Computing' in tags: {tag_texts}"
        print(f"[PASS] Global KPI cards and research area chips successfully bound with API payload.")

        # ---------------------------------------------------------------------
        # PHASE 3: INSTITUTIONAL & CROSS-INSTITUTIONAL INTEGRATION & CROSS-TAB LINK
        # ---------------------------------------------------------------------
        print("\n--- PHASE 3: INSTITUTIONAL & CROSS-INSTITUTIONAL INTEGRATION & 'VIEW DEPARTMENT' LINK ---")
        print("1. Switching to Institutional Metrics tab (#tab-analytics-institution)...")
        inst_tab_btn = wait.until(EC.element_to_be_clickable((By.ID, "tab-analytics-institution")))
        driver.execute_script("arguments[0].click();", inst_tab_btn)
        wait.until(EC.presence_of_element_located((By.ID, "panel-analytics-institution")))
        time.sleep(1.0)

        # Select Institution A
        inst_select = Select(wait.until(EC.presence_of_element_located((By.ID, "select-analytics-institution"))))
        inst_select.select_by_value(str(uni_a_id))
        time.sleep(1.2)

        inst_panel = driver.find_element(By.ID, "panel-analytics-institution")
        inst_text = inst_panel.text.lower()
        assert uni_a_name.lower() in inst_text
        assert "cambridge" in inst_text

        # Verify Cross-Institutional Partnership with Oxford Center (Uni B)
        assert uni_b_name.lower() in inst_text, f"Expected partner university '{uni_b_name}' in external partnerships section"
        assert "collaborative ties" in inst_text
        print(f"[PASS] Institutional view correctly populated with cross-institutional link to '{uni_b_name}'.")

        # Verify Department Breakdown Table & click 'View Department'
        print(f"2. Testing Cross-Tab Navigation: Clicking 'View Department' for '{dept_a1_name}'...")
        table_elem = wait.until(EC.presence_of_element_located((By.ID, "table-analytics-breakdown")))
        assert dept_a1_name.lower() in table_elem.text.lower()

        # Find row containing dept_a1 and click View Department button
        dept_rows = table_elem.find_elements(By.XPATH, ".//tbody/tr")
        target_row = None
        for row in dept_rows:
            if dept_a1_name.lower() in row.text.lower():
                target_row = row
                break
        assert target_row is not None, f"Could not find row for department '{dept_a1_name}'"

        view_dept_btn = target_row.find_element(By.XPATH, ".//button[contains(text(), 'View Department')]")
        driver.execute_script("arguments[0].click();", view_dept_btn)
        time.sleep(1.2)

        # Validate that tab automatically changed to Department tab (#panel-analytics-department)
        dept_tab = driver.find_element(By.ID, "tab-analytics-department")
        assert "active" in dept_tab.get_attribute("class")
        wait.until(EC.presence_of_element_located((By.ID, "panel-analytics-department")))
        dept_panel = driver.find_element(By.ID, "panel-analytics-department")
        dept_text = dept_panel.text.lower()

        assert dept_a1_name.lower() in dept_text
        assert uni_a_name.lower() in dept_text
        assert "department faculty" in dept_text
        print("[PASS] Cross-tab transition verified: 'View Department' navigated to Department tab with correct context.")

        # ---------------------------------------------------------------------
        # PHASE 4: TEAM & WORKSPACE VELOCITY INTEGRATION
        # ---------------------------------------------------------------------
        print("\n--- PHASE 4: TEAM & WORKSPACE VELOCITY SPRINT INTEGRATION ---")
        print("1. Switching to Team & Workspace Velocity tab (#tab-analytics-team)...")
        team_tab_btn = wait.until(EC.element_to_be_clickable((By.ID, "tab-analytics-team")))
        driver.execute_script("arguments[0].click();", team_tab_btn)
        wait.until(EC.presence_of_element_located((By.ID, "panel-analytics-team")))
        time.sleep(1.0)

        # Select seeded workspace
        ws_select = Select(wait.until(EC.presence_of_element_located((By.ID, "select-analytics-workspace"))))
        ws_select.select_by_value(str(ws_id))
        time.sleep(1.2)

        team_panel = driver.find_element(By.ID, "panel-analytics-team")
        team_text = team_panel.text.lower()

        # 3 tasks: 1 Done, 1 In-Prog, 1 Todo -> 33.3% completion rate
        assert "33%" in team_text or "33.3%" in team_text
        assert "1 done" in team_text
        assert "1 in-prog" in team_text
        assert "milestones met" in team_text

        # Verify Member Contribution table
        assert faculty_user["fullName"].lower() in team_text
        print("[PASS] Workspace velocity dashboard verified: Task completion velocity, segmented breakdown, and milestones.")

        # ---------------------------------------------------------------------
        # PHASE 5: RESEARCHER METRICS & TIMELINE DEEP LOOKUP
        # ---------------------------------------------------------------------
        print("\n--- PHASE 5: RESEARCHER METRICS & TIMELINE DEEP LOOKUP ---")
        print("1. Switching to Researcher Metrics tab (#tab-analytics-researcher)...")
        researcher_tab_btn = wait.until(EC.element_to_be_clickable((By.ID, "tab-analytics-researcher")))
        driver.execute_script("arguments[0].click();", researcher_tab_btn)
        wait.until(EC.presence_of_element_located((By.ID, "panel-analytics-researcher")))
        time.sleep(1.0)

        # Current user auto-loaded
        researcher_panel = driver.find_element(By.ID, "panel-analytics-researcher")
        researcher_text = researcher_panel.text.lower()
        assert faculty_user["fullName"].lower() in researcher_text
        assert "publications" in researcher_text
        assert "collaborators" in researcher_text

        # Lookup Collaborator User by ID
        print(f"2. Performing deep lookup for Partner PI (#{collaborator_user['id']})...")
        input_elem = wait.until(EC.presence_of_element_located((By.ID, "input-analytics-researcher-id")))
        input_elem.clear()
        input_elem.send_keys(str(collaborator_user["id"]))
        analyze_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Analyze Researcher')]")
        driver.execute_script("arguments[0].click();", analyze_btn)
        time.sleep(1.2)

        updated_researcher_panel = driver.find_element(By.ID, "panel-analytics-researcher")
        updated_text = updated_researcher_panel.text.lower()
        assert collaborator_user["fullName"].lower() in updated_text
        assert uni_b_name.lower() in updated_text
        print("[PASS] Researcher metrics deep lookup verified: Partner PI profile dynamically queried and displayed.")

        # ---------------------------------------------------------------------
        # PHASE 6: ERROR & EMPTY STATE HANDLING INTEGRATION
        # ---------------------------------------------------------------------
        print("\n--- PHASE 6: ERROR & EMPTY STATE HANDLING INTEGRATION ---")
        print("1. Querying non-existent researcher ID (999999)...")
        input_elem.clear()
        input_elem.send_keys("999999")
        driver.execute_script("arguments[0].click();", analyze_btn)
        time.sleep(1.0)

        not_found_researcher_panel = driver.find_element(By.ID, "panel-analytics-researcher")
        assert "no researcher profile found" in not_found_researcher_panel.text.lower()
        print("[PASS] Graceful fallback verified: Non-existent researcher ID displayed safe empty notification.")

        # Query non-existent Department ID
        print("2. Querying non-existent department ID (999999) in Department Tab...")
        driver.execute_script("arguments[0].click();", dept_tab)
        wait.until(EC.presence_of_element_located((By.ID, "panel-analytics-department")))
        time.sleep(0.5)

        dept_id_input = wait.until(EC.presence_of_element_located((By.ID, "select-analytics-department")))
        dept_id_input.clear()
        dept_id_input.send_keys("999999")
        analyze_dept_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Analyze Department')]")
        driver.execute_script("arguments[0].click();", analyze_dept_btn)
        time.sleep(1.0)

        not_found_dept_panel = driver.find_element(By.ID, "panel-analytics-department")
        assert "no department analytics found for id #999999" in not_found_dept_panel.text.lower()
        print("[PASS] Graceful fallback verified: Non-existent department ID displayed safe empty notification.")

        # ---------------------------------------------------------------------
        # PHASE 7: ON-DEMAND METRICS RECALCULATION & SNAPSHOT CACHE INTEGRATION
        # ---------------------------------------------------------------------
        print("\n--- PHASE 7: ON-DEMAND METRICS RECALCULATION & SNAPSHOT UPDATE ---")
        print("1. Triggering 'Recalculate Metrics' from header button...")
        recalc_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-analytics-recalculate")))
        driver.execute_script("arguments[0].click();", recalc_btn)

        # Verify toast notification appearance
        toast_elem = wait.until(EC.presence_of_element_located((By.ID, "analytics-toast")))
        assert "recalculated successfully" in toast_elem.text.lower()
        safe_toast = toast_elem.text.encode("ascii", "replace").decode("ascii").strip()
        print(f"[PASS] Recalculation toast triggered: '{safe_toast}'")

        # Switch back to Global tab and verify Recent Snapshots table contains new entries
        print("2. Verifying Recent Snapshot Rollups table updated in Global Pulse tab...")
        driver.execute_script("arguments[0].click();", global_tab)
        wait.until(EC.presence_of_element_located((By.ID, "panel-analytics-global")))
        time.sleep(1.0)

        global_panel = driver.find_element(By.ID, "panel-analytics-global")
        assert "recent analytics snapshot rollups" in global_panel.text.lower()
        assert "institution" in global_panel.text.lower()
        print("[PASS] Snapshot rollups table verified displaying active cached calculation records.")

        print("\n==========================================================================================")
        print("=== ALL T-018.6 ANALYTICS API/UI INTEGRATION TESTS PASSED SUCCESSFULLY!                ===")
        print("==========================================================================================")

    finally:
        driver.quit()

if __name__ == "__main__":
    test_analytics_api_ui_integration()
