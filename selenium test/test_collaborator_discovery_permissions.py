import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def setup_test_users():
    base_url = "http://localhost:5000/api"
    timestamp = int(time.time())

    # User A: Public Researcher (MIT, Robotics, Open to Collab)
    user_a = {
        "email": f"collab_a_{timestamp}@test.com",
        "password": "123",
        "fullName": f"Dr. Alice {timestamp}",
        "role": "Faculty"
    }

    # User B: Private Researcher (Stanford, Quantum, Private Visibility)
    user_b = {
        "email": f"collab_b_{timestamp}@test.com",
        "password": "123",
        "fullName": f"Dr. Bob Private {timestamp}",
        "role": "Faculty"
    }

    # User C: Public Researcher (Oxford, Quantum Materials, NOT Open to Collab)
    user_c = {
        "email": f"collab_c_{timestamp}@test.com",
        "password": "123",
        "fullName": f"Dr. Charlie {timestamp}",
        "role": "Faculty"
    }

    print("0. Registering test users (Alice, Bob, Charlie)...")
    requests.post(f"{base_url}/auth/register", json=user_a)
    requests.post(f"{base_url}/auth/register", json=user_b)
    requests.post(f"{base_url}/auth/register", json=user_c)

    res_a = requests.post(f"{base_url}/auth/login", json=user_a).json()
    res_b = requests.post(f"{base_url}/auth/login", json=user_b).json()
    res_c = requests.post(f"{base_url}/auth/login", json=user_c).json()

    token_a = res_a.get("token", "")
    token_b = res_b.get("token", "")
    token_c = res_c.get("token", "")

    id_a = res_a["user"]["id"]
    id_b = res_b["user"]["id"]
    id_c = res_c["user"]["id"]

    headers_a = {'Authorization': f'Bearer {token_a}', 'Content-Type': 'application/json'}
    headers_b = {'Authorization': f'Bearer {token_b}', 'Content-Type': 'application/json'}
    headers_c = {'Authorization': f'Bearer {token_c}', 'Content-Type': 'application/json'}

    print("0. Configuring collaborator profiles with public/private visibilities and diverse affiliations...")
    # User A: Public, MIT, USA, Robotics & SLAM, Open to Collab
    requests.post(f"{base_url}/collaborator/profile", headers=headers_a, json={
        "institution": "MIT CSAIL",
        "department": "EECS",
        "country": "United States",
        "researchInterests": "Autonomous Robotics, Motion Planning",
        "expertiseAreas": "ROS2, SLAM, Python",
        "isOpenToCollaboration": True,
        "visibility": "Public"
    })

    # User B: Private, Stanford
    requests.post(f"{base_url}/collaborator/profile", headers=headers_b, json={
        "institution": "Stanford University",
        "department": "Physics",
        "country": "United States",
        "researchInterests": "Classified Quantum Research",
        "expertiseAreas": "Quantum Circuits",
        "isOpenToCollaboration": False,
        "visibility": "Private"
    })

    # User C: Public, Oxford, UK, Quantum, NOT Open
    requests.post(f"{base_url}/collaborator/profile", headers=headers_c, json={
        "institution": "Oxford University",
        "department": "Materials",
        "country": "United Kingdom",
        "researchInterests": "Quantum Materials",
        "expertiseAreas": "Superconductors",
        "isOpenToCollaboration": False,
        "visibility": "Public"
    })

    return {
        "user_a": user_a, "id_a": id_a, "token_a": token_a,
        "user_b": user_b, "id_b": id_b, "token_b": token_b,
        "user_c": user_c, "id_c": id_c, "token_c": token_c
    }

