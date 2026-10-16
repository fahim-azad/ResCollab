import os
import time
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select

BASE_API_URL = "http://localhost:5000/api"
FRONTEND_URL = "http://localhost:5173"

def create_test_user(prefix="unitest"):
    timestamp = int(time.time() * 1000)
    user = {
        "email": f"{prefix}_{timestamp}@rescollab.test",
        "password": "Password123!",
        "fullName": f"Prof. University Tester {timestamp}",
        "role": "Faculty"
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
        "token": login_data.get("token", ""),
        "id": login_data.get("user", {}).get("id")
    }

def test_university_profile_crud_and_visibility():
    print("==========================================================================")
    print("=== STARTING T-016.5: UNIVERSITY PROFILE CRUD & VISIBILITY RULES TEST ===")
    print("==========================================================================")

    test_user = create_test_user()
    auth_headers = {
        "Authorization": f"Bearer {test_user['token']}",
        "Content-Type": "application/json"
    }
    timestamp = int(time.time())

    # =========================================================================
    # PHASE 1: BACKEND API CRUD, VALIDATION & VISIBILITY SECURITY ENFORCEMENT
    # =========================================================================
    print("\n--- PHASE 1: API-LEVEL CRUD, VALIDATION & VISIBILITY RULES ---")

    # 1. Unauthenticated Security Boundary Validation
    print("1. Validating unauthenticated security enforcement...")
    unauth_res = requests.get(f"{BASE_API_URL}/university")
    assert unauth_res.status_code == 401, f"Expected 401 for unauth GET /university, got {unauth_res.status_code}"
    unauth_post = requests.post(f"{BASE_API_URL}/university", json={"name": "Illegal Uni"})
    assert unauth_post.status_code == 401, f"Expected 401 for unauth POST /university, got {unauth_post.status_code}"
    print("[PASS] Security boundary verified: Unauthenticated university requests strictly return 401 Unauthorized.")

    # 2. Validation Rule: University Name is required
    print("2. Validating university creation validation rules...")
    bad_uni_res = requests.post(f"{BASE_API_URL}/university", headers=auth_headers, json={"name": "   ", "country": "Switzerland"})
    assert bad_uni_res.status_code == 400, f"Expected 400 on blank university name, got {bad_uni_res.status_code}"
    print("[PASS] Validation verified: Blank university name rejected with 400 Bad Request.")

    # 3. Create University Profile via API
    uni_payload = {
        "name": f"Zurich Institute of Advanced Sciences {timestamp}",
        "country": "Switzerland",
        "city": "Zurich",
        "website": "https://zias.ch",
        "description": "Premier Swiss research center specializing in quantum computation and neural networks.",
        "logoUrl": "https://images.unsplash.com/photo-1592280771190-3e2e4d571952"
    }
    print(f"3. Registering test university: '{uni_payload['name']}'...")
    create_uni_res = requests.post(f"{BASE_API_URL}/university", headers=auth_headers, json=uni_payload)
    assert create_uni_res.status_code == 201, f"Failed to create university: {create_uni_res.text}"
    uni_data = create_uni_res.json()
    uni_id = uni_data["id"]
    print(f"[PASS] University created successfully with ID #{uni_id} (201 Created).")

    # 4. Read University Profile
    print(f"4. Retrieving university #{uni_id} profile details...")
    get_uni_res = requests.get(f"{BASE_API_URL}/university/{uni_id}", headers=auth_headers)
    assert get_uni_res.status_code == 200, f"Failed to get university: {get_uni_res.text}"
    retrieved_uni = get_uni_res.json()
    assert retrieved_uni["name"] == uni_payload["name"], "University name mismatch"
    assert retrieved_uni["country"] == "Switzerland", "University country mismatch"
    assert retrieved_uni["status"] == "Active", "University status should be Active"
    print("[PASS] University profile retrieval verified (200 OK).")

    # 5. Update University Profile via API
    print(f"5. Updating university #{uni_id} profile...")
    update_payload = {
        "name": f"Zurich Federal Institute of Technology {timestamp}",
        "country": "Switzerland",
        "city": "Zurich",
        "website": "https://zfit.eth.ch",
        "description": "Updated international research center for computational neurosciences.",
        "logoUrl": uni_payload["logoUrl"]
    }
    update_uni_res = requests.put(f"{BASE_API_URL}/university/{uni_id}", headers=auth_headers, json=update_payload)
    assert update_uni_res.status_code == 200, f"Failed to update university: {update_uni_res.text}"
    updated_uni = update_uni_res.json()
    assert updated_uni["name"] == update_payload["name"], "Updated name did not persist"
    assert updated_uni["website"] == update_payload["website"], "Updated website did not persist"
    print("[PASS] University profile update verified (200 OK).")

    # 6. Create Departments with Public and Private Visibility Rules
    print(f"6. Creating departments under university #{uni_id} with distinct visibility rules...")
    # Public Department
    pub_dept_payload = {
        "name": f"Department of Artificial Intelligence {timestamp}",
        "description": "Public research laboratories in foundation models and robotics.",
        "headOfDepartment": "Prof. Geoffrey Hinton",
        "website": "https://zfit.eth.ch/ai",
        "visibility": "Public"
    }
    create_pub_res = requests.post(f"{BASE_API_URL}/university/{uni_id}/departments", headers=auth_headers, json=pub_dept_payload)
    assert create_pub_res.status_code == 201, f"Failed to create public dept: {create_pub_res.text}"
    pub_dept = create_pub_res.json()
    pub_dept_id = pub_dept["id"]
    assert pub_dept["visibility"] == "Public", "Expected Public visibility"
    print(f"[PASS] Public department #{pub_dept_id} created ('{pub_dept['name']}').")

    # Private Department
    priv_dept_payload = {
        "name": f"Department of Classified Defence Cybernetics {timestamp}",
        "description": "Restricted military cybernetics and cryptographic infrastructure.",
        "headOfDepartment": "Col. John von Neumann",
        "website": "https://zfit.eth.ch/defense-internal",
        "visibility": "Private"
    }
    create_priv_res = requests.post(f"{BASE_API_URL}/university/{uni_id}/departments", headers=auth_headers, json=priv_dept_payload)
    assert create_priv_res.status_code == 201, f"Failed to create private dept: {create_priv_res.text}"
    priv_dept = create_priv_res.json()
    priv_dept_id = priv_dept["id"]
    assert priv_dept["visibility"] == "Private", "Expected Private visibility"
    print(f"[PASS] Private department #{priv_dept_id} created ('{priv_dept['name']}').")

    # Duplicate Department Name Validation
    duplicate_res = requests.post(f"{BASE_API_URL}/university/{uni_id}/departments", headers=auth_headers, json=pub_dept_payload)
    assert duplicate_res.status_code == 400, f"Expected 400 on duplicate dept name, got {duplicate_res.status_code}"
    print("[PASS] Duplicate department constraint verified: Duplicate department name rejected with 400 Bad Request.")

    # 7. Visibility Filtering Rules Testing
    print("7. Testing Department Visibility filtering rules...")
    # Query with visibility=Public
    get_pub_depts_res = requests.get(f"{BASE_API_URL}/university/{uni_id}/departments?visibility=Public", headers=auth_headers)
    assert get_pub_depts_res.status_code == 200
    pub_depts = get_pub_depts_res.json()
    pub_ids = [d["id"] for d in pub_depts]
    assert pub_dept_id in pub_ids, f"Public department #{pub_dept_id} should appear in Public visibility filter"
    assert priv_dept_id not in pub_ids, f"Private department #{priv_dept_id} MUST NOT appear in Public visibility filter!"
    print("[PASS] Public visibility filter strictly includes Public departments and excludes Private departments.")

    # Query with visibility=Private
    get_priv_depts_res = requests.get(f"{BASE_API_URL}/university/{uni_id}/departments?visibility=Private", headers=auth_headers)
    assert get_priv_depts_res.status_code == 200
    priv_depts = get_priv_depts_res.json()
    priv_ids = [d["id"] for d in priv_depts]
    assert priv_dept_id in priv_ids, f"Private department #{priv_dept_id} should appear in Private visibility filter"
    assert pub_dept_id not in priv_ids, f"Public department #{pub_dept_id} MUST NOT appear in Private visibility filter!"
    print("[PASS] Private visibility filter strictly includes Private departments and excludes Public departments.")

    # University details with visibility=Public
    get_uni_pub_res = requests.get(f"{BASE_API_URL}/university/{uni_id}?visibility=Public", headers=auth_headers)
    assert get_uni_pub_res.status_code == 200
    uni_pub_depts = get_uni_pub_res.json().get("departments", [])
    uni_pub_dept_ids = [d["id"] for d in uni_pub_depts]
    assert pub_dept_id in uni_pub_dept_ids and priv_dept_id not in uni_pub_dept_ids, \
        "University details with ?visibility=Public leaked private department!"
    print("[PASS] University profile endpoint correctly respects ?visibility=Public filter.")

    # 8. Department Visibility PATCH toggle
    print(f"8. Toggling department #{priv_dept_id} visibility from Private -> Public via PATCH...")
    patch_vis_res = requests.patch(
        f"{BASE_API_URL}/university/{uni_id}/departments/{priv_dept_id}/visibility",
        headers=auth_headers,
        json={"visibility": "Public"}
    )
    assert patch_vis_res.status_code == 200, f"Failed to patch visibility: {patch_vis_res.text}"
    assert patch_vis_res.json()["visibility"] == "Public"

    # Verify it now appears under Public filter
    verify_patch_res = requests.get(f"{BASE_API_URL}/university/{uni_id}/departments?visibility=Public", headers=auth_headers)
    now_pub_ids = [d["id"] for d in verify_patch_res.json()]
    assert priv_dept_id in now_pub_ids, "Department did not appear in Public filter after visibility PATCH"
    print("[PASS] Department visibility dynamically toggled to Public and reflected in queries.")

    # Toggle back to Private
    requests.patch(
        f"{BASE_API_URL}/university/{uni_id}/departments/{priv_dept_id}/visibility",
        headers=auth_headers,
        json={"visibility": "Private"}
    )

    # 9. Department Deletion (API)
    print(f"9. Testing Department deletion via API...")
    temp_dept_res = requests.post(
        f"{BASE_API_URL}/university/{uni_id}/departments",
        headers=auth_headers,
        json={"name": f"Temp Dept {timestamp}", "visibility": "Public"}
    )
    temp_dept_id = temp_dept_res.json()["id"]
    del_dept_res = requests.delete(f"{BASE_API_URL}/university/{uni_id}/departments/{temp_dept_id}", headers=auth_headers)
    assert del_dept_res.status_code == 200, f"Failed to delete department: {del_dept_res.text}"
    get_deleted_dept = requests.get(f"{BASE_API_URL}/university/{uni_id}/departments/{temp_dept_id}", headers=auth_headers)
    assert get_deleted_dept.status_code == 404, "Deleted department should return 404 Not Found"
    print("[PASS] Department deletion verified (200 OK -> 404 Not Found).")

    # 10. Soft Deletion of University via API
    print(f"10. Testing University soft deletion via API...")
    temp_uni_res = requests.post(f"{BASE_API_URL}/university", headers=auth_headers, json={"name": f"Temporary College {timestamp}"})
    temp_uni_id = temp_uni_res.json()["id"]
    del_uni_res = requests.delete(f"{BASE_API_URL}/university/{temp_uni_id}", headers=auth_headers)
    assert del_uni_res.status_code == 200, f"Failed to delete university: {del_uni_res.text}"
    all_unis = requests.get(f"{BASE_API_URL}/university", headers=auth_headers).json()
    assert not any(u["id"] == temp_uni_id for u in all_unis), "Deactivated university should not appear in active universities list"
    print("[PASS] Soft deletion verified: Inactive university excluded from directory listings.")


    # =========================================================================
    # PHASE 2: SELENIUM BROWSER E2E WORKFLOW & VISIBILITY UI VALIDATION
    # =========================================================================
    print("\n--- PHASE 2: BROWSER UI INTEGRATION, DIRECTORY CRUD & VISIBILITY UI ---")

    options = webdriver.ChromeOptions()
    if os.environ.get("HEADLESS", "false").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,960")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 12)

    ui_uni_name = f"Tokyo Tech Institute {timestamp}"
    ui_country = "Japan"
    ui_city = "Tokyo"
    ui_website = "https://titech.ac.jp"
    ui_desc = "Leading technological university pioneering quantum robotics and bio-nanotechnology."

    ui_pub_dept = f"Advanced Robotics Lab {timestamp}"
    ui_priv_dept = f"Classified Cyber Defense {timestamp}"

    try:
        # Step 1: Login via UI
        print(f"1. Logging in as user '{test_user['email']}'...")
        driver.get(f"{FRONTEND_URL}/login")
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(test_user["email"])
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(test_user["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        print("[PASS] User logged in and redirected to profile.")

        # Step 2: Navigate to University Management
        print("2. Navigating to University Management page (/universities)...")
        driver.get(f"{FRONTEND_URL}/universities")
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "uni-header")))
        time.sleep(0.5)

        # Verify page header and statistics
        header_text = driver.find_element(By.CLASS_NAME, "uni-header").text
        assert "University & Department Profile Management" in header_text
        print("[PASS] University Management page loaded with stats and tabs.")

        # Step 3: Register University via UI Form
        print(f"3. Registering new university '{ui_uni_name}' via UI form...")
        register_tab_btn = wait.until(EC.element_to_be_clickable((By.ID, "tab-btn-create")))
        driver.execute_script("arguments[0].click();", register_tab_btn)
        time.sleep(0.5)

        # Fill in University Form
        name_input = wait.until(EC.presence_of_element_located((By.ID, "input-create-uni-name")))
        name_input.clear()
        name_input.send_keys(ui_uni_name)

        country_input = driver.find_element(By.ID, "input-create-uni-country")
        country_input.clear()
        country_input.send_keys(ui_country)

        city_input = driver.find_element(By.ID, "input-create-uni-city")
        city_input.clear()
        city_input.send_keys(ui_city)

        website_input = driver.find_element(By.ID, "input-create-uni-website")
        website_input.clear()
        website_input.send_keys(ui_website)

        desc_input = driver.find_element(By.ID, "input-create-uni-description")
        desc_input.clear()
        desc_input.send_keys(ui_desc)

        # Submit University Form
        submit_btn = driver.find_element(By.ID, "btn-submit-university")
        driver.execute_script("arguments[0].click();", submit_btn)

        # Wait for redirect to Directory tab
        wait.until(lambda d: "active" in d.find_element(By.ID, "tab-btn-directory").get_attribute("class"))
        print("[PASS] University registered via UI form, returned to Directory tab.")
        time.sleep(0.5)

        # Step 4: Verify University Card in Directory Tab
        print(f"4. Verifying university card in directory search...")
        search_input = wait.until(EC.presence_of_element_located((By.ID, "input-university-search")))
        search_input.clear()
        search_input.send_keys(ui_uni_name)
        time.sleep(1)

        # Wait for card containing ui_uni_name
        wait.until(lambda d: any(ui_uni_name in c.text for c in d.find_elements(By.CLASS_NAME, "uni-card")))
        cards = driver.find_elements(By.CLASS_NAME, "uni-card")
        target_card = next(c for c in cards if ui_uni_name in c.text)

        assert ui_country in target_card.text, f"Country '{ui_country}' missing from university card"
        assert "Active" in target_card.text, "Active badge missing from university card"
        print(f"[PASS] University card confirmed in Directory with Active status and correct location.")

        # Step 5: Update University Profile via UI Modal
        print("5. Testing University Profile Edit modal...")
        edit_btn = target_card.find_element(By.XPATH, ".//button[contains(@id, 'btn-edit-university-')]")
        driver.execute_script("arguments[0].click();", edit_btn)

        # Wait for edit modal inputs
        edit_city_input = wait.until(EC.presence_of_element_located((By.ID, "input-edit-uni-city")))
        edit_city_input.clear()
        edit_city_input.send_keys("Kyoto")

        edit_desc_input = driver.find_element(By.ID, "input-edit-uni-desc")
        edit_desc_input.clear()
        edit_desc_input.send_keys("Updated Japanese technology and neuroscience research institute.")

        # Submit edits
        save_edit_btn = driver.find_element(By.ID, "btn-save-edit-university")
        driver.execute_script("arguments[0].click();", save_edit_btn)

        # Wait for edit modal to close
        wait.until(EC.invisibility_of_element_located((By.ID, "btn-save-edit-university")))
        time.sleep(0.5)

        # Verify updated city in card
        search_input.clear()
        search_input.send_keys(ui_uni_name)
        time.sleep(0.5)

        wait.until(lambda d: any(ui_uni_name in c.text and "Kyoto" in c.text for c in d.find_elements(By.CLASS_NAME, "uni-card")))
        print("[PASS] University profile successfully updated to 'Kyoto' and persisted on directory card.")

        # Step 6: Department Management & Visibility via University Details Modal
        print("6. Opening University Details modal to configure departments & visibility...")
        target_card_updated = next(c for c in driver.find_elements(By.CLASS_NAME, "uni-card") if ui_uni_name in c.text)
        view_depts_btn = target_card_updated.find_element(By.XPATH, ".//button[contains(@id, 'btn-view-university-')]")
        driver.execute_script("arguments[0].click();", view_depts_btn)

        # Wait for modal
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "uni-modal-body")))
        time.sleep(0.5)

        # Add Department 1: Public Visibility
        print(f"6a. Adding Public department '{ui_pub_dept}'...")
        add_dept_modal_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-add-department")))
        driver.execute_script("arguments[0].click();", add_dept_modal_btn)

        dept_name_input = wait.until(EC.presence_of_element_located((By.ID, "input-dept-name")))
        dept_name_input.clear()
        dept_name_input.send_keys(ui_pub_dept)

        dept_head_input = driver.find_element(By.ID, "input-dept-head")
        dept_head_input.clear()
        dept_head_input.send_keys("Prof. Kenjiro Takayanagi")

        # Select Public visibility option card
        opt_public = driver.find_element(By.ID, "opt-dept-vis-public")
        driver.execute_script("arguments[0].click();", opt_public)

        dept_desc_input = driver.find_element(By.ID, "input-dept-desc")
        dept_desc_input.clear()
        dept_desc_input.send_keys("Open laboratory for public humanoid and quadruped robotics research.")

        # Submit department
        driver.find_element(By.ID, "btn-submit-dept").click()
        wait.until(EC.invisibility_of_element_located((By.ID, "btn-submit-dept")))
        wait.until(lambda d: ui_pub_dept in d.find_element(By.CLASS_NAME, "uni-modal-body").text)
        print("[PASS] Public department added via UI.")

        # Add Department 2: Private Visibility
        print(f"6b. Adding Private department '{ui_priv_dept}'...")
        add_dept_modal_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-add-department")))
        driver.execute_script("arguments[0].click();", add_dept_modal_btn)

        dept_name_input2 = wait.until(EC.presence_of_element_located((By.ID, "input-dept-name")))
        dept_name_input2.clear()
        dept_name_input2.send_keys(ui_priv_dept)

        dept_head_input2 = driver.find_element(By.ID, "input-dept-head")
        dept_head_input2.clear()
        dept_head_input2.send_keys("Dr. Satoshi Nakamoto")

        # Select Private visibility option card
        opt_private = driver.find_element(By.ID, "opt-dept-vis-private")
        driver.execute_script("arguments[0].click();", opt_private)

        dept_desc_input2 = driver.find_element(By.ID, "input-dept-desc")
        dept_desc_input2.clear()
        dept_desc_input2.send_keys("Confidential internal defense protocols and hardware cipher modules.")

        # Submit department
        driver.find_element(By.ID, "btn-submit-dept").click()
        wait.until(EC.invisibility_of_element_located((By.ID, "btn-submit-dept")))
        wait.until(lambda d: ui_priv_dept in d.find_element(By.CLASS_NAME, "uni-modal-body").text)
        print("[PASS] Private department added via UI.")

        # Step 7: Validate Visibility Badges & Filtering in Modal
        print("7. Testing Department Visibility Badges & In-Modal Filtering...")
        modal_body = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "uni-modal-body")))
        dept_cards = modal_body.find_elements(By.CLASS_NAME, "dept-card")
        assert len(dept_cards) >= 2, f"Expected at least 2 departments in modal, found {len(dept_cards)}"

        # Check badges
        modal_html = modal_body.get_attribute("innerHTML")
        assert "Public" in modal_html, "Public badge missing from department list"
        assert "Private" in modal_html, "Private badge missing from department list"

        # Test Public visibility filter chip in modal
        print("7a. Testing 'Public' visibility filter chip in details modal...")
        pub_chip = driver.find_element(By.XPATH, "//div[contains(@class, 'dept-section-header')]//button[contains(@class, 'vis-chip') and contains(text(), 'Public')]")
        driver.execute_script("arguments[0].click();", pub_chip)
        time.sleep(0.5)

        visible_dept_text = driver.find_element(By.CLASS_NAME, "dept-list").text
        assert ui_pub_dept in visible_dept_text, "Public department should be visible under Public filter"
        assert ui_priv_dept not in visible_dept_text, "Private department MUST be hidden under Public filter!"
        print("[PASS] In-modal Public visibility filter correctly hides Private department.")

        # Test Private visibility filter chip in modal
        print("7b. Testing 'Private' visibility filter chip in details modal...")
        priv_chip = driver.find_element(By.XPATH, "//div[contains(@class, 'dept-section-header')]//button[contains(@class, 'vis-chip') and contains(text(), 'Private')]")
        driver.execute_script("arguments[0].click();", priv_chip)
        time.sleep(0.5)

        visible_dept_text_priv = driver.find_element(By.CLASS_NAME, "dept-list").text
        assert ui_priv_dept in visible_dept_text_priv, "Private department should be visible under Private filter"
        assert ui_pub_dept not in visible_dept_text_priv, "Public department MUST be hidden under Private filter!"
        print("[PASS] In-modal Private visibility filter correctly hides Public department.")

        # Test All chip in modal
        all_chip = driver.find_element(By.XPATH, "//div[contains(@class, 'dept-section-header')]//button[contains(@class, 'vis-chip') and text()='All']")
        driver.execute_script("arguments[0].click();", all_chip)
        time.sleep(0.5)

        # Step 8: Test In-place Department Visibility Toggle
        print("8. Testing In-place Visibility Toggle button...")
        toggle_vis_btn = driver.find_element(By.XPATH, f"//div[contains(@class, 'dept-card')]//button[contains(@class, 'dept-visibility-toggle-btn') and contains(text(), 'Set Public')]")
        driver.execute_script("arguments[0].click();", toggle_vis_btn)

        # Verify button now says "Set Private"
        wait.until(lambda d: len(d.find_elements(By.XPATH, "//div[contains(@class, 'dept-card')]//button[contains(@class, 'dept-visibility-toggle-btn') and contains(text(), 'Set Private')]")) >= 2)
        print("[PASS] Quick visibility toggle successfully converted Private department to Public.")

        # Toggle back to Private
        toggle_vis_btn_back = driver.find_elements(By.XPATH, "//div[contains(@class, 'dept-card')]//button[contains(@class, 'dept-visibility-toggle-btn') and contains(text(), 'Set Private')]")[-1]
        driver.execute_script("arguments[0].click();", toggle_vis_btn_back)

        wait.until(lambda d: len(d.find_elements(By.XPATH, "//div[contains(@class, 'dept-card')]//button[contains(@class, 'dept-visibility-toggle-btn') and contains(text(), 'Set Public')]")) >= 1)
        print("[PASS] Quick visibility toggle successfully reverted department to Private.")

        # Close Details Modal
        close_btn = driver.find_element(By.ID, "btn-close-detail")
        driver.execute_script("arguments[0].click();", close_btn)
        time.sleep(0.5)

        # Step 9: Departments & Visibility Explorer Tab UI Validation
        print("9. Testing Departments & Visibility Explorer tab...")
        depts_tab_btn = driver.find_element(By.ID, "tab-btn-departments")
        driver.execute_script("arguments[0].click();", depts_tab_btn)
        time.sleep(0.5)

        # Verify banner explaining visibility rules
        banner_text = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "dept-info-banner"))).text
        assert "Department Visibility System" in banner_text, "Visibility explanation banner missing"
        assert "Public" in banner_text and "Private" in banner_text
        print("[PASS] Visibility explanation banner verified.")

        # Search for Public department in Explorer
        dept_search = wait.until(EC.presence_of_element_located((By.ID, "input-dept-search")))
        dept_search.clear()
        dept_search.send_keys(ui_pub_dept)
        time.sleep(0.5)

        explorer_text = driver.find_element(By.CLASS_NAME, "dept-explorer-grid").text
        assert ui_pub_dept in explorer_text, "Public department not found in Department Explorer search"
        print("[PASS] Department Explorer correctly lists registered public department.")

        # Test Inspect Info Modal on Department Explorer Card
        print("9a. Testing Department Information & Visibility Modal (Inspect Info)...")
        inspect_btn = driver.find_element(By.XPATH, "//div[contains(@class, 'dept-explorer-card')]//button[contains(@id, 'btn-info-dept-')]")
        driver.execute_script("arguments[0].click();", inspect_btn)

        info_modal = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "dept-detail-header-card")))
        assert "Public Visibility Active" in info_modal.text, "Expected 'Public Visibility Active' explanation in info modal"
        close_info_btn = driver.find_element(By.ID, "btn-close-dept-info")
        driver.execute_script("arguments[0].click();", close_info_btn)
        time.sleep(0.5)
        print("[PASS] Department Information & Visibility modal verified.")

        # Test Global Visibility Chips in Explorer (Private chip)
        print("9b. Testing Global Visibility Chips in Department Explorer...")
        dept_search.clear()
        dept_search.send_keys(ui_priv_dept)
        time.sleep(0.5)

        vis_chip_priv = driver.find_element(By.ID, "vis-chip-private")
        driver.execute_script("arguments[0].click();", vis_chip_priv)
        time.sleep(0.5)

        priv_explorer_text = driver.find_element(By.CLASS_NAME, "dept-explorer-grid").text
        assert ui_priv_dept in priv_explorer_text, "Private department should be listed under Private chip"
        assert "Private" in priv_explorer_text
        print("[PASS] Department Explorer Private filter correctly isolates Private departments.")

        # Clear filters by clicking All chip
        driver.find_element(By.ID, "vis-chip-all").click()
        dept_search.clear()
        time.sleep(0.5)

        # Step 10: Institutional Affiliation Configuration
        print("10. Testing User Institutional Affiliation linking...")
        aff_tab_btn = driver.find_element(By.ID, "tab-btn-affiliation")
        driver.execute_script("arguments[0].click();", aff_tab_btn)
        time.sleep(0.5)

        uni_select = wait.until(EC.presence_of_element_located((By.ID, "select-my-university")))
        select_uni_obj = Select(uni_select)
        # Select our created university
        select_uni_obj.select_by_value(ui_uni_name)
        time.sleep(0.5)

        # Select department
        dept_select = wait.until(EC.presence_of_element_located((By.ID, "select-my-department")))
        if dept_select.tag_name.lower() == "select":
            select_dept_obj = Select(dept_select)
            select_dept_obj.select_by_value(ui_pub_dept)
        else:
            dept_select.clear()
            dept_select.send_keys(ui_pub_dept)

        # Save affiliation
        save_aff_btn = driver.find_element(By.ID, "btn-save-affiliation")
        driver.execute_script("arguments[0].click();", save_aff_btn)

        wait.until(lambda d: ui_uni_name in d.find_element(By.CLASS_NAME, "affiliation-current-status").text)
        header_stats_text = driver.find_element(By.CLASS_NAME, "uni-header-stats").text
        assert ui_uni_name in header_stats_text, "User affiliation not updated in header stats"
        print("[PASS] Institutional affiliation successfully configured and reflected in researcher profile.")

        # Step 11: University Deletion via UI
        print(f"11. Testing University Profile Deactivation / Deletion via UI...")
        driver.find_element(By.ID, "tab-btn-directory").click()
        time.sleep(0.5)

        search_input_del = wait.until(EC.presence_of_element_located((By.ID, "input-university-search")))
        search_input_del.clear()
        search_input_del.send_keys(ui_uni_name)
        time.sleep(0.5)

        del_btn = driver.find_element(By.XPATH, "//div[contains(@class, 'uni-card')]//button[contains(@id, 'btn-delete-university-')]")
        driver.execute_script("arguments[0].click();", del_btn)

        # Confirm Deactivation Modal
        confirm_del_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-confirm-delete")))
        driver.execute_script("arguments[0].click();", confirm_del_btn)

        wait.until(EC.invisibility_of_element_located((By.ID, "btn-confirm-delete")))
        time.sleep(0.5)

        # Verify card removed from search
        search_input_del.clear()
        search_input_del.send_keys(ui_uni_name)
        time.sleep(0.5)
        remaining_cards = driver.find_elements(By.CLASS_NAME, "uni-card")
        assert not any(ui_uni_name in c.text for c in remaining_cards), "Deactivated university still visible in directory!"
        print("[PASS] University profile deactivation successfully verified in UI.")

        print("\n==========================================================================")
        print("=== ALL T-016.5 UNIVERSITY CRUD & VISIBILITY TESTS PASSED (EXIT CODE 0) ===")
        print("==========================================================================")

    finally:
        print("Closing browser driver...")
        driver.quit()

if __name__ == "__main__":
    test_university_profile_crud_and_visibility()
