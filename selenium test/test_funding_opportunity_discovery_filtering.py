"""
test_funding_opportunity_discovery_filtering.py
==============================================
Automated Selenium & API Integration Test Suite for:
[T-027.5] Test funding opportunity discovery, filtering, and eligibility information

Features Tested:
1. API Security & Input Validation:
   - 401 Unauthorized for unauthenticated requests on funding endpoints
   - 400 Bad Request on missing title, missing provider, invalid funding type,
     invalid status, and past deadline on Open opportunity
2. API Discovery, Filtering & Permissions:
   - Search query filtering across title, provider, research area, description, eligibility, requirements
   - Funding type filter (Grant, Fellowship, Award, etc.)
   - Research area filter (Artificial Intelligence, Quantum Computing, etc.)
   - Eligibility tier keyword filter (PhD, Faculty, etc.)
   - Rolling deadline filter (isRolling=true) and deadline window filtering (deadlineDays=30)
   - Ownership boundaries: 403 Forbidden when non-owner attempts PUT, DELETE, or status toggle
   - User catalog isolation: GET /api/funding/my returns only caller's posted opportunities
3. Dual-Browser UI & Acceptance Flow:
   - Browser 1 (Alice - Program Officer / Grantor):
     - Interactive form validation with inline error banner display (#funding-form-error-banner)
     - Posting a complete funding opportunity with eligibility guidelines and requirements
     - Viewing card in My Grants tab (#my-funding-grid)
     - In-place editing via form and updating award amount/title
     - Status toggle (Open <-> Closed) directly from card
     - Deleting opportunity with browser confirmation acceptance
   - Browser 2 (Bob - Student Researcher):
     - Exploring opportunities in Explore tab (#pane-explore-funding)
     - Validating dynamic eligibility profile compatibility badge (.funding-card-eligibility-badge.match vs .notice)
     - Filtering by funding type, research area chip, deadline, and keyword search
     - Resetting filters with active pills removal
     - Opening opportunity details modal (#funding-modal-{id})
     - Interacting with application dossier checklist items (.checklist-item) and checking progress
     - Verifying owner actions (#btn-modal-edit-opp, #btn-modal-delete-opp, #btn-modal-toggle-status) are strictly hidden for non-owner
"""

import os
import time
from datetime import datetime, timedelta, timezone
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BASE_API_URL = "http://localhost:5000/api"
FRONTEND_URL = "http://localhost:5173"


def register_user(role, full_name, email, password):
    res = requests.post(f"{BASE_API_URL}/auth/register", json={
        "email": email,
        "password": password,
        "fullName": full_name,
        "role": role
    })
    assert res.status_code in [200, 201], f"Registration failed: {res.text}"
    token = res.json().get("token")
    user_id = res.json().get("user", {}).get("id")

    headers = {"Authorization": f"Bearer {token}"}
    requests.post(f"{BASE_API_URL}/profile", headers=headers, json={
        "institution": "MIT CSAIL",
        "department": "EECS",
        "designation": role,
        "bio": f"Profile of {full_name}",
        "researchInterests": "Artificial Intelligence, Quantum Systems",
        "skills": "Python, C#, Distributed Systems",
        "isAvailableForCollaboration": True,
        "visibility": "Public"
    })

    return {
        "id": user_id,
        "email": email,
        "password": password,
        "fullName": full_name,
        "role": role,
        "token": token
    }


def create_driver(position=(0, 0), size=(940, 980)):
    options = webdriver.ChromeOptions()
    # Default HEADLESS to false so the user sees the real browser open on screen
    if os.environ.get("HEADLESS", "false").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument(f"--window-size={size[0]},{size[1]}")
    options.add_argument(f"--window-position={position[0]},{position[1]}")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    driver = webdriver.Chrome(options=options)
    try:
        driver.set_window_position(position[0], position[1])
        driver.set_window_size(size[0], size[1])
    except Exception:
        pass
    return driver


