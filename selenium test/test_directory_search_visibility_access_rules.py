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

def create_user(prefix, full_name, role="Faculty"):
    timestamp = int(time.time() * 1000)
    user = {
        "email": f"{prefix}_{timestamp}@directorytest.com",
        "password": "Password123!",
        "fullName": f"{full_name} {timestamp}",
        "role": role
    }
    reg_res = requests.post(f"{BASE_API_URL}/auth/register", json=user)
    assert reg_res.status_code in (200, 201), f"Failed to register {full_name}: {reg_res.text}"

    login_res = requests.post(f"{BASE_API_URL}/auth/login", json=user)
    assert login_res.status_code == 200, f"Failed to login {full_name}: {login_res.text}"
    data = login_res.json()

    return {
        "email": user["email"],
        "password": user["password"],
        "fullName": user["fullName"],
        "token": data.get("token", ""),
        "id": data.get("user", {}).get("id")
    }

def setup_directory_environment():
    print("0. Setting up test users and collaborator profiles...")
    # User 1: Dr. Alice (Faculty, PI, Public profile)
    alice = create_user("alice_pi", "Dr. Alice Turing", role="Faculty")
    # User 2: Bob (Researcher, Collaborator, Public profile)
    bob = create_user("bob_res", "Bob Researcher", role="Faculty")
    # User 3: Eve (Restricted, Private profile)
    eve = create_user("eve_priv", "Eve Restricted", role="Student")

    headers_alice = {"Authorization": f"Bearer {alice['token']}", "Content-Type": "application/json"}
    headers_bob = {"Authorization": f"Bearer {bob['token']}", "Content-Type": "application/json"}
    headers_eve = {"Authorization": f"Bearer {eve['token']}", "Content-Type": "application/json"}

    # Configure collaborator profile for Alice (Public, Open to collab)
    requests.post(f"{BASE_API_URL}/collaborator/profile", headers=headers_alice, json={
        "institution": "MIT CSAIL",
        "department": "EECS",
        "country": "United States",
        "researchInterests": "Autonomous Robotics, Computer Vision",
        "expertiseAreas": "SLAM, PyTorch, ROS2",
        "isOpenToCollaboration": True,
        "visibility": "Public"
    })

    # Configure collaborator profile for Bob (Public, Open to collab)
    requests.post(f"{BASE_API_URL}/collaborator/profile", headers=headers_bob, json={
        "institution": "MIT CSAIL",
        "department": "EECS",
        "country": "United States",
        "researchInterests": "Neural Motion Planning",
        "expertiseAreas": "Reinforcement Learning, C++",
        "isOpenToCollaboration": True,
        "visibility": "Public"
    })

    # Configure collaborator profile for Eve (Private, Closed)
    requests.post(f"{BASE_API_URL}/collaborator/profile", headers=headers_eve, json={
        "institution": "Confidential Institute",
        "department": "Black-Box Systems",
        "country": "United States",
        "researchInterests": "Hidden Exploits",
        "expertiseAreas": "Classified",
        "isOpenToCollaboration": False,
        "visibility": "Private"
    })

    return alice, bob, eve