def test_collaborator_discovery_permissions():
    print("==========================================================================")
    print("=== STARTING T-015.5: COLLABORATOR DISCOVERY, FILTERING & PERMISSIONS ===")
    print("==========================================================================")
    
    data = setup_test_users()
    user_a = data["user_a"]
    user_b = data["user_b"]
    user_c = data["user_c"]
    base_url = "http://localhost:5000/api"

    print("\n--- PHASE 1: ACCESS PERMISSIONS & SECURITY BOUNDARY VALIDATION ---")

    # 1. Non-owner (User A) accesses Public profile of User C -> Should be 200 OK
    headers_a = {'Authorization': f'Bearer {data["token_a"]}'}
    res_pub = requests.get(f"{base_url}/collaborator/profile/{data['id_c']}", headers=headers_a)
    assert res_pub.status_code == 200, f"Expected 200 for public profile, got {res_pub.status_code}"
    print("[PASS] Public profile is accessible to authenticated researchers (200 OK).")

    # 2. Non-owner (User A) accesses Private profile of User B -> Must return 403 Forbidden
    res_priv = requests.get(f"{base_url}/collaborator/profile/{data['id_b']}", headers=headers_a)
    assert res_priv.status_code == 403, f"Security Breach! Expected 403 for private profile, got {res_priv.status_code}"
    print("[PASS] Security Check: Private profile strictly returns 403 Forbidden to non-owner.")

    # 3. Owner (User B) accesses their own Private profile -> Should be 200 OK
    headers_b = {'Authorization': f'Bearer {data["token_b"]}'}
    res_priv_owner = requests.get(f"{base_url}/collaborator/profile/{data['id_b']}", headers=headers_b)
    assert res_priv_owner.status_code == 200, f"Expected 200 for owner accessing private profile, got {res_priv_owner.status_code}"
    print("[PASS] Profile Owner can access their own private profile (200 OK).")

    # 4. User A posts a Collaboration Opportunity
    opp_payload = {
        "title": f"Autonomous Robotics Grant Collaboration {int(time.time())}",
        "description": "Seeking cross-institution robotics engineers for joint project",
        "requiredExpertise": "ROS2, SLAM, Python",
        "researchArea": "Robotics",
        "isCrossInstitution": True
    }
    create_opp_res = requests.post(f"{base_url}/collaborator/opportunities", headers=headers_a, json=opp_payload)
    assert create_opp_res.status_code == 201, f"Failed to create opportunity: {create_opp_res.text}"
    opp_id = create_opp_res.json()["id"]
    print(f"[PASS] Collaboration Opportunity #{opp_id} created by User A (201 Created).")

    # 5. Non-owner (User B) attempts to delete User A's Opportunity -> Must return 403 Forbidden
    unauth_delete_res = requests.delete(f"{base_url}/collaborator/opportunities/{opp_id}", headers=headers_b)
    assert unauth_delete_res.status_code == 403, f"Security Breach! Expected 403 on unauth delete, got {unauth_delete_res.status_code}"
    print("[PASS] Security Check: Non-owner cannot delete another researcher's opportunity (403 Forbidden).")

    # 6. Non-owner (User B) attempts to update status -> Must return 403 Forbidden
    unauth_status_res = requests.patch(
        f"{base_url}/collaborator/opportunities/{opp_id}/status",
        headers=headers_b,
        json="Closed"
    )
    assert unauth_status_res.status_code == 403, f"Expected 403 on unauth status patch, got {unauth_status_res.status_code}"
    print("[PASS] Security Check: Non-owner cannot modify opportunity status (403 Forbidden).")

    # 7. Owner (User A) updates status -> Should succeed (200 OK)
    auth_status_res = requests.patch(
        f"{base_url}/collaborator/opportunities/{opp_id}/status",
        headers=headers_a,
        json="InProgress"
    )
    assert auth_status_res.status_code == 200, f"Expected 200 on owner status patch, got {auth_status_res.status_code}"
    print("[PASS] Opportunity Owner can update status to 'InProgress' (200 OK).")

    # 8. Reverting status back to Open for UI test
    requests.patch(f"{base_url}/collaborator/opportunities/{opp_id}/status", headers=headers_a, json="Open")

    print("\n--- PHASE 2: BROWSER UI INTEGRATION, DISCOVERY & FILTERING ---")
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    try:
        # Step 1: Log in as User A
        print("1. Logging in as Dr. Alice...")
        driver.get("http://localhost:5173/login")
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(user_a["email"])
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(user_a["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        print("[PASS] Logged in successfully, landed on profile.")

        # Step 2: Navigate to Collaborators page
        print("2. Navigating to Collaborator Discovery page (/collaborators)...")
        driver.get("http://localhost:5173/collaborators")
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "collab-header")))
        time.sleep(1)

        # Step 3: Discovery Verification (Public vs Private)
        print("3. Verifying Public Collaborator Discovery and Privacy enforcement...")
        page_source = driver.page_source
        assert user_a["fullName"] in page_source, f"Expected Public user {user_a['fullName']} to be visible in discovery"
        assert user_c["fullName"] in page_source, f"Expected Public user {user_c['fullName']} to be visible in discovery"
        assert user_b["fullName"] not in page_source, f"Security Breach! Private user {user_b['fullName']} appeared in public discovery!"
        print("[PASS] Discovery grid correctly displays Public profiles and hides Private profiles.")

        # Step 4: Filter by Institution
        print("\n4. Testing Institution Filter ('MIT')...")
        inst_input = wait.until(EC.presence_of_element_located((By.ID, "filter-institution")))
        inst_input.clear()
        inst_input.send_keys("MIT")
        driver.find_element(By.ID, "btn-search-researchers").click()
        time.sleep(1)

        source_inst = driver.page_source
        assert user_a["fullName"] in source_inst, "User A (MIT) should match institution filter"
        assert user_c["fullName"] not in source_inst, "User C (Oxford) should be excluded by MIT filter"
        print("[PASS] Institution filter ('MIT') successfully filtered results.")

        # Step 5: Filter by Expertise / Interests
        print("\n5. Testing Expertise / Interest Keyword Filter ('Robotics')...")
        inst_input.clear()
        search_input = driver.find_element(By.ID, "filter-search")
        search_input.clear()
        search_input.send_keys("Robotics")
        driver.find_element(By.ID, "btn-search-researchers").click()
        time.sleep(1)

        source_exp = driver.page_source
        assert user_a["fullName"] in source_exp, "User A (Robotics) should match expertise filter"
        assert user_c["fullName"] not in source_exp, "User C (Quantum) should be excluded by Robotics filter"
        print("[PASS] Expertise filter ('Robotics') successfully filtered results.")

        # Step 6: Filter by Open to Collaboration Toggle
        print("\n6. Testing 'Open to Collaboration' Filter Toggle...")
        search_input.clear()
        open_toggle = driver.find_element(By.ID, "filter-open-toggle")
        driver.execute_script("arguments[0].click();", open_toggle) # Activate Open to Collab
        driver.find_element(By.ID, "btn-search-researchers").click()
        time.sleep(1)

        source_open = driver.page_source
        assert user_a["fullName"] in source_open, "User A (Open to Collab) should be visible"
        assert user_c["fullName"] not in source_open, "User C (Not open) should be excluded by open-only toggle"
        print("[PASS] Open-to-Collaboration filter toggle successfully enforced.")

        # Reset Open to Collaboration toggle
        driver.execute_script("arguments[0].click();", open_toggle)
        driver.find_element(By.ID, "btn-search-researchers").click()
        time.sleep(1)

        # Step 7: Modal Inspection
        print("\n7. Inspecting Researcher Profile Modal...")
        view_profile_btn = wait.until(EC.element_to_be_clickable((By.ID, f"btn-view-card-{data['id_a']}")))
        driver.execute_script("arguments[0].click();", view_profile_btn)

        # Wait for modal content to render
        modal = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "collab-modal-content")))
        modal_text = modal.text
        assert user_a["fullName"] in modal_text, "Modal should display researcher name"
        assert "MIT CSAIL" in modal_text, "Modal should display institution"
        print("[PASS] Researcher Profile Modal opened with complete affiliation and research details.")

        # Close modal
        close_btn = modal.find_element(By.CLASS_NAME, "collab-modal-close")
        driver.execute_script("arguments[0].click();", close_btn)
        time.sleep(1)
        print("[PASS] Researcher Profile Modal successfully closed.")

        # Step 8: Update Collaboration Profile via UI
        print("\n8. Navigating to 'My Collaboration Profile' Tab and Updating Profile...")
        my_profile_tab = wait.until(EC.element_to_be_clickable((By.ID, "tab-my-profile")))
        driver.execute_script("arguments[0].click();", my_profile_tab)

        inst_profile_input = wait.until(EC.presence_of_element_located((By.ID, "my-collab-institution")))
        inst_profile_input.clear()
        inst_profile_input.send_keys("MIT Media Lab & CSAIL")

        save_btn = driver.find_element(By.ID, "btn-save-collab-profile")
        driver.execute_script("arguments[0].click();", save_btn)

        success_msg = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "success-msg")))
        assert "Collaboration profile updated successfully!" in success_msg.text
        print("[PASS] Collaboration profile successfully updated via UI.")

        # Step 9: Opportunities Tab & Opportunity Filter
        print("\n9. Testing Opportunities Tab & Discovery...")
        opp_tab = wait.until(EC.element_to_be_clickable((By.ID, "tab-opportunities")))
        driver.execute_script("arguments[0].click();", opp_tab)
        time.sleep(1)

        source_opp = driver.page_source
        assert opp_payload["title"] in source_opp, f"Expected opportunity '{opp_payload['title']}' to appear"
        print("[PASS] Posted Collaboration Opportunity is discoverable in Opportunities tab.")

        print("\n==========================================================================")
        print("[SUCCESS] ALL T-015.5 DISCOVERY, FILTERING & ACCESS PERMISSION TESTS PASSED!")
        print("==========================================================================")

    except Exception as e:
        print(f"\n[FAILED] Test failed with exception: {e}")
        raise e
    finally:
        print("Closing browser...")
        time.sleep(1)
        driver.quit()

if __name__ == "__main__":
    test_collaborator_discovery_permissions()