def test_funding_opportunity_discovery_and_filtering():
    print("==========================================================================================")
    print("=== STARTING T-027.5: FUNDING OPPORTUNITY DISCOVERY, FILTERING & ELIGIBILITY INFO ===")
    print("==========================================================================================")

    timestamp = int(time.time() * 1000)

    # 0. Register test users
    print("0. Registering test users (Alice = Program Officer / Faculty, Bob = Student Researcher)...")
    alice = register_user("Faculty", f"Dr. Alice Program {timestamp}", f"alice_fund_{timestamp}@fundtest.com", "Password123!")
    bob = register_user("Student", f"Bob Student {timestamp}", f"bob_fund_{timestamp}@fundtest.com", "Password123!")

    headers_alice = {"Authorization": f"Bearer {alice['token']}", "Content-Type": "application/json"}
    headers_bob = {"Authorization": f"Bearer {bob['token']}", "Content-Type": "application/json"}

    # =========================================================================
    # PHASE 1: API SECURITY & VALIDATION RULES
    # =========================================================================
    print("\n--- PHASE 1: API SECURITY & INPUT VALIDATION ENFORCEMENT ---")

    # 1. Unauthenticated rejection (401 Unauthorized)
    print("1. Validating 401 Unauthorized on unauthenticated requests...")
    assert requests.get(f"{BASE_API_URL}/funding").status_code == 401, "GET /funding without auth must return 401"
    assert requests.get(f"{BASE_API_URL}/funding/my").status_code == 401, "GET /funding/my without auth must return 401"
    assert requests.post(f"{BASE_API_URL}/funding", json={"title": "Test"}).status_code == 401, "POST /funding without auth must return 401"
    assert requests.put(f"{BASE_API_URL}/funding/1", json={"title": "Test"}).status_code == 401, "PUT /funding/1 without auth must return 401"
    assert requests.delete(f"{BASE_API_URL}/funding/1").status_code == 401, "DELETE /funding/1 without auth must return 401"
    assert requests.patch(f"{BASE_API_URL}/funding/1/status", json="Closed").status_code == 401, "PATCH /funding/1/status without auth must return 401"
    print("[PASS] 401 Unauthorized enforced for all unauthenticated operations.")

    # 2. Input validation rules on creation (400 Bad Request)
    print("2. Validating request payload constraints (400 Bad Request)...")

    # 2a. Missing title
    r_no_title = requests.post(f"{BASE_API_URL}/funding", headers=headers_alice, json={
        "title": "   ",
        "provider": "National Science Foundation",
        "fundingType": "Grant"
    })
    assert r_no_title.status_code == 400 and "Title is required" in r_no_title.text, f"Unexpected: {r_no_title.text}"

    # 2b. Missing provider
    r_no_provider = requests.post(f"{BASE_API_URL}/funding", headers=headers_alice, json={
        "title": "NSF Quantum Computing Call",
        "provider": "",
        "fundingType": "Grant"
    })
    assert r_no_provider.status_code == 400 and "Provider is required" in r_no_provider.text, f"Unexpected: {r_no_provider.text}"

    # 2c. Invalid funding type
    r_bad_type = requests.post(f"{BASE_API_URL}/funding", headers=headers_alice, json={
        "title": "Crypto Bounty Call",
        "provider": "Web3 Foundation",
        "fundingType": "CryptoBounty"
    })
    assert r_bad_type.status_code == 400 and "Invalid funding type" in r_bad_type.text, f"Unexpected: {r_bad_type.text}"

    # 2d. Invalid status
    r_bad_status = requests.post(f"{BASE_API_URL}/funding", headers=headers_alice, json={
        "title": "Expired Call",
        "provider": "Agency",
        "fundingType": "Grant",
        "status": "Archived"
    })
    assert r_bad_status.status_code == 400 and "Status must be Open, Closed, or Upcoming" in r_bad_status.text, f"Unexpected: {r_bad_status.text}"

    # 2e. Setting a past deadline on an Open opportunity
    yesterday = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    r_past_deadline = requests.post(f"{BASE_API_URL}/funding", headers=headers_alice, json={
        "title": "Retroactive Fellowship Call",
        "provider": "Past Institute",
        "fundingType": "Fellowship",
        "status": "Open",
        "deadline": yesterday
    })
    assert r_past_deadline.status_code == 400 and "Cannot set a past deadline on an Open opportunity" in r_past_deadline.text, f"Unexpected: {r_past_deadline.text}"

    print("[PASS] Validation constraints correctly enforced on title, provider, fundingType, status, and deadline logic.")

    # =========================================================================
    # PHASE 2: API DISCOVERY, FILTERING & PERMISSIONS
    # =========================================================================
    print("\n--- PHASE 2: API DISCOVERY, FILTERING & OWNERSHIP BOUNDARIES ---")

    # 3. Create 3 distinct opportunities via Alice
    print("3. Publishing 3 distinct funding opportunities via Alice...")

    # Opp 1: Student / PhD Fellowship in AI with urgent deadline in 25 days
    deadline_25d = (datetime.now(timezone.utc) + timedelta(days=25)).isoformat()
    opp1_payload = {
        "title": f"NSF Graduate Research Fellowship in AI {timestamp}",
        "provider": "National Science Foundation",
        "description": "Fellowship supporting outstanding graduate students pursuing research in artificial intelligence.",
        "eligibility": "PhD students and doctoral candidates in Computer Science and STEM",
        "requirements": "Research Proposal (3 pages); 3 Reference Letters; Academic Transcripts",
        "fundingAmount": "$37,000 / year stipend + tuition",
        "fundingType": "Fellowship",
        "researchArea": "Artificial Intelligence",
        "applicationUrl": "https://www.nsfgrfp.org",
        "applicationInfo": "Submit directly through Research.gov before 5:00 PM EST.",
        "deadline": deadline_25d,
        "status": "Open"
    }
    r_opp1 = requests.post(f"{BASE_API_URL}/funding", headers=headers_alice, json=opp1_payload)
    assert r_opp1.status_code == 201, f"Create Opp1 failed: {r_opp1.text}"
    opp1 = r_opp1.json()
    opp1_id = opp1["id"]

    # Opp 2: Faculty / Senior PI Grant in Quantum with rolling deadline
    opp2_payload = {
        "title": f"Horizon Europe Quantum Infrastructure Grant {timestamp}",
        "provider": "European Research Council",
        "description": "Consortium grant for scalable quantum networking and cryogenic testbeds.",
        "eligibility": "Tenured and tenure-track Faculty, Senior Principal Investigators",
        "requirements": "Work Packages Breakdown; Consortium Agreement; Budget Plan",
        "fundingAmount": "EUR 2,500,000 over 4 years",
        "fundingType": "Grant",
        "researchArea": "Quantum Computing",
        "applicationUrl": "https://ec.europa.eu/funding",
        "applicationInfo": "Stage 1 expressions of interest evaluated on a continuous rolling basis.",
        "deadline": None,
        "status": "Open"
    }
    r_opp2 = requests.post(f"{BASE_API_URL}/funding", headers=headers_alice, json=opp2_payload)
    assert r_opp2.status_code == 201, f"Create Opp2 failed: {r_opp2.text}"
    opp2 = r_opp2.json()
    opp2_id = opp2["id"]

    # Opp 3: Closed Environmental Award
    opp3_payload = {
        "title": f"Global Climate Innovation Award {timestamp}",
        "provider": "Earth Foundation",
        "description": "Annual recognition award for high-impact environmental sustainability technologies.",
        "eligibility": "Open to All Academic Researchers and Innovators",
        "requirements": "Nomination Letter; Published Impact Dossier",
        "fundingAmount": "$50,000 prize",
        "fundingType": "Award",
        "researchArea": "Environmental & Climate",
        "applicationUrl": "https://earthfoundation.org/award",
        "applicationInfo": "Annual call closed. Results to be announced in quarterly bulletin.",
        "deadline": yesterday,
        "status": "Closed"
    }
    r_opp3 = requests.post(f"{BASE_API_URL}/funding", headers=headers_alice, json=opp3_payload)
    assert r_opp3.status_code == 201, f"Create Opp3 failed: {r_opp3.text}"
    opp3 = r_opp3.json()
    opp3_id = opp3["id"]

    print(f"[PASS] 3 opportunities cataloged: Opp1 (#{opp1_id}), Opp2 (#{opp2_id}), Opp3 (#{opp3_id}).")

    # 4. Verify API Filtering Parameters
    print("4. Testing API filtering endpoints...")

    # 4a. Filter by fundingType=Fellowship
    r_filt_type = requests.get(f"{BASE_API_URL}/funding?fundingType=Fellowship&search={timestamp}", headers=headers_bob)
    assert r_filt_type.status_code == 200
    ids_type = [o["id"] for o in r_filt_type.json()]
    assert opp1_id in ids_type and opp2_id not in ids_type, f"Filter by type failed: {ids_type}"

    # 4b. Filter by researchArea=Quantum
    r_filt_area = requests.get(f"{BASE_API_URL}/funding?researchArea=Quantum&search={timestamp}", headers=headers_bob)
    assert r_filt_area.status_code == 200
    ids_area = [o["id"] for o in r_filt_area.json()]
    assert opp2_id in ids_area and opp1_id not in ids_area, f"Filter by area failed: {ids_area}"

    # 4c. Filter by eligibility=PhD
    r_filt_elig = requests.get(f"{BASE_API_URL}/funding?eligibility=PhD&search={timestamp}", headers=headers_bob)
    assert r_filt_elig.status_code == 200
    ids_elig = [o["id"] for o in r_filt_elig.json()]
    assert opp1_id in ids_elig and opp2_id not in ids_elig, f"Filter by eligibility failed: {ids_elig}"

    # 4d. Filter by rolling deadline (isRolling=true)
    r_filt_rolling = requests.get(f"{BASE_API_URL}/funding?isRolling=true&search={timestamp}", headers=headers_bob)
    assert r_filt_rolling.status_code == 200
    ids_rolling = [o["id"] for o in r_filt_rolling.json()]
    assert opp2_id in ids_rolling and opp1_id not in ids_rolling, f"Filter by rolling failed: {ids_rolling}"

    # 4e. Filter by deadline window (deadlineDays=30)
    r_filt_days = requests.get(f"{BASE_API_URL}/funding?deadlineDays=30&search={timestamp}", headers=headers_bob)
    assert r_filt_days.status_code == 200
    ids_days = [o["id"] for o in r_filt_days.json()]
    assert opp1_id in ids_days and opp2_id not in ids_days, f"Filter by deadlineDays=30 failed: {ids_days}"

    # 4f. Filter by status=Closed
    r_filt_closed = requests.get(f"{BASE_API_URL}/funding?status=Closed&search={timestamp}", headers=headers_bob)
    assert r_filt_closed.status_code == 200
    ids_closed = [o["id"] for o in r_filt_closed.json()]
    assert opp3_id in ids_closed and opp1_id not in ids_closed, f"Filter by status=Closed failed: {ids_closed}"

    # 4g. Detail endpoint (GET /api/funding/{id})
    r_detail = requests.get(f"{BASE_API_URL}/funding/{opp1_id}", headers=headers_bob)
    assert r_detail.status_code == 200
    d_data = r_detail.json()
    assert d_data["title"] == opp1["title"]
    assert d_data["provider"] == "National Science Foundation"
    assert "Research.gov" in d_data["applicationInfo"]
    assert d_data["postedByName"] == alice["fullName"]

    print("[PASS] API discovery & filtering parameters (type, area, eligibility, rolling, deadlineDays, status) verified.")

    # 5. Ownership & Access Boundary Checks
    print("5. Testing ownership boundaries (403 Forbidden on unauthorized mutation)...")

    # Bob attempts to update Alice's Opp 1
    r_bob_put = requests.put(f"{BASE_API_URL}/funding/{opp1_id}", headers=headers_bob, json={
        "title": "Hacked Title",
        "provider": "Hacked Provider",
        "fundingType": "Grant"
    })
    assert r_bob_put.status_code == 403, f"Non-owner was able to update: {r_bob_put.status_code}"

    # Bob attempts to delete Alice's Opp 1
    r_bob_del = requests.delete(f"{BASE_API_URL}/funding/{opp1_id}", headers=headers_bob)
    assert r_bob_del.status_code == 403, f"Non-owner was able to delete: {r_bob_del.status_code}"

    # Bob attempts to toggle status of Alice's Opp 1
    r_bob_patch = requests.patch(f"{BASE_API_URL}/funding/{opp1_id}/status", headers=headers_bob, json="Closed")
    assert r_bob_patch.status_code == 403, f"Non-owner was able to toggle status: {r_bob_patch.status_code}"

    # My Opportunities isolation
    r_alice_my = requests.get(f"{BASE_API_URL}/funding/my", headers=headers_alice)
    assert r_alice_my.status_code == 200
    alice_my_ids = [o["id"] for o in r_alice_my.json()]
    assert opp1_id in alice_my_ids and opp2_id in alice_my_ids and opp3_id in alice_my_ids

    r_bob_my = requests.get(f"{BASE_API_URL}/funding/my", headers=headers_bob)
    assert r_bob_my.status_code == 200
    bob_my_ids = [o["id"] for o in r_bob_my.json()]
    assert opp1_id not in bob_my_ids and opp2_id not in bob_my_ids

    print("[PASS] Ownership boundaries enforced: 403 Forbidden returned to non-owners and catalog properly isolated.")

    # =========================================================================
    # PHASE 3: DUAL-BROWSER SELENIUM UI WORKFLOW TESTING
    # =========================================================================
    print("\n--- PHASE 3: DUAL-BROWSER SELENIUM UI WORKFLOW TESTING ---")

    print("\n[INFO] Launching visible Chrome browser windows side-by-side...")
    driver_alice = create_driver(position=(0, 0), size=(960, 1020))
    driver_bob = create_driver(position=(960, 0), size=(960, 1020))
    wait_alice = WebDriverWait(driver_alice, 15)
    wait_bob = WebDriverWait(driver_bob, 15)

    try:
        # Step 1: Login Alice in Browser 1
        print("1. Logging in Alice (Program Officer) in Browser 1...")
        driver_alice.get(f"{FRONTEND_URL}/login")
        in_email_a = wait_alice.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        in_email_a.clear()
        in_email_a.send_keys(alice["email"])
        driver_alice.find_element(By.XPATH, "//input[@type='password']").send_keys(alice["password"])
        driver_alice.find_element(By.XPATH, "//button[@type='submit']").click()
        wait_alice.until(EC.url_contains("/profile"))

        # Navigate Alice to /funding
        driver_alice.get(f"{FRONTEND_URL}/funding")
        wait_alice.until(EC.presence_of_element_located((By.ID, "funding-opportunities-page")))
        print("[PASS] Alice logged in and /funding page loaded.")

        # Step 2: Test Form Validation in UI
        print("2. Testing client-side form validation on Add Opportunity...")
        tab_add = wait_alice.until(EC.element_to_be_clickable((By.ID, "tab-post-funding")))
        driver_alice.execute_script("arguments[0].click();", tab_add)

        wait_alice.until(EC.presence_of_element_located((By.ID, "pane-post-funding")))
        btn_submit = wait_alice.until(EC.presence_of_element_located((By.ID, "btn-submit-funding")))

        # Submit with empty title -> Opportunity title is required
        driver_alice.execute_script("arguments[0].click();", btn_submit)
        err_banner = wait_alice.until(EC.presence_of_element_located((By.ID, "funding-form-error-banner")))
        assert "Opportunity title is required" in (err_banner.get_attribute("textContent") or err_banner.text)
        print("[PASS] UI validation triggered: 'Opportunity title is required'.")

        # Fill title, leave provider blank -> Funding provider / institution is required
        input_title = driver_alice.find_element(By.ID, "funding-title")
        input_title.clear()
        input_title.send_keys(f"DOE Clean Energy Initiative {timestamp}")
        driver_alice.execute_script("arguments[0].click();", btn_submit)

        wait_alice.until(lambda d: "Funding provider / institution is required" in (
            d.find_element(By.ID, "funding-form-error-banner").get_attribute("textContent") or ""
        ))
        print("[PASS] UI validation triggered: 'Funding provider / institution is required'.")

        # Step 3: Complete and Submit New Opportunity via Alice UI
        print("3. Completing and publishing new opportunity via Alice...")
        input_provider = driver_alice.find_element(By.ID, "funding-provider")
        input_provider.clear()
        input_provider.send_keys("U.S. Department of Energy")

        select_type = Select(driver_alice.find_element(By.ID, "funding-type"))
        select_type.select_by_value("Grant")

        select_status = Select(driver_alice.find_element(By.ID, "funding-status"))
        select_status.select_by_value("Open")

        input_amount = driver_alice.find_element(By.ID, "funding-amount")
        input_amount.clear()
        input_amount.send_keys("$150,000 / year")

        input_deadline = driver_alice.find_element(By.ID, "funding-deadline")
        future_date_str = (datetime.now() + timedelta(days=45)).strftime("%Y-%m-%d")
        driver_alice.execute_script(
            "arguments[0].value = arguments[1]; "
            "arguments[0].dispatchEvent(new Event('input', { bubbles: true })); "
            "arguments[0].dispatchEvent(new Event('change', { bubbles: true }));",
            input_deadline, future_date_str
        )

        input_area = driver_alice.find_element(By.ID, "funding-area")
        input_area.clear()
        input_area.send_keys("Environmental & Climate")

        input_url = driver_alice.find_element(By.ID, "funding-url")
        input_url.clear()
        input_url.send_keys("https://energy.gov/science")

        input_desc = driver_alice.find_element(By.ID, "funding-description")
        input_desc.clear()
        input_desc.send_keys("Research grant supporting innovative carbon removal and renewable grid resilience technologies.")

        input_elig = driver_alice.find_element(By.ID, "funding-eligibility")
        input_elig.clear()
        input_elig.send_keys("Tenured and tenure-track Faculty and National Lab scientists")

        input_reqs = driver_alice.find_element(By.ID, "funding-requirements")
        input_reqs.clear()
        input_reqs.send_keys("Technical Narrative (10 pages); Data Management Plan; Budget Justification")

        input_info = driver_alice.find_element(By.ID, "funding-info")
        input_info.clear()
        input_info.send_keys("Submit via Grants.gov workspace package before 11:59 PM EST.")

        driver_alice.execute_script("arguments[0].click();", btn_submit)

        # Wait for feedback alert or redirect to explore
        feedback = wait_alice.until(EC.presence_of_element_located((By.ID, "funding-global-feedback-alert")))
        assert "published successfully" in (feedback.get_attribute("textContent") or feedback.text)
        print("[PASS] Opportunity published via UI with confirmation alert.")

        # Step 4: Verify in "My Posted Grants" and Edit Opportunity
        print("4. Testing My Posted Grants tab and editing opportunity in UI...")
        tab_my = wait_alice.until(EC.element_to_be_clickable((By.ID, "tab-my-funding")))
        driver_alice.execute_script("arguments[0].click();", tab_my)

        wait_alice.until(EC.presence_of_element_located((By.ID, "my-funding-grid")))

        # Locate Alice's newly posted card
        cards = driver_alice.find_elements(By.CSS_SELECTOR, ".funding-card.my-opp-card")
        assert len(cards) >= 1, "Expected at least 1 card in My Funding"
        my_card = None
        for c in cards:
            if f"DOE Clean Energy Initiative {timestamp}" in (c.get_attribute("textContent") or ""):
                my_card = c
                break
        assert my_card is not None, "Newly posted opportunity card not found in My Funding grid"

        # Click the edit button on this card
        btn_edit_card = my_card.find_element(By.XPATH, ".//button[@title='Edit Opportunity']")
        driver_alice.execute_script("arguments[0].click();", btn_edit_card)

        # Form opens in edit mode
        wait_alice.until(EC.presence_of_element_located((By.ID, "pane-post-funding")))
        form_heading = driver_alice.find_element(By.CSS_SELECTOR, ".funding-form-header h2")
        assert "Edit Funding Opportunity" in (form_heading.get_attribute("textContent") or form_heading.text)

        # Update title and amount
        input_title = driver_alice.find_element(By.ID, "funding-title")
        input_title.clear()
        input_title.send_keys(f"DOE Clean Energy Advanced Innovation Grant {timestamp}")

        input_amount = driver_alice.find_element(By.ID, "funding-amount")
        input_amount.clear()
        input_amount.send_keys("$200,000 / year")

        btn_submit = driver_alice.find_element(By.ID, "btn-submit-funding")
        driver_alice.execute_script("arguments[0].click();", btn_submit)

        feedback_edit = wait_alice.until(EC.presence_of_element_located((By.ID, "funding-global-feedback-alert")))
        assert "updated successfully" in (feedback_edit.get_attribute("textContent") or feedback_edit.text)
        print("[PASS] Opportunity edited and updated in UI.")

        # Step 5: Test Status Toggle on My Opportunity Card
        print("5. Testing status toggle (Open <-> Closed) on card in My Grants...")
        driver_alice.execute_script("arguments[0].click();", tab_my)
        wait_alice.until(EC.presence_of_element_located((By.ID, "my-funding-grid")))

        # Re-locate card
        my_card = None
        for c in driver_alice.find_elements(By.CSS_SELECTOR, ".funding-card.my-opp-card"):
            if f"DOE Clean Energy Advanced Innovation Grant {timestamp}" in (c.get_attribute("textContent") or ""):
                my_card = c
                break
        assert my_card is not None, "Updated opportunity card not found"

        status_btn = my_card.find_element(By.CSS_SELECTOR, ".funding-status-pill.interactive")
        assert "Open" in (status_btn.get_attribute("textContent") or status_btn.text)

        # Click to toggle status to Closed
        driver_alice.execute_script("arguments[0].click();", status_btn)
        time.sleep(1)

        # Re-locate and verify toggled to Closed
        wait_alice.until(lambda d: "Closed" in (
            d.find_element(By.CSS_SELECTOR, f"#{my_card.get_attribute('id')} .funding-status-pill").get_attribute("textContent") or ""
        ))
        print("[PASS] Status successfully toggled to Closed.")

        # Toggle back to Open for Bob's testing
        status_btn_closed = driver_alice.find_element(By.CSS_SELECTOR, f"#{my_card.get_attribute('id')} .funding-status-pill.interactive")
        driver_alice.execute_script("arguments[0].click();", status_btn_closed)
        time.sleep(1)
        wait_alice.until(lambda d: "Open" in (
            d.find_element(By.CSS_SELECTOR, f"#{my_card.get_attribute('id')} .funding-status-pill").get_attribute("textContent") or ""
        ))
        print("[PASS] Status successfully toggled back to Open.")

        # =====================================================================
        # Step 6: Login Bob (Student) in Browser 2 and Test Discovery & Filters
        # =====================================================================
        print("\n6. Logging in Bob (Student Researcher) in Browser 2...")
        driver_bob.get(f"{FRONTEND_URL}/login")
        in_email_b = wait_bob.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        in_email_b.clear()
        in_email_b.send_keys(bob["email"])
        driver_bob.find_element(By.XPATH, "//input[@type='password']").send_keys(bob["password"])
        driver_bob.find_element(By.XPATH, "//button[@type='submit']").click()
        wait_bob.until(EC.url_contains("/profile"))

        # Navigate Bob to /funding
        driver_bob.get(f"{FRONTEND_URL}/funding")
        wait_bob.until(EC.presence_of_element_located((By.ID, "funding-opportunities-page")))
        wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-card-{opp1_id}")))
        print("[PASS] Bob logged in and /funding Explore grid loaded.")

        # Step 7: Verify Dynamic Eligibility Badges based on User Role (Bob = Student)
        print("7. Verifying dynamic role-based eligibility badges for Bob (Student)...")
        card_opp1 = driver_bob.find_element(By.ID, f"funding-card-{opp1_id}")
        badge_opp1 = card_opp1.find_element(By.CSS_SELECTOR, ".funding-card-eligibility-badge")
        badge_text_opp1 = (badge_opp1.get_attribute("textContent") or badge_opp1.text).strip()
        assert "Profile Match: Eligible for Students" in badge_text_opp1, f"Expected match badge for Opp 1, got: {badge_text_opp1}"
        assert "match" in badge_opp1.get_attribute("class")
        print(f"[PASS] Opp 1 displays student eligibility match: '{badge_text_opp1}'.")

        # Verify Requirements Progress Badge on Card
        reqs_badge_opp1 = card_opp1.find_element(By.CSS_SELECTOR, ".funding-card-reqs-badge")
        assert "3 application requirements" in (reqs_badge_opp1.get_attribute("textContent") or reqs_badge_opp1.text)
        print("[PASS] Application requirements count badge verified.")

        # Step 8: Test Search Filter in UI
        print("8. Testing search bar filter in UI...")
        search_input = wait_bob.until(EC.presence_of_element_located((By.ID, "search-funding-input")))
        search_input.clear()
        search_input.send_keys("Quantum Infrastructure")
        driver_bob.find_element(By.ID, "btn-submit-funding-search").click()

        # Wait for filtered results: Opp 2 should be present, Opp 1 should disappear
        wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-card-{opp2_id}")))
        assert len(driver_bob.find_elements(By.ID, f"funding-card-{opp1_id}")) == 0, "Opp 1 should be filtered out by search"
        print("[PASS] Search query successfully isolated target opportunity.")

        # Active filter tag should be visible
        active_tags = wait_bob.until(EC.presence_of_element_located((By.ID, "funding-active-filters-bar")))
        assert "Quantum Infrastructure" in (active_tags.get_attribute("textContent") or active_tags.text)

        # Clear search filter
        btn_clear_search = driver_bob.find_element(By.CSS_SELECTOR, ".btn-clear-all-filters")
        driver_bob.execute_script("arguments[0].click();", btn_clear_search)
        wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-card-{opp1_id}")))
        print("[PASS] Reset filters cleared query and restored all opportunities.")

        # Step 9: Test Dropdown Filters (Funding Type & Eligibility Tier)
        print("9. Testing Funding Type dropdown filter...")
        select_type_filter = Select(driver_bob.find_element(By.ID, "filter-funding-type"))
        select_type_filter.select_by_value("Fellowship")

        wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-card-{opp1_id}")))
        assert len(driver_bob.find_elements(By.ID, f"funding-card-{opp2_id}")) == 0, "Grant should be filtered out"
        print("[PASS] Funding Type filter (Fellowship) verified.")

        # Reset Type filter back to All
        select_type_filter.select_by_value("All")
        wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-card-{opp2_id}")))

        # Test Research Field Quick Chip
        print("10. Testing Research Field quick filter chips...")
        ai_chip = None
        for chip in driver_bob.find_elements(By.CSS_SELECTOR, ".area-chip"):
            if "Artificial Intelligence" in (chip.get_attribute("textContent") or chip.text):
                ai_chip = chip
                break
        assert ai_chip is not None, "AI filter chip not found"
        driver_bob.execute_script("arguments[0].click();", ai_chip)

        wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-card-{opp1_id}")))
        assert len(driver_bob.find_elements(By.ID, f"funding-card-{opp2_id}")) == 0, "Opp 2 (Quantum) should be filtered out"
        print("[PASS] Research field chip filter verified.")

        # Reset area chip to 'All'
        all_chip = driver_bob.find_elements(By.CSS_SELECTOR, ".area-chip")[0]
        driver_bob.execute_script("arguments[0].click();", all_chip)
        wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-card-{opp2_id}")))

        # Step 11: Open Details Modal and Test Interactive Dossier Checklist
        print("11. Opening Full Details Modal for Opp 1 and testing requirements checklist...")
        btn_view_opp1 = wait_bob.until(EC.element_to_be_clickable((By.ID, f"btn-view-details-{opp1_id}")))
        driver_bob.execute_script("arguments[0].click();", btn_view_opp1)

        modal_opp1 = wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-modal-{opp1_id}")))
        assert modal_opp1.is_displayed()

        # Check modal title and profile assessment banner
        modal_title = modal_opp1.find_element(By.CSS_SELECTOR, ".funding-modal-title")
        assert opp1["title"] in (modal_title.get_attribute("textContent") or modal_title.text)

        modal_eval_banner = modal_opp1.find_element(By.CSS_SELECTOR, ".eligibility-profile-banner")
        assert "Profile Match: Eligible for Students" in (modal_eval_banner.get_attribute("textContent") or modal_eval_banner.text)

        # Inspect Checklist items
        checklist_items = modal_opp1.find_elements(By.CSS_SELECTOR, ".checklist-item")
        assert len(checklist_items) == 3, f"Expected 3 checklist items, found {len(checklist_items)}"

        # Click the first requirement (e.g. Research Proposal)
        first_item = checklist_items[0]
        driver_bob.execute_script("arguments[0].click();", first_item)
        time.sleep(0.5)

        # Check item now has .completed class
        assert "completed" in first_item.get_attribute("class"), "Checklist item did not toggle to completed"
        progress_text = modal_opp1.find_element(By.CSS_SELECTOR, ".progress-info strong")
        assert "1 of 3 items ready (33%)" in (progress_text.get_attribute("textContent") or progress_text.text)
        print("[PASS] Interactive requirements checklist toggled and progress bar updated to 33%.")

        # Verify Portal Link
        portal_btn = modal_opp1.find_element(By.ID, f"btn-open-portal-{opp1_id}")
        assert "nsfgrfp.org" in (portal_btn.get_attribute("href") or "")
        print("[PASS] Official application portal link verified.")

        # Step 12: Verify Non-Owner Security Boundary in Modal
        print("12. Verifying non-owner actions are completely hidden for Bob...")
        edit_buttons = modal_opp1.find_elements(By.ID, "btn-modal-edit-opp")
        delete_buttons = modal_opp1.find_elements(By.ID, "btn-modal-delete-opp")
        toggle_buttons = modal_opp1.find_elements(By.ID, "btn-modal-toggle-status")

        assert len(edit_buttons) == 0, "Security issue: Edit button rendered for non-owner!"
        assert len(delete_buttons) == 0, "Security issue: Delete button rendered for non-owner!"
        assert len(toggle_buttons) == 0, "Security issue: Status toggle rendered for non-owner!"
        print("[PASS] Owner actions (Edit, Delete, Status Toggle) strictly hidden for non-owner peer.")

        # Close Modal
        btn_close_modal = modal_opp1.find_element(By.ID, "btn-close-funding-details")
        driver_bob.execute_script("arguments[0].click();", btn_close_modal)
        wait_bob.until(EC.invisibility_of_element_located((By.ID, f"funding-modal-{opp1_id}")))
        print("[PASS] Funding details modal closed cleanly.")

        # Step 13: Alice Deletes Opportunity in Browser 1
        print("13. Testing opportunity deletion in UI via Alice...")
        driver_alice.execute_script("arguments[0].click();", tab_my)
        wait_alice.until(EC.presence_of_element_located((By.ID, "my-funding-grid")))

        # Re-locate the DOE card
        doe_card = None
        for c in driver_alice.find_elements(By.CSS_SELECTOR, ".funding-card.my-opp-card"):
            if f"DOE Clean Energy Advanced Innovation Grant {timestamp}" in (c.get_attribute("textContent") or ""):
                doe_card = c
                break
        assert doe_card is not None, "DOE opportunity card not found for deletion"

        btn_delete_card = doe_card.find_element(By.XPATH, ".//button[@title='Delete Opportunity']")
        driver_alice.execute_script("arguments[0].click();", btn_delete_card)

        # Accept window.confirm
        WebDriverWait(driver_alice, 5).until(EC.alert_is_present())
        alert = driver_alice.switch_to.alert
        assert "Delete funding opportunity" in alert.text
        alert.accept()

        feedback_del = wait_alice.until(EC.presence_of_element_located((By.ID, "funding-global-feedback-alert")))
        assert "deleted" in (feedback_del.get_attribute("textContent") or feedback_del.text)

        # Verify card is removed from My Funding
        wait_alice.until(lambda d: all(
            f"DOE Clean Energy Advanced Innovation Grant {timestamp}" not in (c.get_attribute("textContent") or "")
            for c in d.find_elements(By.CSS_SELECTOR, ".funding-card.my-opp-card")
        ))
        print("[PASS] Opportunity deleted via UI and card removed from DOM.")

        print("\n==========================================================================================")
        print("=== [T-027.5] ALL FUNDING DISCOVERY, FILTERING & ELIGIBILITY TESTS PASSED SUCCESSFULLY ===")
        print("==========================================================================================")

    finally:
        driver_alice.quit()
        driver_bob.quit()


if __name__ == "__main__":
    test_funding_opportunity_discovery_and_filtering()