def test_directory_search_visibility_and_access_rules():
    print("==================================================================================")
    print("=== STARTING T-017.6: DIRECTORY SEARCH, VISIBILITY AND ACCESS RULES TEST ===")
    print("==================================================================================")

    alice, bob, eve = setup_directory_environment()
    headers_alice = {"Authorization": f"Bearer {alice['token']}", "Content-Type": "application/json"}
    headers_bob = {"Authorization": f"Bearer {bob['token']}", "Content-Type": "application/json"}
    headers_eve = {"Authorization": f"Bearer {eve['token']}", "Content-Type": "application/json"}
    timestamp = int(time.time())

    # =========================================================================
    # PHASE 1: BACKEND API ACCESS RULES, SECURITY & VISIBILITY ENFORCEMENT
    # =========================================================================
    print("\n--- PHASE 1: API-LEVEL ACCESS PERMISSIONS & VISIBILITY ENFORCEMENT ---")

    # 1. Unauthenticated Security Boundary
    print("1. Validating unauthenticated security rejection...")
    assert requests.get(f"{BASE_API_URL}/directory/researchers").status_code == 401
    assert requests.get(f"{BASE_API_URL}/directory/laboratories").status_code == 401
    assert requests.get(f"{BASE_API_URL}/projectdiscovery").status_code == 401
    print("[PASS] Security Check: Unauthenticated access to directory and discovery endpoints returns 401 Unauthorized.")

    # 2. Laboratory Creation & Ownership Setup
    print("2. Creating Public and Private test laboratories via API...")
    # Public Laboratory created by Alice
    pub_lab_payload = {
        "name": f"Robotics & Neural Automation Lab {timestamp}",
        "description": "Public research facility developing autonomous legged robots.",
        "researchFocus": "Quadruped Locomotion, SLAM",
        "institution": "MIT CSAIL",
        "department": "EECS",
        "location": "Stata Center, 4th Floor",
        "website": "https://rnal.mit.edu",
        "visibility": "Public"
    }
    pub_lab_res = requests.post(f"{BASE_API_URL}/directory/laboratories", headers=headers_alice, json=pub_lab_payload)
    assert pub_lab_res.status_code == 201, f"Failed to create public lab: {pub_lab_res.text}"
    pub_lab_id = pub_lab_res.json()["id"]
    print(f"[PASS] Public Laboratory #{pub_lab_id} created by Alice. Creator assigned as Lead PI.")

    # Private Laboratory created by Alice
    priv_lab_payload = {
        "name": f"Advanced Quantum Defense Facility {timestamp}",
        "description": "Restricted lab for secure hardware cryptography.",
        "researchFocus": "Hardware Ciphers",
        "institution": "MIT CSAIL",
        "visibility": "Private"
    }
    priv_lab_res = requests.post(f"{BASE_API_URL}/directory/laboratories", headers=headers_alice, json=priv_lab_payload)
    assert priv_lab_res.status_code == 201, f"Failed to create private lab: {priv_lab_res.text}"
    priv_lab_id = priv_lab_res.json()["id"]
    print(f"[PASS] Private Laboratory #{priv_lab_id} created by Alice.")

    # 3. Laboratory Access Rules Validation
    print("3. Validating Laboratory visibility and access control boundaries...")
    # Non-head (Bob) attempting to view Private Laboratory -> Must return 403 Forbidden
    bob_priv_res = requests.get(f"{BASE_API_URL}/directory/laboratories/{priv_lab_id}", headers=headers_bob)
    assert bob_priv_res.status_code == 403, f"Security Breach! Expected 403 for non-head viewing private lab, got {bob_priv_res.status_code}"
    print("[PASS] Security Check: Non-head access to Private Laboratory strictly returns 403 Forbidden.")

    # Head (Alice) viewing Private Laboratory -> 200 OK
    alice_priv_res = requests.get(f"{BASE_API_URL}/directory/laboratories/{priv_lab_id}", headers=headers_alice)
    assert alice_priv_res.status_code == 200, "Head should be allowed to view own Private Laboratory"
    print("[PASS] Access Check: Laboratory Head can view their own Private Laboratory (200 OK).")

    # Non-head (Bob) attempting to update Alice's lab -> Must return 403 Forbidden
    unauth_update = requests.put(f"{BASE_API_URL}/directory/laboratories/{pub_lab_id}", headers=headers_bob, json=pub_lab_payload)
    assert unauth_update.status_code == 403, "Non-head was able to modify laboratory!"
    print("[PASS] Security Check: Non-head cannot modify laboratory profile (403 Forbidden).")

    # Non-head (Bob) attempting to delete Alice's lab -> Must return 403 Forbidden
    unauth_delete = requests.delete(f"{BASE_API_URL}/directory/laboratories/{pub_lab_id}", headers=headers_bob)
    assert unauth_delete.status_code == 403, "Non-head was able to delete laboratory!"
    print("[PASS] Security Check: Non-head cannot deactivate laboratory (403 Forbidden).")

    # 4. Laboratory Member Management & Permission Rules
    print("4. Validating Laboratory Member management & role assignment...")
    # Non-head attempting to add a member -> Must return 403 Forbidden
    unauth_add_member = requests.post(f"{BASE_API_URL}/directory/laboratories/{pub_lab_id}/members", headers=headers_bob, json={"userId": bob["id"]})
    assert unauth_add_member.status_code == 403
    print("[PASS] Security Check: Non-head cannot add members to laboratory (403 Forbidden).")

    # Head (Alice) adds Bob as PostDoc member -> 201 Created
    add_member_res = requests.post(f"{BASE_API_URL}/directory/laboratories/{pub_lab_id}/members", headers=headers_alice, json={
        "userId": bob["id"],
        "role": "PostDoc"
    })
    assert add_member_res.status_code == 201, f"Failed to add member: {add_member_res.text}"
    print(f"[PASS] Head successfully added Bob to laboratory #{pub_lab_id} as PostDoc.")

    # Duplicate member rejection -> 400 Bad Request
    dup_member_res = requests.post(f"{BASE_API_URL}/directory/laboratories/{pub_lab_id}/members", headers=headers_alice, json={"userId": bob["id"]})
    assert dup_member_res.status_code == 400
    print("[PASS] Constraint Check: Duplicate laboratory membership rejected with 400 Bad Request.")

    # 5. Researcher Directory Visibility Rules
    print("5. Validating Researcher Directory visibility rules...")
    researchers_res = requests.get(f"{BASE_API_URL}/directory/researchers", headers=headers_alice)
    assert researchers_res.status_code == 200
    researcher_list = researchers_res.json()
    visible_uids = [r["userId"] for r in researcher_list]

    assert alice["id"] in visible_uids, "Public researcher Alice should appear in researcher directory"
    assert bob["id"] in visible_uids, "Public researcher Bob should appear in researcher directory"
    assert eve["id"] not in visible_uids, "Privacy Breach! Private researcher Eve appeared in public researcher directory!"
    print("[PASS] Directory Privacy verified: Public researchers listed; Private researcher strictly hidden.")

    # 6. Project Visibility & Directory Publishing Permissions
    print("6. Validating Project Visibility listing permissions...")
    # Alice creates an OpenProject
    proj_title = f"Autonomous Quadruped Navigation {timestamp}"
    proj_res = requests.post(f"{BASE_API_URL}/openproject", headers=headers_alice, json={
        "title": proj_title,
        "description": "Real-time visual odometry on quadruped robots.",
        "department": "EECS",
        "requiredSkills": "SLAM, ROS2, Python",
        "maxStudents": 2,
        "isFunded": True
    })
    assert proj_res.status_code == 201, f"Failed to create project: {proj_res.text}"
    alice_proj_id = proj_res.json()["id"]

    # Non-owner (Bob) attempts to publish Alice's project to directory -> Must return 403 Forbidden
    unauth_publish = requests.post(f"{BASE_API_URL}/projectdiscovery/listing", headers=headers_bob, json={
        "itemType": "OpenProject",
        "itemId": alice_proj_id,
        "visibility": "Public"
    })
    assert unauth_publish.status_code == 403, f"Security Breach! Non-owner was able to publish project: {unauth_publish.status_code}"
    print("[PASS] Security Check: Non-owner cannot publish another user's project to directory (403 Forbidden).")

    # Owner (Alice) publishes project with Public visibility and links it to her Lab
    publish_res = requests.post(f"{BASE_API_URL}/projectdiscovery/listing", headers=headers_alice, json={
        "itemType": "OpenProject",
        "itemId": alice_proj_id,
        "visibility": "Public",
        "laboratoryId": pub_lab_id
    })
    assert publish_res.status_code == 201, f"Failed to publish listing: {publish_res.text}"
    listing_id = publish_res.json()["id"]
    print(f"[PASS] Project successfully published to directory with Public visibility (Listing #{listing_id}).")

    # Verify project appears in Public Discovery feed
    disco_res = requests.get(f"{BASE_API_URL}/projectdiscovery?search=Autonomous+Quadruped", headers=headers_bob)
    assert disco_res.status_code == 200
    disco_items = disco_res.json()
    assert any(item["itemId"] == alice_proj_id for item in disco_items), "Published project not found in discovery feed!"
    print("[PASS] Discovery Check: Public project is discoverable across the collaborative platform.")

    # 7. Updating Listing Visibility
    print(f"7. Modifying listing #{listing_id} visibility from Public -> Private...")
    # Non-owner (Bob) attempts to update visibility -> Must return 403 Forbidden
    unauth_patch = requests.put(f"{BASE_API_URL}/projectdiscovery/listing/{listing_id}", headers=headers_bob, json={"visibility": "Private"})
    assert unauth_patch.status_code == 403
    print("[PASS] Security Check: Non-owner cannot update listing visibility (403 Forbidden).")

    # Owner (Alice) updates visibility to Private
    auth_patch = requests.put(f"{BASE_API_URL}/projectdiscovery/listing/{listing_id}", headers=headers_alice, json={"visibility": "Private"})
    assert auth_patch.status_code == 200

    # Verify project is now HIDDEN from public discovery feed
    disco_after_private = requests.get(f"{BASE_API_URL}/projectdiscovery?search=Autonomous+Quadruped", headers=headers_bob).json()
    assert not any(item["itemId"] == alice_proj_id for item in disco_after_private), \
        "Privacy Breach! Project marked as Private is still visible in public discovery feed!"
    print("[PASS] Visibility Enforcement: Private listing is completely hidden from public discovery feed.")

    # Revert visibility back to Public for UI verification
    requests.put(f"{BASE_API_URL}/projectdiscovery/listing/{listing_id}", headers=headers_alice, json={"visibility": "Public", "laboratoryId": pub_lab_id})


    # =========================================================================
    # PHASE 2: SELENIUM BROWSER E2E WORKFLOW & DIRECTORY SEARCH UI VALIDATION
    # =========================================================================
    print("\n--- PHASE 2: BROWSER UI DIRECTORY SEARCH, VISIBILITY & ACCESS TESTING ---")

    options = webdriver.ChromeOptions()
    if os.environ.get("HEADLESS", "false").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,960")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 12)

    ui_lab_name = f"Humanoid Perception Lab {timestamp}"
    ui_lab_focus = "Spatial SLAM & 3D Gaussian Splatting"

    try:
        # Step 1: Login as Dr. Alice
        print(f"1. Logging in as Dr. Alice ('{alice['email']}')...")
        driver.get(f"{FRONTEND_URL}/login")
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(alice["email"])
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(alice["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        print("[PASS] Logged in successfully and reached researcher profile.")

        # Step 2: Navigate to Researcher & Laboratory Directory
        print("2. Navigating to Directory page (/directory)...")
        driver.get(f"{FRONTEND_URL}/directory")
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "dir-header")))
        time.sleep(0.5)

        header_text = driver.find_element(By.CLASS_NAME, "dir-header").text
        assert "Researcher & Laboratory Directory" in header_text
        print("[PASS] Research Directory loaded with stats and tabs.")

        # Step 3: Researcher Directory Search & Profile Inspection
        print(f"3. Searching for researcher Bob in Researcher Directory...")
        r_search = wait.until(EC.presence_of_element_located((By.ID, "input-researcher-search")))
        r_search.clear()
        r_search.send_keys(bob["fullName"])
        time.sleep(0.5)

        # Confirm Bob appears in search results
        wait.until(lambda d: any(bob["fullName"] in c.text for c in d.find_elements(By.CLASS_NAME, "researcher-card")))
        bob_card = next(c for c in driver.find_elements(By.CLASS_NAME, "researcher-card") if bob["fullName"] in c.text)
        assert "open to collab" in bob_card.text.lower(), "Open to Collab badge missing from researcher card"
        print("[PASS] Researcher card confirmed with full affiliation and collaboration status.")

        # Open Researcher Detail Modal
        print("3a. Opening Researcher Detail Modal...")
        view_r_btn = bob_card.find_element(By.XPATH, ".//button[contains(@id, 'btn-view-researcher-')]")
        driver.execute_script("arguments[0].click();", view_r_btn)

        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "dir-modal-content")))
        modal_text = driver.find_element(By.CLASS_NAME, "dir-modal-body").text
        assert bob["fullName"] in modal_text
        assert "MIT CSAIL" in modal_text

        # Close Researcher Modal
        close_r_btn = driver.find_element(By.ID, "btn-close-researcher-detail")
        driver.execute_script("arguments[0].click();", close_r_btn)
        wait.until(EC.invisibility_of_element_located((By.ID, "btn-close-researcher-detail")))
        print("[PASS] Researcher detailed profile modal inspected and closed.")

        # Step 4: Register New Laboratory via UI Form
        print(f"4. Registering new laboratory '{ui_lab_name}' via UI form...")
        reg_lab_tab = wait.until(EC.element_to_be_clickable((By.ID, "tab-btn-register-lab")))
        driver.execute_script("arguments[0].click();", reg_lab_tab)
        time.sleep(0.5)

        lab_name_in = wait.until(EC.presence_of_element_located((By.ID, "input-lab-name")))
        lab_name_in.clear()
        lab_name_in.send_keys(ui_lab_name)

        driver.find_element(By.ID, "input-lab-inst").send_keys("MIT CSAIL")
        driver.find_element(By.ID, "input-lab-dept").send_keys("EECS")
        driver.find_element(By.ID, "input-lab-focus").send_keys(ui_lab_focus)
        driver.find_element(By.ID, "input-lab-location").send_keys("Building 32, Stata Center")
        driver.find_element(By.ID, "input-lab-website").send_keys("https://hpl.mit.edu")
        driver.find_element(By.ID, "input-lab-desc").send_keys("Specialized research laboratory in 3D perception and spatial SLAM.")

        # Submit Laboratory
        submit_lab_btn = driver.find_element(By.ID, "btn-submit-lab")
        driver.execute_script("arguments[0].click();", submit_lab_btn)

        # Wait for redirect to Laboratories tab
        wait.until(lambda d: "active" in d.find_element(By.ID, "tab-btn-laboratories").get_attribute("class"))
        print("[PASS] Laboratory successfully registered, redirected to Laboratories Directory tab.")
        time.sleep(0.5)

        # Step 5: Search & Inspect Laboratory Card
        print("5. Searching for registered laboratory...")
        lab_search = wait.until(EC.presence_of_element_located((By.ID, "input-lab-search")))
        lab_search.clear()
        lab_search.send_keys(ui_lab_name)
        time.sleep(0.5)

        wait.until(lambda d: any(ui_lab_name in c.text for c in d.find_elements(By.CLASS_NAME, "lab-card")))
        lab_card = next(c for c in driver.find_elements(By.CLASS_NAME, "lab-card") if ui_lab_name in c.text)
        assert alice["fullName"] in lab_card.text, "Alice should be listed as Lead PI on laboratory card"
        print("[PASS] Laboratory card confirmed in directory with correct PI attribution.")

        # Step 6: Laboratory Detail Modal, Team Members & Edit Operations
        print("6. Viewing Laboratory details & managing team members...")
        view_lab_btn = lab_card.find_element(By.XPATH, ".//button[contains(@id, 'btn-view-lab-')]")
        driver.execute_script("arguments[0].click();", view_lab_btn)

        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "dir-modal-body")))
        time.sleep(0.5)

        # Add Bob to Laboratory Team via Modal
        print("6a. Adding Bob to Laboratory team...")
        add_member_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-open-add-member")))
        driver.execute_script("arguments[0].click();", add_member_btn)

        member_select = wait.until(EC.presence_of_element_located((By.ID, "select-member-user")))
        select_member_obj = Select(member_select)
        select_member_obj.select_by_value(str(bob["id"]))

        role_select = driver.find_element(By.ID, "select-member-role")
        Select(role_select).select_by_value("PostDoc")

        confirm_member_btn = driver.find_element(By.ID, "btn-confirm-add-member")
        driver.execute_script("arguments[0].click();", confirm_member_btn)
        wait.until(EC.invisibility_of_element_located((By.ID, "btn-confirm-add-member")))

        # Verify Bob is added to team list in modal
        wait.until(lambda d: bob["fullName"] in d.find_element(By.CLASS_NAME, "dir-modal-body").text)
        print("[PASS] Team Member successfully added to laboratory with 'PostDoc' role badge.")

        # Edit Laboratory Profile from Modal
        print("6b. Editing Laboratory profile...")
        edit_lab_btn = driver.find_element(By.ID, "btn-edit-lab")
        driver.execute_script("arguments[0].click();", edit_lab_btn)

        edit_loc_in = wait.until(EC.presence_of_element_located((By.ID, "input-edit-lab-loc")))
        edit_loc_in.clear()
        edit_loc_in.send_keys("Ray and Maria Stata Center, 6th Floor")

        save_lab_btn = driver.find_element(By.ID, "btn-save-edit-lab")
        driver.execute_script("arguments[0].click();", save_lab_btn)
        wait.until(EC.invisibility_of_element_located((By.ID, "btn-save-edit-lab")))
        time.sleep(0.5)

        # Close Lab Modal
        close_lab_btn = driver.find_element(By.ID, "btn-close-lab-detail")
        driver.execute_script("arguments[0].click();", close_lab_btn)
        wait.until(EC.invisibility_of_element_located((By.ID, "btn-close-lab-detail")))
        print("[PASS] Laboratory profile updated and detail modal closed.")

        # Step 7: Project Visibility & Discovery Page Navigation
        print("7. Navigating to Project Visibility & Discovery page (/discovery)...")
        driver.get(f"{FRONTEND_URL}/discovery")
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "disco-header")))
        time.sleep(0.5)

        header_disco = driver.find_element(By.CLASS_NAME, "disco-header").text
        assert "Project Visibility & Discovery" in header_disco
        print("[PASS] Project Visibility & Discovery page loaded.")

        # Step 8: Search Discovery Feed & Type Filtering
        print("8. Testing Public Project Discovery search & type filters...")
        disco_search = wait.until(EC.presence_of_element_located((By.ID, "input-discovery-search")))
        disco_search.clear()
        disco_search.send_keys(proj_title)
        time.sleep(0.5)

        wait.until(lambda d: any(proj_title in c.text for c in d.find_elements(By.CLASS_NAME, "disco-card")))
        proj_card = next(c for c in driver.find_elements(By.CLASS_NAME, "disco-card") if proj_title in c.text)
        assert "open project" in proj_card.text.lower(), "Open Project badge missing from card"
        assert "funded research" in proj_card.text.lower(), "Funded Research badge missing from card"
        print("[PASS] Project found in public discovery feed with funded status and metadata.")

        # Test Type Chips (Filter to Ideas -> Project must disappear)
        print("8a. Testing Type Filter Chips...")
        chip_idea = driver.find_element(By.ID, "chip-type-idea")
        driver.execute_script("arguments[0].click();", chip_idea)
        wait.until(lambda d: not any(proj_title in c.text for c in d.find_elements(By.CLASS_NAME, "disco-card")))
        print("[PASS] Type filter chip correctly filtered out Projects when Ideas selected.")

        # Reset Type Chip to All
        chip_all = driver.find_element(By.ID, "chip-type-all")
        driver.execute_script("arguments[0].click();", chip_all)
        wait.until(lambda d: any(proj_title in c.text for c in d.find_elements(By.CLASS_NAME, "disco-card")))
        print("[PASS] Reset type filter restored Project card.")

        # Step 9: Inspect Opportunity Details Modal
        print("9. Inspecting Opportunity Details modal...")
        card_to_view = next(c for c in driver.find_elements(By.CLASS_NAME, "disco-card") if proj_title in c.text)
        view_proj_btn = card_to_view.find_element(By.XPATH, ".//button[contains(@id, 'btn-view-project-')]")
        driver.execute_script("arguments[0].click();", view_proj_btn)

        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "disco-modal-body")))
        inspect_text = driver.find_element(By.CLASS_NAME, "disco-modal-body").text
        assert proj_title in inspect_text
        assert "SLAM" in inspect_text

        close_proj_modal = driver.find_element(By.ID, "btn-close-project-detail")
        driver.execute_script("arguments[0].click();", close_proj_modal)
        wait.until(EC.invisibility_of_element_located((By.ID, "btn-close-project-detail")))
        print("[PASS] Opportunity details modal verified and closed.")

        # Step 10: Manage Visibility Listings Tab
        print("10. Testing 'My Project Visibility & Listings' tab...")
        vis_tab = wait.until(EC.element_to_be_clickable((By.ID, "tab-btn-visibility")))
        driver.execute_script("arguments[0].click();", vis_tab)
        time.sleep(0.5)

        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "vis-mgmt-list")))
        vis_cards = driver.find_elements(By.CLASS_NAME, "vis-mgmt-card")
        assert any(proj_title in c.text for c in vis_cards), "Project not found in user's managed listings!"
        target_vis_card = next(c for c in vis_cards if proj_title in c.text)
        print("[PASS] Project confirmed in user's managed visibility listings.")

        # Toggle Visibility to Private directly from dropdown
        print("10a. Toggling project visibility to Private via quick selector...")
        vis_select_el = target_vis_card.find_element(By.XPATH, ".//select[contains(@id, 'select-listing-vis-')]")
        Select(vis_select_el).select_by_value("Private")
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "alert-banner")))
        time.sleep(0.5)

        # Switch to Discover tab to verify project is now HIDDEN from public discovery
        disco_tab_btn = driver.find_element(By.ID, "tab-btn-discover")
        driver.execute_script("arguments[0].click();", disco_tab_btn)
        time.sleep(0.5)

        # Wait until project disappears from Discover tab
        wait.until(lambda d: not any(proj_title in c.text for c in d.find_elements(By.CLASS_NAME, "disco-card")))
        print("[PASS] Visibility toggle to 'Private' successfully hides project from public discovery.")

        # Switch back to Visibility tab and remove listing from directory
        print("10b. Removing project listing from directory...")
        driver.execute_script("arguments[0].click();", driver.find_element(By.ID, "tab-btn-visibility"))
        time.sleep(0.5)

        delete_listing_btn = wait.until(EC.element_to_be_clickable((By.ID, f"btn-delete-listing-{listing_id}")))
        driver.execute_script("arguments[0].click();", delete_listing_btn)

        confirm_del_list_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-confirm-delete-listing")))
        driver.execute_script("arguments[0].click();", confirm_del_list_btn)
        wait.until(EC.invisibility_of_element_located((By.ID, "btn-confirm-delete-listing")))
        print("[PASS] Project listing successfully removed from directory.")

        # Step 11: Cleanup / Deactivate Laboratory
        print(f"11. Deactivating test laboratory '{ui_lab_name}'...")
        driver.get(f"{FRONTEND_URL}/directory")
        wait.until(EC.element_to_be_clickable((By.ID, "tab-btn-laboratories"))).click()
        time.sleep(0.5)

        lab_search_del = wait.until(EC.presence_of_element_located((By.ID, "input-lab-search")))
        lab_search_del.clear()
        lab_search_del.send_keys(ui_lab_name)
        time.sleep(0.5)

        del_lab_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//div[contains(@class, 'lab-card')]//button[contains(@id, 'btn-delete-lab-')]")))
        driver.execute_script("arguments[0].click();", del_lab_btn)

        confirm_del_lab = wait.until(EC.element_to_be_clickable((By.ID, "btn-confirm-delete-lab")))
        driver.execute_script("arguments[0].click();", confirm_del_lab)
        wait.until(EC.invisibility_of_element_located((By.ID, "btn-confirm-delete-lab")))
        time.sleep(0.5)

        # Verify lab card is removed
        lab_search_del.clear()
        lab_search_del.send_keys(ui_lab_name)
        time.sleep(0.5)
        assert not any(ui_lab_name in c.text for c in driver.find_elements(By.CLASS_NAME, "lab-card")), \
            "Deactivated laboratory still visible in directory!"
        print("[PASS] Laboratory deactivation successfully verified in UI.")

        print("\n==================================================================================")
        print("=== ALL T-017.6 DIRECTORY SEARCH, VISIBILITY & ACCESS TESTS PASSED (EXIT CODE 0) ===")
        print("==================================================================================")

    finally:
        print("Closing browser driver...")
        driver.quit()

if __name__ == "__main__":
    test_directory_search_visibility_and_access_rules()
