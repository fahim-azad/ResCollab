import os
import sys
import time
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_API_URL = "http://localhost:5000/api"
FRONTEND_URL = "http://localhost:5173"

def create_test_user(role="Student", prefix="ui_rec_user"):
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

def set_react_input(driver, element, value):
    driver.execute_script("""
        var elem = arguments[0];
        var val = arguments[1];
        var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(elem, val);
        elem.dispatchEvent(new Event('input', { bubbles: true }));
        elem.dispatchEvent(new Event('change', { bubbles: true }));
    """, element, str(value))

def test_recommendation_api_ui_integration():
    print("==========================================================================================")
    print("=== STARTING T-019.6: RECOMMENDATION API / UI INTEGRATION VALIDATION SUITE            ===")
    print("==========================================================================================")

    timestamp = int(time.time())

    # =========================================================================
    # STEP 0: PREPARE ACTORS & INSTITUTIONAL SEED DATA (API LEVEL)
    # =========================================================================
    print("\n--- STEP 0: SEEDING RECOMMENDATION ACTORS & RESEARCH DATA ---")

    student_user = create_test_user(role="Student", prefix="rec_student")
    supervisor_user = create_test_user(role="Faculty", prefix="rec_supervisor")
    teammate_user = create_test_user(role="Student", prefix="rec_teammate")
    fresh_user = create_test_user(role="Student", prefix="rec_fresh")

    student_headers = {
        "Authorization": f"Bearer {student_user['token']}",
        "Content-Type": "application/json"
    }
    sup_headers = {
        "Authorization": f"Bearer {supervisor_user['token']}",
        "Content-Type": "application/json"
    }
    teammate_headers = {
        "Authorization": f"Bearer {teammate_user['token']}",
        "Content-Type": "application/json"
    }

    uni_name = f"Institute of Quantum & Neural Systems {timestamp}"
    dept_name = f"Quantum Architecture & Distributed Systems {timestamp}"

    # Configure Student Profile
    requests.put(f"{BASE_API_URL}/profile", headers=student_headers, json={
        "university": uni_name,
        "department": dept_name,
        "interests": "Quantum Computing, Neural Algorithms, Distributed Consensus",
        "skills": "Python, Qiskit, PyTorch, C++",
        "bio": "Postgraduate researcher investigating quantum error mitigation and distributed neural models."
    })

    # Configure Supervisor Profile (Same Uni & Dept, Accepting Students)
    requests.put(f"{BASE_API_URL}/profile", headers=sup_headers, json={
        "university": uni_name,
        "department": dept_name,
        "interests": "Quantum Computing, Superconducting Qubits, Neural Algorithms",
        "skills": "Qiskit, Python, Quantum Hardware",
        "bio": "Full Professor directing the Quantum Algorithms Lab.",
        "isAcceptingStudents": True
    })

    # Configure Teammate Profile (Complementary Cloud & Frontend skills)
    requests.put(f"{BASE_API_URL}/profile", headers=teammate_headers, json={
        "university": uni_name,
        "department": dept_name,
        "interests": "Quantum Computing, Neural Algorithms, Distributed Consensus",
        "skills": "React, TypeScript, Docker, Kubernetes, Rust",
        "bio": "Systems and frontend engineer passionate about quantum cloud deployment."
    })

    # Seed Publication matching student interests
    pub_res = requests.post(f"{BASE_API_URL}/publication", headers=sup_headers, json={
        "title": f"Quantum Computing and Neural Algorithms for Distributed Networks {timestamp}",
        "authors": supervisor_user["fullName"],
        "publicationYear": 2024,
        "journalOrConference": "IEEE Transactions on Quantum Engineering",
        "publicationType": "Journal",
        "visibility": "Public",
        "doi": f"10.1109/TQE.{timestamp}"
    })
    assert pub_res.status_code == 201, f"Failed to seed publication: {pub_res.text}"
    pub_id = pub_res.json()["id"]

    # Seed Open Project matching student skills
    proj_res = requests.post(f"{BASE_API_URL}/openproject", headers=sup_headers, json={
        "title": f"Quantum Routing Protocol Architecture {timestamp}",
        "description": "Developing distributed quantum entanglement routing algorithms with active error mitigation.",
        "requiredSkills": "Python, Qiskit, PyTorch, C++",
        "department": dept_name,
        "isFunded": True,
        "maxStudents": 2
    })
    assert proj_res.status_code == 201, f"Failed to seed open project: {proj_res.text}"
    proj_id = proj_res.json()["id"]

    print(f"[PASS] Data setup complete: Student (#{student_user['id']}), Supervisor (#{supervisor_user['id']}), "
          f"Teammate (#{teammate_user['id']}), Pub (#{pub_id}), Proj (#{proj_id}).")

    # =========================================================================
    # SELENIUM BROWSER E2E INTEGRATION FLOW
    # =========================================================================
    print("\n--- STARTING SELENIUM BROWSER INTEGRATION RUN ---")

    options = webdriver.ChromeOptions()
    if os.environ.get("HEADLESS", "true").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,960")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 15)

    try:
        # ---------------------------------------------------------------------
        # PHASE 1: LOGIN & SIDEBAR NAVIGATION INTEGRATION
        # ---------------------------------------------------------------------
        print("\n--- PHASE 1: LOGIN & SIDEBAR NAVIGATION INTEGRATION ---")
        print(f"1. Logging in as Student user '{student_user['email']}'...")
        driver.get(f"{FRONTEND_URL}/login")

        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(student_user["email"])
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(student_user["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        print("[PASS] User logged in and landed on /profile.")

        print("2. Navigating to Recommendations Hub via sidebar (#nav-sidebar-recommendations)...")
        sidebar_link = wait.until(EC.element_to_be_clickable((By.ID, "nav-sidebar-recommendations")))
        driver.execute_script("arguments[0].click();", sidebar_link)
        wait.until(EC.url_contains("/recommendations"))

        wait.until(EC.presence_of_element_located((By.ID, "ai-recommendations-hub")))
        header_text = driver.find_element(By.CLASS_NAME, "recommendations-header").text.lower()
        assert "ai recommendations & matching hub" in header_text
        assert driver.find_element(By.ID, "btn-rec-preferences").is_displayed()
        assert driver.find_element(By.ID, "btn-rec-refresh").is_displayed()
        print("[PASS] Recommendations Hub loaded with interactive header controls.")

        # ---------------------------------------------------------------------
        # PHASE 2: DEEP LINKING & TAB SYNCHRONIZATION
        # ---------------------------------------------------------------------
        print("\n--- PHASE 2: DEEP LINKING & TAB SYNCHRONIZATION ---")
        tabs_to_test = [
            ("tab-rec-supervisors", "supervisors", f"rec-card-supervisor-{supervisor_user['id']}"),
            ("tab-rec-teammates", "teammates", f"rec-card-teammate-{teammate_user['id']}"),
            ("tab-rec-papers", "papers", f"rec-card-paper-{pub_id}"),
            ("tab-rec-projects", "projects", f"rec-card-project-{proj_id}"),
            ("tab-rec-skillgap", "skillgap", "skillgap-container")
        ]

        for tab_id, tab_param, expected_target in tabs_to_test:
            print(f"Switching to tab '{tab_param}' (#{tab_id})...")
            tab_btn = wait.until(EC.element_to_be_clickable((By.ID, tab_id)))
            driver.execute_script("arguments[0].click();", tab_btn)
            time.sleep(0.5)

            # Verify URL parameter sync
            assert f"tab={tab_param}" in driver.current_url, f"Expected tab={tab_param} in URL, got {driver.current_url}"
            assert "active" in tab_btn.get_attribute("class")

            # Verify target content element is loaded
            if expected_target.startswith("rec-card"):
                wait.until(EC.presence_of_element_located((By.ID, expected_target)))
            else:
                wait.until(EC.presence_of_element_located((By.CLASS_NAME, expected_target)))
            print(f"[PASS] Tab '{tab_param}' active and URL synchronized ({driver.current_url}).")

        # Direct deep-link URL loading
        print("Testing direct deep-link URL loading to /recommendations?tab=papers...")
        driver.get(f"{FRONTEND_URL}/recommendations?tab=papers")
        wait.until(EC.presence_of_element_located((By.ID, "ai-recommendations-hub")))
        papers_tab = wait.until(EC.presence_of_element_located((By.ID, "tab-rec-papers")))
        assert "active" in papers_tab.get_attribute("class")
        wait.until(EC.presence_of_element_located((By.ID, f"rec-card-paper-{pub_id}")))
        print("[PASS] Direct deep link verified: Tab restored and publication cards rendered immediately.")

        # ---------------------------------------------------------------------
        # PHASE 3: REAL-TIME SEARCH & MINIMUM MATCH SLIDER FILTERING
        # ---------------------------------------------------------------------
        print("\n--- PHASE 3: REAL-TIME SEARCH & MINIMUM MATCH SLIDER FILTERING ---")
        search_input = wait.until(EC.presence_of_element_located((By.ID, "input-rec-search")))

        print("1. Testing real-time search filtering on Literature Tab...")
        set_react_input(driver, search_input, "Quantum Computing")
        time.sleep(0.6)

        pub_card = wait.until(EC.presence_of_element_located((By.ID, f"rec-card-paper-{pub_id}")))
        assert pub_card.is_displayed()
        print("[PASS] Positive search keyword successfully keeps matched paper card visible.")

        print("2. Testing negative search filter (nonexistent keyword)...")
        set_react_input(driver, search_input, "nonexistent_synthetic_string_999xyz")
        time.sleep(0.6)

        empty_state = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "rec-empty-state")))
        assert "no publication matches found" in empty_state.text.lower()
        print("[PASS] Negative search correctly triggers empty state UI representation.")

        # Clear search
        set_react_input(driver, search_input, "")
        time.sleep(0.6)
        wait.until(EC.presence_of_element_located((By.ID, f"rec-card-paper-{pub_id}")))
        print("[PASS] Search reset: Publication cards reappeared.")

        print("3. Testing Minimum Match Score Slider on Supervisors Tab...")
        driver.execute_script("arguments[0].click();", driver.find_element(By.ID, "tab-rec-supervisors"))
        time.sleep(0.6)

        sup_card = wait.until(EC.presence_of_element_located((By.ID, f"rec-card-supervisor-{supervisor_user['id']}")))
        sup_score_elem = sup_card.find_element(By.CLASS_NAME, "rec-score-badge")
        score_text = sup_score_elem.text.split("%")[0].strip()
        score_val = int(score_text)
        print(f"   - Current Supervisor Match Score: {score_val}%")

        # Set slider to 90% (higher than score)
        slider = driver.find_element(By.CLASS_NAME, "rec-slider")
        set_react_input(driver, slider, 90)
        time.sleep(0.6)

        # Confirm supervisor card is filtered out and empty state is shown
        sup_empty_state = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "rec-empty-state")))
        assert "no supervisor matches found" in sup_empty_state.text.lower()
        print("[PASS] Slider filtering verified: Raising minimum match to 90% filtered out candidate.")

        # Reset slider back to 0%
        set_react_input(driver, slider, 0)
        time.sleep(0.6)

        wait.until(EC.presence_of_element_located((By.ID, f"rec-card-supervisor-{supervisor_user['id']}")))
        print("[PASS] Slider reset: Supervisor card restored.")

        # ---------------------------------------------------------------------
        # PHASE 4: INTERACTIVE ON-DEMAND SKILL GAP ANALYSIS
        # ---------------------------------------------------------------------
        print("\n--- PHASE 4: INTERACTIVE ON-DEMAND SKILL GAP ANALYSIS ---")
        driver.execute_script("arguments[0].click();", driver.find_element(By.ID, "tab-rec-skillgap"))
        time.sleep(0.6)

        gap_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".skillgap-custom-box input")))
        gap_input.clear()
        gap_input.send_keys("Quantum Cryptography & Error Correction")

        analyze_btn = driver.find_element(By.CSS_SELECTOR, ".skillgap-custom-box button")
        driver.execute_script("arguments[0].click();", analyze_btn)
        time.sleep(1.5)

        gap_card = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "skillgap-card")))
        gap_text = gap_card.text.lower()
        assert "readiness score" in gap_text
        assert "skills you possess" in gap_text
        assert "high-yield missing skills" in gap_text
        assert "ai recommendation:" in gap_text
        print("[PASS] Skill gap analysis evaluated and rendered dynamically with possessed and missing skills.")

        # ---------------------------------------------------------------------
        # PHASE 5: CRITERIA WEIGHTS TUNING MODAL & DYNAMIC RE-SCORING
        # ---------------------------------------------------------------------
        print("\n--- PHASE 5: CRITERIA WEIGHTS TUNING MODAL & RE-SCORING ---")
        pref_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-rec-preferences")))
        driver.execute_script("arguments[0].click();", pref_btn)

        modal = wait.until(EC.visibility_of_element_located((By.ID, "modal-criteria-preferences")))
        assert "customize matching weights" in modal.text.lower()

        # Adjust the first weight slider in the modal (Research Interests Overlap)
        modal_sliders = modal.find_elements(By.CLASS_NAME, "rec-slider")
        if len(modal_sliders) > 0:
            set_react_input(driver, modal_sliders[0], 60)

        # Click Save & Re-Score
        save_btn = modal.find_element(By.XPATH, ".//button[contains(text(), 'Save & Re-Score')]")
        driver.execute_script("arguments[0].click();", save_btn)
        time.sleep(1.0)

        # Verify toast and modal closure
        toast = wait.until(EC.presence_of_element_located((By.ID, "rec-toast")))
        assert any(t in toast.text.lower() for t in ["saved", "refreshed", "re-indexed"])
        wait.until(EC.invisibility_of_element_located((By.ID, "modal-criteria-preferences")))
        print("[PASS] Criteria weights tuned, saved via API, and modal dismissed.")

        # Verify backend API persisted the new preferences
        api_pref = requests.get(f"{BASE_API_URL}/recommendation/preferences", headers=student_headers).json()
        assert api_pref["interestWeight"] == 0.60, f"Expected 0.60 in backend, got {api_pref['interestWeight']}"
        print(f"[PASS] Backend persistence verified: Interest weight successfully saved as {api_pref['interestWeight']}.")

        # ---------------------------------------------------------------------
        # PHASE 6: ON-DEMAND RE-INDEXING & REFRESH BUTTON
        # ---------------------------------------------------------------------
        print("\n--- PHASE 6: ON-DEMAND RE-INDEXING & REFRESH BUTTON ---")
        refresh_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-rec-refresh")))
        driver.execute_script("arguments[0].click();", refresh_btn)

        # Check toast
        toast_refresh = wait.until(EC.presence_of_element_located((By.ID, "rec-toast")))
        assert any(r in toast_refresh.text.lower() for r in ["refreshed", "re-indexed", "saved"])
        time.sleep(1.0)
        assert refresh_btn.is_enabled()
        print("[PASS] Refresh action triggered on-demand recalculation with toast feedback.")

        # ---------------------------------------------------------------------
        # PHASE 7: CARD ACTION BUTTONS & ROUTE NAVIGATION INTEGRATION
        # ---------------------------------------------------------------------
        print("\n--- PHASE 7: CARD ACTION BUTTONS & ROUTE NAVIGATION INTEGRATION ---")
        driver.execute_script("arguments[0].click();", driver.find_element(By.ID, "tab-rec-supervisors"))
        time.sleep(0.6)

        sup_card = wait.until(EC.presence_of_element_located((By.ID, f"rec-card-supervisor-{supervisor_user['id']}")))
        view_profile_btn = sup_card.find_element(By.XPATH, ".//button[contains(text(), 'View Profile')]")
        driver.execute_script("arguments[0].click();", view_profile_btn)

        wait.until(EC.url_contains(f"/profile/{supervisor_user['id']}"))
        print(f"[PASS] View Profile button routed correctly to /profile/{supervisor_user['id']}.")

        # Return to Recommendations -> Projects Tab
        driver.get(f"{FRONTEND_URL}/recommendations?tab=projects")
        wait.until(EC.presence_of_element_located((By.ID, "ai-recommendations-hub")))

        proj_card = wait.until(EC.presence_of_element_located((By.ID, f"rec-card-project-{proj_id}")))
        apply_btn = proj_card.find_element(By.XPATH, ".//button[contains(text(), 'Apply / View Project')]")
        driver.execute_script("arguments[0].click();", apply_btn)

        wait.until(EC.url_contains("/projects"))
        print("[PASS] Project action button successfully navigated to /projects.")

        # ---------------------------------------------------------------------
        # PHASE 8: CARD DISMISSAL & PERSISTENCE INTEGRATION
        # ---------------------------------------------------------------------
        print("\n--- PHASE 8: CARD DISMISSAL & PERSISTENCE INTEGRATION ---")
        driver.get(f"{FRONTEND_URL}/recommendations?tab=teammates")
        wait.until(EC.presence_of_element_located((By.ID, "ai-recommendations-hub")))

        tm_card = wait.until(EC.presence_of_element_located((By.ID, f"rec-card-teammate-{teammate_user['id']}")))
        dismiss_btn = tm_card.find_element(By.CLASS_NAME, "btn-dismiss")
        driver.execute_script("arguments[0].click();", dismiss_btn)

        # Wait for dismiss toast
        toast_dis = wait.until(EC.presence_of_element_located((By.ID, "rec-toast")))
        assert "dismissed" in toast_dis.text.lower()

        # Verify card is immediately removed from DOM
        wait.until(EC.invisibility_of_element_located((By.ID, f"rec-card-teammate-{teammate_user['id']}")))
        print("[PASS] Card dismissal optimistically removed element from DOM.")

        # Force refresh and verify persistence
        refresh_btn_rec = driver.find_element(By.ID, "btn-rec-refresh")
        driver.execute_script("arguments[0].click();", refresh_btn_rec)
        time.sleep(1.5)
        remaining_tm_cards = driver.find_elements(By.ID, f"rec-card-teammate-{teammate_user['id']}")
        assert len(remaining_tm_cards) == 0, "Dismissed teammate card reappeared after refresh!"

        # Verify via backend API that the user is excluded from teammate recommendations
        tm_api = requests.get(f"{BASE_API_URL}/recommendation/teammates", headers=student_headers).json()
        assert not any(t["userId"] == teammate_user["id"] for t in tm_api), "Backend API still returned dismissed teammate!"
        print("[PASS] Dismissal persistence verified: Candidate excluded across UI and backend API.")

        # ---------------------------------------------------------------------
        # PHASE 9: COLD START PROFILE GUIDANCE & IMMEDIATE RESOLUTION
        # ---------------------------------------------------------------------
        print("\n--- PHASE 9: COLD START PROFILE GUIDANCE & RESOLUTION ---")
        driver.get(f"{FRONTEND_URL}/login")
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(fresh_user["email"])
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(fresh_user["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))

        driver.get(f"{FRONTEND_URL}/recommendations")
        guidance_banner = wait.until(EC.presence_of_element_located((By.ID, "banner-profile-guidance")))
        assert "boost your recommendation accuracy" in guidance_banner.text.lower()
        print("[PASS] Cold start guidance banner correctly displayed for fresh profile.")

        # Click Complete Profile in guidance banner
        guidance_btn = guidance_banner.find_element(By.CLASS_NAME, "btn-guidance-action")
        driver.execute_script("arguments[0].click();", guidance_btn)

        wait.until(EC.url_contains("/profile"))
        print("[PASS] Guidance banner action routed user directly to /profile for immediate completion.")

        print("\n==========================================================================================")
        print("=== ALL T-019.6 RECOMMENDATION API / UI INTEGRATION TESTS PASSED CLEANLY!              ===")
        print("==========================================================================================")

    finally:
        driver.quit()

if __name__ == "__main__":
    test_recommendation_api_ui_integration()
